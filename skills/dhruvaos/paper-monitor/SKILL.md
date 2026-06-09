---
name: paper-monitor
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Daily: fetch arxiv + HN RSS (capped 40 entries), filter by relevance via phi4-mini, summarize keepers via GPT-4o-mini, save to brain/resources/papers/, post to #research."
schedule: "0 7 * * *"
daily_token_budget: 15000
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - EXA_API_KEY
    - OPENAI_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: []
  writes: ["resources/papers/YYYY-MM-DD-<slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Research, Papers, arxiv, HN, RSS, GBrain, Discord, Cron]
---

# Paper Monitor

Triggered by Hermes cron at 7am Pacific daily, or manually via `/papers` in any Discord channel.

Fetches recent papers from arxiv (cs.AI, cs.LG, cs.CL, cs.NE) and Hacker News top stories.
Hard cap: 8 entries per feed (40 total) — prevents output truncation.
Filters by relevance to Dhruva's work using phi4-mini locally (free, no API cost).
Summarizes keepers using GPT-4o-mini (Tier 1). Saves to brain. Posts digest to #research.

If 0 papers pass the relevance filter: stay silent. No Discord post.

---

## Step 0 — Determine Today's Date

```python
from datetime import datetime, timedelta
import pytz

tz = pytz.timezone("America/Los_Angeles")
now = datetime.now(tz)
today_str = now.strftime("%Y-%m-%d")          # e.g. "2026-06-05"
cutoff_utc = datetime.utcnow() - timedelta(hours=24)
print(f"TODAY={today_str}")
print(f"CUTOFF_UTC={cutoff_utc.isoformat()}")
```

---

## Step 1 — Fetch RSS Feeds

Fetch all feeds in parallel (no API key needed — these are public RSS endpoints):

```python
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

FEEDS = {
    "arxiv_cs_AI":  "https://rss.arxiv.org/rss/cs.AI",
    "arxiv_cs_LG":  "https://rss.arxiv.org/rss/cs.LG",
    "arxiv_cs_CL":  "https://rss.arxiv.org/rss/cs.CL",
    "arxiv_cs_NE":  "https://rss.arxiv.org/rss/cs.NE",
    "hn_top":       "https://news.ycombinator.com/rss",
}

cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

def fetch_entries(url, source):
    entries = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DhruvaOS-PaperMonitor/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            tree = ET.parse(resp)
    except Exception as e:
        print(f"[paper-monitor] WARN: failed to fetch {source}: {e}")
        return entries

    root = tree.getroot()
    channel = root.find("channel") or root
    for item in channel.findall("item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        desc    = (item.findtext("description") or "").strip()
        pub_raw = item.findtext("pubDate") or ""
        try:
            pub_dt = parsedate_to_datetime(pub_raw)
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        except Exception:
            pub_dt = datetime.now(timezone.utc)  # assume recent if unparseable

        if pub_dt < cutoff:
            continue  # skip entries older than 24h

        entries.append({
            "source":    source,
            "title":     title,
            "url":       link,
            "abstract":  desc[:1000],  # cap abstract at 1000 chars to save tokens
            "pub_dt":    pub_dt.isoformat(),
        })
    return entries

PER_FEED_CAP = 8  # arxiv feeds can have 200+ entries/day; cap prevents output truncation
all_entries = []
for source, url in FEEDS.items():
    entries = fetch_entries(url, source)
    all_entries.extend(entries[:PER_FEED_CAP])

print(f"[paper-monitor] Fetched {len(all_entries)} entries (capped {PER_FEED_CAP}/feed) from {len(FEEDS)} feeds")
```

If a feed fails: log a warning and continue — a single feed failure must not abort the run.

---

## Step 2 — phi4-mini Relevance Filter (Tier 0 — local, free)

For each entry, call phi4-mini via Ollama to score relevance (0–10) against Dhruva's interests.
Batch to reduce Ollama round-trips: pack up to 5 entries per prompt.

**Dhruva's interest areas for scoring:**
- AI systems, LLM architecture, inference efficiency, model routing, edge inference
- Personal AI agents, autonomous agents, memory systems, knowledge graphs
- Multimodal models, speech/audio AI, TTS/STT
- UCLA ECE coursework topics (signal processing, embedded systems, VLSI)
- Open-source tooling, developer tools, CLI/automation

**Scoring prompt template (for phi4-mini):**

```
You are a research relevance filter. Score each paper/article 0-10 for relevance to these interests:
AI agents, LLMs, inference, personal AI, memory systems, multimodal, edge AI, UCLA ECE topics, dev tools.

Score 9-10: directly relevant (new method, benchmark, or system in these areas)
Score 7-8: clearly related (adjacent topic, useful background)
Score 5-6: tangentially related (interesting but peripheral)
Score 0-4: not relevant (unrelated domain, purely theoretical math, etc.)

Return ONLY a JSON array: [{"title": "...", "score": N}, ...]

Entries:
{batch_json}
```

Run phi4-mini via Ollama HTTP API:

```python
import json
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"

def score_batch(entries_batch):
    batch_json = json.dumps([
        {"title": e["title"], "abstract": e["abstract"][:300]}
        for e in entries_batch
    ], indent=2)
    prompt = (
        "You are a research relevance filter. Score each paper/article 0-10 for relevance to:\n"
        "AI agents, LLMs, inference, personal AI, memory systems, multimodal, edge AI, UCLA ECE, dev tools.\n\n"
        "Return ONLY a JSON array: [{\"title\": \"...\", \"score\": N}, ...]\n\n"
        f"Entries:\n{batch_json}"
    )
    payload = json.dumps({
        "model": "phi4-mini",
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0, "num_predict": 512},
    }).encode()
    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            result = json.loads(resp.read())
            scores = json.loads(result.get("response", "[]"))
            return {s["title"]: s["score"] for s in scores if "title" in s and "score" in s}
    except Exception as e:
        print(f"[paper-monitor] WARN: phi4-mini scoring failed for batch: {e}")
        # Default: keep all entries in the batch (conservative fallback)
        return {e["title"]: 7 for e in entries_batch}

# Score in batches of 5
BATCH_SIZE = 5
scores = {}
for i in range(0, len(all_entries), BATCH_SIZE):
    batch = all_entries[i:i + BATCH_SIZE]
    scores.update(score_batch(batch))

# Filter: keep entries with score >= 7
keepers = [e for e in all_entries if scores.get(e["title"], 0) >= 7]
print(f"[paper-monitor] {len(keepers)}/{len(all_entries)} entries passed relevance filter")
```

If phi4-mini is offline (Ollama not responding): escalate all entries to Tier 1 scoring or use a
simple keyword filter. Log the fallback. Do not abort.

**Early exit:** If `len(keepers) == 0`: log "No relevant papers today" and stop. No Discord post.

---

## Step 3 — GPT-4o-mini Summarization (Tier 1)

For each keeper, call GPT-4o-mini (Tier 1) to generate a structured summary.

For arxiv papers: also fetch the abstract page via Exa if the abstract in the RSS is truncated
(< 200 chars). Use `exa_contents` with the paper URL to get the full abstract.

**Summarization prompt (per paper):**

```
Summarize this research paper/article for Dhruva, a UCLA ECE student building a personal AI OS.

Title: {title}
Source: {source}
Abstract/Content: {abstract}

Return a JSON object:
{
  "title": "<exact title>",
  "source": "<arxiv_cs_AI | arxiv_cs_LG | arxiv_cs_CL | arxiv_cs_NE | hn_top>",
  "slug": "<lowercase-hyphenated-title-max-60-chars>",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "one_liner": "<one sentence: what this paper does and why it matters>",
  "relevance": "<1-2 sentences: why this is specifically relevant to Dhruva's work>"
}
```

Collect all summaries. If summarization fails for a specific entry: skip it (log warning), continue.

---

## Step 4 — Save to Brain

For each summary, write a brain file and ingest it:

```python
import re
from pathlib import Path

brain_papers_dir = Path.home() / "brain" / "resources" / "papers"
brain_papers_dir.mkdir(parents=True, exist_ok=True)

for summary in summaries:
    slug = re.sub(r"[^a-z0-9]+", "-", summary["slug"].lower()).strip("-")[:60]
    filename = f"{today_str}-{slug}.md"
    filepath = brain_papers_dir / filename

    # Safety: resolve and verify path stays within brain/resources/papers/
    resolved = filepath.resolve()
    if not str(resolved).startswith(str(brain_papers_dir.resolve()) + "/"):
        print(f"[paper-monitor] SKIP unsafe path: {filepath}")
        continue

    content = f"""# {summary['title']}

*Source: {summary['source']} | Ingested: {today_str}*

## Key Insights
- {summary['key_insights'][0]}
- {summary['key_insights'][1]}
- {summary['key_insights'][2]}

## Why Relevant
{summary['relevance']}

## Source
{summary.get('url', 'N/A')}
"""
    filepath.write_text(content, encoding="utf-8")

    # Ingest into GBrain immediately (use lock to avoid collision with dream cycle)
    import subprocess
    gbrain_bin = subprocess.run(
        ["command", "-v", "gbrain"], capture_output=True, text=True
    ).stdout.strip() or "/home/dhruva/.bun/bin/gbrain"

    subprocess.run(
        f"flock -n ~/.gbrain/gbrain-write.lock sh -lc "
        f"'{gbrain_bin} import {resolved} 2>&1 && {gbrain_bin} embed --stale 2>&1'",
        shell=True, timeout=60,
    )
```

If a file write or GBrain ingest fails: log the error, continue with remaining summaries.
The Discord post is the higher-priority deliverable — do not abort it due to ingest failure.

---

## Step 5 — Post to #research

Compose a single Discord message and post to `DISCORD_RESEARCH_CHANNEL_ID` (#research).

**Format:**

```
📄 Papers worth reading ({today_str})

• <title 1> — <one_liner>
• <title 2> — <one_liner>
...

_{N} paper(s) from arxiv (cs.AI/LG/CL/NE) + HN | saved to ~/brain/resources/papers/_
```

Rules:
- Cap at 10 papers in a single post (if more, show top 10 by relevance score then discard)
- Keep total message under 1800 characters — truncate paper lines if needed
- Each bullet: title (max 80 chars) + em dash + one_liner (max 120 chars)
- No approval needed — internal research digest

Use the `messaging` tool:

```python
messaging.post(
    channel_id=DISCORD_RESEARCH_CHANNEL_ID,
    content=digest_text,
)
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| Feed fetch fails (one or more) | Log warning, continue with remaining feeds |
| phi4-mini offline | Keyword fallback or escalate to Tier 1 scoring; log fallback |
| 0 keepers after filter | Stop silently — no Discord post |
| Exa abstract fetch fails | Use RSS abstract (truncated is OK) |
| GPT-4o-mini summarization fails for entry | Skip entry, log warning, continue |
| Brain file write fails | Log error, continue to Discord post |
| GBrain ingest fails | File write is durable — log, continue |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

The only silent stop is 0 relevant papers. All other failures degrade gracefully.

---

## Done Condition

Skill is complete when:
1. All feeds fetched and filtered
2. Keepers summarized
3. Brain files written and GBrain ingest attempted for each keeper
4. Discord post sent to `DISCORD_RESEARCH_CHANNEL_ID` (or silent if 0 keepers)
