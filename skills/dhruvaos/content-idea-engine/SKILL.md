---
name: content-idea-engine
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Monday 9am: pull recent GBrain context, generate 3-5 content ideas for LinkedIn/Blog/X, post to #tasks. Does NOT auto-post anything."
schedule: "0 9 * * 1"
gbrain:
  reads: ["projects/*", "goals/*", "weekly/*"]
  writes: ["content/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [Content, Ideas, LinkedIn, Blog, Twitter, Phase13, Cron, Monday]
---

# Content Idea Engine (Phase 13)

**Cron: Monday 9am. No outbound. No approval gate. Ideas only — does NOT post anything.**

Runs after content-calendar (8:50am). Cron setup:
```bash
hermes cron create "0 9 * * 1" "Weekly content ideas" --skill content-idea-engine --deliver discord
```

---

## Step 0 — Validate env vars

```python
import os

missing = [v for v in ["DISCORD_TASKS_CHANNEL_ID"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

## Step 1 — GBrain context search

Two searches to understand what Dhruva has been doing:

```python
results_work = gbrain_search("recent projects work learning this week")
results_think = gbrain_think("What has Dhruva been working on that would be worth sharing publicly?")

work_context  = results_work.get("answer", "")
think_context = results_think.get("answer", "")
```

---

## Step 2 — Read most recent weekly synthesis

Check `~/brain/weekly/` for the most recent weekly synthesis file:

```python
import os, glob
from datetime import datetime

weekly_dir = os.path.expanduser("~/brain/weekly")
weekly_context = ""

if os.path.exists(weekly_dir):
    files = sorted(glob.glob(os.path.join(weekly_dir, "*.md")), reverse=True)
    if files:
        with open(files[0]) as f:
            weekly_context = f.read()[:2000]  # cap at 2000 chars for prompt
```

---

## Step 3 — Generate content ideas with GPT-4o-mini (Tier 1)

Generate 3-5 content ideas. Tier 1 is appropriate here because these are internal ideas,
not outbound content. Tier 2 is used only when drafting the actual post (blog-draft, linkedin-post).

Prompt:
```
Dhruva is a technical builder — he builds AI systems, automation tools, and personal productivity
infrastructure. He posts on LinkedIn (thought leadership, builder stories), Blog (deep technical
posts, tutorials), and X/Twitter (quick insights, thread threads).

Context about this week:
--- Recent work ---
{work_context[:800]}
--- What's worth sharing ---
{think_context[:600]}
--- Weekly synthesis ---
{weekly_context[:600]}

Generate 3-5 SPECIFIC, TIMELY content ideas for this week. Each idea must be grounded in the
context above — no generic "5 tips for productivity" filler.

Return as JSON array:
[
  {
    "platform": "LinkedIn|Blog|X",
    "topic": "<one-line concept>",
    "hook": "<exact opening line, ≤150 chars>",
    "why_now": "<one sentence — why this week specifically>"
  }
]

Return ONLY the JSON array, no explanation.
```

Parse the response into `ideas` list. If JSON parse fails, retry once with a simpler prompt.
If second attempt fails, post a plain-text fallback to #tasks with whatever context is available.

---

## Step 4 — Save ideas to brain file

```python
from datetime import date

today = date.today().isoformat()
ideas_dir = os.path.expanduser("~/brain/content")
os.makedirs(ideas_dir, exist_ok=True)
ideas_path = os.path.join(ideas_dir, f"ideas-{today}.md")

lines = [f"# Content Ideas — {today}", ""]
for i, idea in enumerate(ideas, 1):
    lines += [
        f"## {i}. [{idea['platform']}] {idea['topic']}",
        f"**Hook:** \"{idea['hook']}\"",
        f"**Why now:** {idea['why_now']}",
        "",
    ]

with open(ideas_path, "w") as f:
    f.write("\n".join(lines))

gbrain_ingest(ideas_path)
```

---

## Step 5 — Post to #tasks

Use the `messaging` tool to post to `DISCORD_TASKS_CHANNEL_ID`:

```
💡 Content ideas for this week:

{for each idea:}
{i}. [{platform}] {topic}
   Hook: "{hook}"
   Why now: {why_now}

```

Followed by:
```
Select by reacting or replying. Use /blog "<title>", /linkedin <topic>, or /thread "<topic>" to draft.
```

Full message template:
```
💡 Content ideas for this week:

1. [LinkedIn] {ideas[0]["topic"]}
   Hook: "{ideas[0]["hook"]}"
   Why now: {ideas[0]["why_now"]}

2. [Blog] {ideas[1]["topic"]}
   Hook: "{ideas[1]["hook"]}"
   Why now: {ideas[1]["why_now"]}

...

Use /blog "<title>", /linkedin <topic>, or /thread "<topic>" to draft any of these.
```

---

## Error handling

| Failure | Action |
|---------|--------|
| GBrain returns no context | Generate ideas from general builder persona; note "(no GBrain context this week)" in post |
| No weekly/ directory | Skip that context; proceed with GBrain results only |
| Model returns bad JSON | Retry once; if fails, post raw model output as plaintext |
| Model call fails entirely | Post "⚠️ content-idea-engine: model call failed. Check Hermes logs." to #tasks |
| ideas_path write fails | Log error; Discord post still proceeds |
| Missing env var | Stop before any processing |

---

## Notes

- This skill generates IDEAS only. It never calls linkedin-post, blog-draft, or x-thread-draft.
- Dhruva selects which idea to pursue by replying with the appropriate slash command.
- Ideas file is saved even if Discord post fails — run `flock -n ~/.gbrain/gbrain-write.lock gbrain import ~/brain/content/ideas-YYYY-MM-DD.md` to recover.
- Runs 10 minutes after content-calendar so Dhruva sees the calendar state first.
