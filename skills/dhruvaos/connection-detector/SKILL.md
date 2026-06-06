---
name: connection-detector
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Background enrichment: extract key concepts from a new brain file, search GBrain for related nodes, append top 3 connections, re-ingest. Silent — no Discord post."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
gbrain:
  reads: ["*"]
  writes: ["*"]
tests: tests/
metadata:
  hermes:
    tags: [GBrain, Connections, Enrichment, Background, Silent, Command]
---

# Connection Detector

Runs automatically after any brain import (triggered by youtube-ingest, podcast-ingest,
paper-monitor, and other ingest skills). Also callable directly:

```
/connect ~/brain/resources/papers/2026-06-05-attention-is-all-you-need.md
```

Finds genuine semantic connections between a new brain file and existing brain nodes.
Appends a `## Connected concepts` section to the brain file and re-ingests it.

This skill is **silent** — no Discord messages, no approval gates.
It runs as background enrichment. Failures are logged, never reported to Discord.

---

## Step 0 — Parse Input

The brain file path is provided as either:
- A function argument: `args["brain_file"]` (when called from another skill)
- A Discord argument: everything after `/connect`

```python
import sys
from pathlib import Path

brain_file = args.get("brain_file") or discord_args.strip()

if not brain_file:
    print("[connection-detector] ERROR: no brain file path provided")
    stop()

brain_path = Path(brain_file).expanduser().resolve()

# Safety: path must be within ~/brain/
brain_root = Path.home() / "brain"
if not str(brain_path).startswith(str(brain_root.resolve()) + "/"):
    print(f"[connection-detector] ERROR: path outside ~/brain/: {brain_path}")
    stop()

if not brain_path.exists():
    print(f"[connection-detector] ERROR: file not found: {brain_path}")
    stop()

print(f"[connection-detector] Processing: {brain_path}")
```

---

## Step 1 — Check for Existing Connected Concepts Section

Read the brain file and check if `## Connected concepts` already exists:

```python
content = brain_path.read_text(encoding="utf-8")

if "## Connected concepts" in content:
    print(f"[connection-detector] SKIP: '## Connected concepts' already exists in {brain_path.name}")
    stop()
```

Do not append a second `## Connected concepts` section to an already-enriched file.
This deduplication guard is mandatory — re-enrichment causes noise in the brain.

---

## Step 2 — Extract Key Concepts (Tier 0 — phi4-mini)

Use phi4-mini via Ollama to extract 3–5 key concepts from the brain file content.
This is a cheap local step — Tier 0, no API cost.

```python
import json
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"

# Trim content to avoid large prompts to phi4-mini
content_for_extraction = content[:3000] if len(content) > 3000 else content

extraction_prompt = (
    "Extract 3-5 key concepts from the following brain note. "
    "Return ONLY a JSON array of strings — no explanation.\n\n"
    f"Note:\n{content_for_extraction}"
)

payload = json.dumps({
    "model": "phi4-mini",
    "prompt": extraction_prompt,
    "stream": False,
    "options": {"temperature": 0, "num_predict": 256},
}).encode()

req = urllib.request.Request(
    OLLAMA_URL,
    data=payload,
    headers={"Content-Type": "application/json"},
)

try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        result = json.loads(resp.read())
        raw_response = result.get("response", "[]")
        # Handle phi4-mini sometimes wrapping in markdown
        clean = raw_response.strip().strip("```json").strip("```").strip()
        key_concepts = json.loads(clean)
        if not isinstance(key_concepts, list):
            raise ValueError("Expected a JSON array")
        key_concepts = [str(c).strip() for c in key_concepts if c][:5]
        print(f"[connection-detector] Extracted concepts: {key_concepts}")
except Exception as e:
    print(f"[connection-detector] WARN: phi4-mini concept extraction failed: {e}")
    # Fallback: extract concepts from the filename
    key_concepts = brain_path.stem.replace("-", " ").split()[:5]
    print(f"[connection-detector] Fallback concepts from filename: {key_concepts}")
```

---

## Step 3 — Search GBrain for Related Nodes

For each key concept, run a GBrain search to find related existing brain nodes.
Collect all results, then deduplicate by node title/path:

```python
all_candidates = []

for concept in key_concepts:
    try:
        search_result = gbrain_search(concept)
        # search_result is a list of dicts: [{"title": ..., "path": ..., "snippet": ..., "score": ...}]
        hits = [
            r for r in search_result
            if r.get("score", 0) >= 0.6  # minimum similarity threshold
            and r.get("path") != str(brain_path)  # exclude the file itself
        ]
        all_candidates.extend(hits)
    except Exception as e:
        print(f"[connection-detector] WARN: GBrain search failed for '{concept}': {e}")

# Deduplicate by path, keep highest score per node
seen_paths = {}
for candidate in all_candidates:
    path_key = candidate.get("path", candidate.get("title", ""))
    if path_key not in seen_paths or candidate.get("score", 0) > seen_paths[path_key].get("score", 0):
        seen_paths[path_key] = candidate

deduped_candidates = sorted(seen_paths.values(), key=lambda x: x.get("score", 0), reverse=True)
print(f"[connection-detector] Found {len(deduped_candidates)} related nodes")
```

If GBrain returns no results at all (all searches fail or return empty): log and stop.
No connections to append → no file modification → no re-ingest needed.

```python
if not deduped_candidates:
    print(f"[connection-detector] No related nodes found — skipping enrichment")
    stop()
```

---

## Step 4 — Sonnet: Identify Top 3 Genuine Connections (Tier 1)

Call GPT-4o-mini (Tier 1) to evaluate the candidates and identify the 3 most meaningful
connections. Sonnet must reject trivial keyword matches and prefer deep semantic links.

**Connection quality prompt:**

```
You are a knowledge-graph enrichment assistant for Dhruva's personal brain.

New note title: {brain_path.stem}
New note content (excerpt):
{content[:1500]}

Candidate related brain nodes (sorted by similarity score):
{json.dumps(deduped_candidates[:15], indent=2)}

Task: Identify the TOP 3 genuine, non-trivial connections between the new note and
the candidates. A connection is genuine when:
- There is a meaningful conceptual relationship (not just shared keywords)
- The relationship can be expressed in one clear sentence
- Knowing about this connection would be useful to Dhruva

Return ONLY a JSON array of exactly 3 objects (or fewer if fewer genuine connections exist):
[
  {
    "existing_title": "<node title from candidates>",
    "relationship": "<one sentence: how they connect and why it matters>"
  },
  ...
]

Do NOT include trivial matches (e.g., both mention 'AI', both are recent, etc.).
Prefer connections that reveal non-obvious relationships between concepts.
```

```python
synthesis_result = llm_call(
    tier=1,
    prompt=connection_prompt,
    response_format="json",
)
connections = json.loads(synthesis_result)[:3]  # cap at 3
print(f"[connection-detector] Identified {len(connections)} genuine connections")
```

If Sonnet call fails: use top 2 candidates by score with a generic relationship note.
Never leave the file without any enrichment if candidates exist.

---

## Step 5 — Append Connected Concepts to Brain File

Append the `## Connected concepts` section to the brain file:

```python
from pathlib import Path

connections_md = "\n".join(
    f"- [[{c['existing_title']}]]: {c['relationship']}"
    for c in connections
)

appendix = f"""
## Connected concepts
{connections_md}
"""

# Append (do not overwrite) — preserve all original content
with brain_path.open("a", encoding="utf-8") as f:
    f.write(appendix)

print(f"[connection-detector] Appended {len(connections)} connections to {brain_path.name}")
```

---

## Step 6 — Re-ingest the Updated File

Re-ingest so GBrain indexes the newly appended connections section:

```python
import subprocess

gbrain_bin = subprocess.run(
    ["command", "-v", "gbrain"], capture_output=True, text=True
).stdout.strip() or "/home/dhruva/.bun/bin/gbrain"

result = subprocess.run(
    f"flock -n /tmp/gbrain-write.lock sh -lc "
    f"'{gbrain_bin} import {brain_path} 2>&1 && {gbrain_bin} embed --stale 2>&1'",
    shell=True, timeout=60,
)

if result.returncode != 0:
    print(f"[connection-detector] WARN: GBrain re-ingest failed (exit {result.returncode})")
else:
    print(f"[connection-detector] Re-ingest complete for {brain_path.name}")
```

If lock is busy: log "re-ingest queued" — the file append is already durable.

---

## Silence Contract

This skill produces **no Discord messages** under any circumstances:
- Success: silent (enrichment is background noise)
- Errors: logged to stdout/stderr only (Hermes captures this in skill logs)
- Dedup skip: silent

The calling skill (youtube-ingest, podcast-ingest, etc.) already posted to Discord.
Connection-detector must not generate additional noise.

---

## Error Handling

| Failure | Action |
|---------|--------|
| No brain file path provided | Log error and stop (silent) |
| Path outside ~/brain/ | Log security warning and stop (silent) |
| File not found | Log error and stop (silent) |
| `## Connected concepts` already exists | Log skip and stop (silent) |
| phi4-mini offline | Fallback to filename-based concept extraction |
| All GBrain searches fail | Log and stop — no file modification |
| No related nodes found | Log and stop — no file modification |
| Sonnet call fails | Fallback to top 2 candidates by score |
| File append fails | Log error (silent — no Discord) |
| GBrain re-ingest fails | Log warning — file append is durable |

All errors are logged to stdout/stderr (captured by Hermes). No Discord messages. Ever.

---

## Done Condition

Skill is complete when:
1. Brain file validated (exists, within ~/brain/, no existing Connected concepts)
2. Key concepts extracted via phi4-mini
3. GBrain searched for each concept
4. Top 3 genuine connections identified via Sonnet
5. `## Connected concepts` section appended to brain file
6. Brain file re-ingested into GBrain
