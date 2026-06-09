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
    - OPENAI_API_KEY
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

## Step 0b — Guard: Check for Recent stale-fact-rewrite Run

Before any file read or GBrain operation, check whether stale-fact-rewrite completed
within the last 20 minutes. stale-fact-rewrite uses `gbrain forget_fact` + `extract_facts`
which rewrites brain files destructively. Running connection-detector concurrently risks
appending `## Connected concepts` to a file mid-rewrite, corrupting the content.

Use `hermes_log_read` to fetch the last 200 lines of `~/.hermes/logs/gateway.log`.
If `hermes_log_read` is unavailable, fall back to direct file read (tail 200 lines).

```python
import re
from datetime import datetime, timedelta, timezone

log_lines = """<LOG CONTENT>"""

# Gateway log format: YYYY-MM-DD HH:MM:SS,mmm LEVEL module.name: message
TIMESTAMP_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")

# Match stale-fact-rewrite completion markers
SFR_COMPLETE_RE = re.compile(
    r"stale[-_]fact[-_]rewrite.*(complete|finish|done|success|exit\s*0)",
    re.IGNORECASE,
)

now = datetime.now(timezone.utc)
guard_window = timedelta(minutes=20)
stale_fact_recently_ran = False

for line in reversed(log_lines.splitlines()):
    ts_m = TIMESTAMP_RE.match(line)
    if ts_m:
        try:
            line_ts = datetime.strptime(ts_m.group(1), "%Y-%m-%d %H:%M:%S").replace(
                tzinfo=timezone.utc
            )
            if now - line_ts > guard_window:
                break  # older than 20 min — stop scanning
        except ValueError:
            pass
    if SFR_COMPLETE_RE.search(line):
        stale_fact_recently_ran = True
        break

if stale_fact_recently_ran:
    print(
        "[connection-detector] GUARD: stale-fact-rewrite ran within last 20 min — "
        "deferring to avoid concurrent GBrain brain-file modification. "
        "Re-trigger this skill after the 20-minute window."
    )
    # Emit a sentinel that the skill executor checks
    print("SKILL_EXIT=guard_triggered")
    raise SystemExit(0)
```

If `stale_fact_recently_ran` is True: exit silently — no Discord message, no file modification.
This skill is background enrichment; deferring is always safe.

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
    raise SystemExit(0)

brain_path = Path(brain_file).expanduser().resolve()

# Safety: path must be within ~/brain/
brain_root = Path.home() / "brain"
if not str(brain_path).startswith(str(brain_root.resolve()) + "/"):
    print(f"[connection-detector] ERROR: path outside ~/brain/: {brain_path}")
    raise SystemExit(0)

if not brain_path.exists():
    print(f"[connection-detector] ERROR: file not found: {brain_path}")
    raise SystemExit(0)

print(f"[connection-detector] Processing: {brain_path}")
```

---

## Step 1 — Check for Existing Connected Concepts Section

Read the brain file and check if `## Connected concepts` already exists:

```python
content = brain_path.read_text(encoding="utf-8")

if "## Connected concepts" in content:
    print(f"[connection-detector] SKIP: '## Connected concepts' already exists in {brain_path.name}")
    raise SystemExit(0)
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
    raise SystemExit(0)
```

---

## Step 4 — GPT-4o-mini: Identify Top 3 Genuine Connections (Tier 1)

Call GPT-4o-mini (Tier 1) to evaluate the candidates and identify the 3 most meaningful
connections. GPT-4o-mini must reject trivial keyword matches and prefer deep semantic links.

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

If GPT-4o-mini call fails: use top 2 candidates by score with a generic relationship note.
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
    f"flock -w 30 ~/.gbrain/gbrain-write.lock sh -lc "
    f"'{gbrain_bin} import {brain_path} 2>&1 && {gbrain_bin} embed --stale 2>&1'",
    shell=True, timeout=60,
)

if result.returncode != 0:
    print(f"[connection-detector] WARN: GBrain re-ingest failed (exit {result.returncode})")
else:
    print(f"[connection-detector] Re-ingest complete for {brain_path.name}")
```

Waits up to 30s for the lock; if still busy after 30s, logs warning and exits (file append is already durable).

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
| GPT-4o-mini call fails | Fallback to top 2 candidates by score |
| File append fails | Log error (silent — no Discord) |
| GBrain re-ingest fails | Log warning — file append is durable |

All errors are logged to stdout/stderr (captured by Hermes). No Discord messages. Ever.

---

## Done Condition

Skill is complete when ONE of:

1. **Guard triggered** (stale-fact-rewrite ran < 20 min ago): silent exit, no file modification
2. **Skip** (file not found, path outside ~/brain/, or Connected concepts already exists): silent exit
3. **Enrichment complete**: brain file validated → concepts extracted → GBrain searched →
   top 3 connections identified → `## Connected concepts` appended → brain file re-ingested
