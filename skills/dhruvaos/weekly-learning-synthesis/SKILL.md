---
name: weekly-learning-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Sunday 9pm: query GBrain for the week's learning, synthesize insights via Sonnet, save to brain/weekly/, post digest to #briefings."
schedule: "0 21 * * 0"
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_BRIEFINGS_CHANNEL_ID
gbrain:
  reads: ["resources/papers/*", "resources/video/*", "resources/media/*", "resources/research-*", "weekly/*"]
  writes: ["weekly/week-YYYY-MM-DD.md"]
tests: tests/
metadata:
  hermes:
    tags: [Synthesis, Weekly, Learning, GBrain, Discord, Briefings, Cron, Sonnet]
---

# Weekly Learning Synthesis

Runs every Sunday at 9pm Pacific via Hermes cron.

Queries GBrain for everything ingested this week, synthesizes key learnings,
identifies cross-domain connections, surfaces open questions, and posts a
structured digest to #briefings.

This is an internal brain-facing synthesis — no approval gate required.

---

## Step 0 — Determine Week Boundaries

```python
from datetime import datetime, timedelta
import pytz

tz = pytz.timezone("America/Los_Angeles")
now = datetime.now(tz)
today_str = now.strftime("%Y-%m-%d")                  # e.g. "2026-06-07"
week_display = now.strftime("week of %B %-d, %Y")     # e.g. "week of June 7, 2026"

# Window: last 7 full days (Monday 00:00 through Sunday 23:59)
week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
week_end = today_str

print(f"TODAY={today_str}")
print(f"WEEK_START={week_start}")
print(f"WEEK_END={week_end}")
print(f"WEEK_DISPLAY={week_display}")
```

---

## Step 1 — Query GBrain for This Week's Additions

Make 4 targeted GBrain searches to surface all ingested content:

**Search 1 — papers:**
```python
papers_result = gbrain_search(f"arxiv paper ingested {week_start} {week_end}")
```

**Search 2 — videos and podcasts:**
```python
media_result = gbrain_search(f"youtube video podcast ingested {week_start} {week_end}")
```

**Search 3 — research notes:**
```python
research_result = gbrain_search(f"research synthesis note {week_start} {week_end}")
```

**Search 4 — general brain additions this week:**
```python
general_result = gbrain_search(f"ingested added brain this week {week_start}")
```

Collect all results. Deduplicate by title. Build a combined `week_additions` list:

```python
week_additions = deduplicate_by_title([
    *extract_items(papers_result, label="paper"),
    *extract_items(media_result, label="media"),
    *extract_items(research_result, label="research"),
    *extract_items(general_result, label="general"),
])
```

If all 4 searches return empty: post to #briefings:
```
📚 Weekly Learning Synthesis ({week_display})
Nothing was added to brain this week. Add papers, videos, or research notes to get a synthesis next Sunday.
```
Then stop.

---

## Step 2 — Query for Cross-Domain Connections

Make 2 additional GBrain searches to find emerging themes and connections:

**Search 5 — themes and patterns:**
```python
themes_result = gbrain_search("what are the common themes across recent AI research memory agents")
```

**Search 6 — open questions:**
```python
questions_result = gbrain_search("open questions unanswered research gaps recent notes")
```

Store results as `themes_context` and `questions_context`.

---

## Step 3 — Sonnet Synthesis (Tier 2)

Call Claude Sonnet (Tier 2) to synthesize all the week's learning into a structured report.

**Synthesis prompt:**

```
You are Drew, Dhruva's personal AI OS. Synthesize this week's learning for Dhruva.

Week: {week_display}
Date range: {week_start} to {week_end}

Content added to brain this week:
{week_additions_formatted}

Themes and patterns from existing brain:
{themes_context}

Open questions and gaps:
{questions_context}

Return a JSON object:
{
  "key_learnings": [
    "bullet 1 — specific new knowledge or insight (not generic)",
    "bullet 2",
    "bullet 3",
    "bullet 4",
    "bullet 5"
  ],
  "top_connection": {
    "new_concept": "<concept from this week>",
    "existing_concept": "<concept already in the brain>",
    "relationship": "<one sentence: how they connect and why that matters>"
  },
  "open_question": "<one interesting question raised by this week's learning — specific, not generic>",
  "brain_stats": {
    "papers": N,
    "videos_podcasts": N,
    "research_notes": N,
    "total_new_notes": N
  }
}
```

Produce 3–5 key learnings (minimum 3, maximum 5). If fewer than 3 distinct learnings
can be extracted from this week's additions, note "Light week" in the first bullet.

If synthesis fails: post a minimal digest using raw search results and log the error.

---

## Step 4 — Write Synthesis to Brain

```python
import re
from pathlib import Path

brain_weekly_dir = Path.home() / "brain" / "weekly"
brain_weekly_dir.mkdir(parents=True, exist_ok=True)
filepath = brain_weekly_dir / f"week-{today_str}.md"

# Safety: path must stay within brain/weekly/
resolved = filepath.resolve()
if not str(resolved).startswith(str(brain_weekly_dir.resolve()) + "/"):
    raise ValueError("Unsafe brain output path for weekly synthesis")

stats = synthesis["brain_stats"]
learnings_md = "\n".join(f"- {l}" for l in synthesis["key_learnings"])
conn = synthesis["top_connection"]

content = f"""# Weekly Learning Synthesis — {week_display}

*Generated by Drew | {today_str} 21:00 PT*

## Key Learnings
{learnings_md}

## Top Connection
**{conn['new_concept']}** connects to **{conn['existing_concept']}**: {conn['relationship']}

## Open Question
{synthesis['open_question']}

## Brain Growth This Week
- Papers: {stats['papers']}
- Videos / Podcasts: {stats['videos_podcasts']}
- Research notes: {stats['research_notes']}
- Total new notes: {stats['total_new_notes']}

---
*Week: {week_start} → {week_end}*
"""

filepath.write_text(content, encoding="utf-8")
print(f"[weekly-learning-synthesis] Written to {resolved}")
```

---

## Step 5 — GBrain Ingest the Synthesis

Ingest the weekly synthesis so future queries can reference it:

```python
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

If lock is busy: log "GBrain ingest queued" and note in Discord post.

---

## Step 6 — Post to #briefings

Compose and post the weekly synthesis digest to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings).

**Format:**

```
📚 Weekly Learning Synthesis ({week_display})

**Key learnings:**
- {learning 1}
- {learning 2}
- {learning 3}

**Top connection:** {new_concept} ↔ {existing_concept}
{relationship}

**Open question:** {open_question}

**Brain growth:** +{total_new_notes} notes ({papers} papers, {videos_podcasts} videos/podcasts, {research_notes} research notes)
```

Rules:
- Keep total message under 1800 characters
- Each learning bullet: max 150 chars — truncate with "…" if needed
- Open question: max 200 chars
- No approval needed — internal synthesis post

Use the `messaging` tool:
```python
messaging.post(
    channel_id=DISCORD_BRIEFINGS_CHANNEL_ID,
    content=digest_text,
)
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| All 4 GBrain searches return empty | Post "nothing added this week" and stop |
| One or more searches fail | Use available results; note missing sources in synthesis |
| Synthesis API call fails | Post raw search result titles as a minimal digest; log error |
| Brain file write fails | Log error, continue to Discord post |
| GBrain ingest fails | File write is durable — log and continue |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

All failures degrade gracefully. The Discord post is always attempted unless there is
truly nothing to synthesize.

---

## Done Condition

Skill is complete when:
1. Week boundaries computed
2. All GBrain queries completed (results may be partial)
3. Synthesis generated (or minimal fallback if synthesis API fails)
4. Weekly brain file written to `~/brain/weekly/week-{today_str}.md`
5. GBrain ingest attempted
6. Digest posted to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings)
