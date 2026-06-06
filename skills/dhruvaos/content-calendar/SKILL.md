---
name: content-calendar
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Monday 8:50am: count posts by platform this week vs weekly goals, post calendar summary to #tasks. Alerts to #alerts if Sunday targets were missed."
schedule: "50 8 * * 1"
gbrain:
  reads: ["content/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - DISCORD_ALERTS_CHANNEL_ID
metadata:
  hermes:
    tags: [Content, Calendar, Tracking, Phase13, Cron, Monday]
---

# Content Calendar (Phase 13)

**Cron: Monday 8:50am (runs before content-idea-engine at 9am). No outbound. No approval gate.**

Two execution paths:
- **Cron (Monday 8:50am):** Post weekly content overview to #tasks
- **/calendar command:** Same output, on-demand

Cron setup:
```bash
hermes cron create "50 8 * * 1" "Content calendar overview" --skill content-calendar --deliver discord
```

Weekly goals (hardcoded, update in SKILL.md if targets change):
- LinkedIn: 2 posts/week
- X/Twitter: 3 threads/week
- Blog: 1 post/month (counted as 0.25/week — rounded for display)

---

## Step 0 — Validate env vars

```python
import os

missing = [v for v in ["DISCORD_TASKS_CHANNEL_ID", "DISCORD_ALERTS_CHANNEL_ID"]
           if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")

DISCORD_TASKS_CHANNEL_ID = os.environ.get("DISCORD_TASKS_CHANNEL_ID")
DISCORD_ALERTS_CHANNEL_ID = os.environ.get("DISCORD_ALERTS_CHANNEL_ID")
```

---

## Step 1 — Read content brain files for this week

Determine this week's date range (Monday–Sunday of the PREVIOUS week, since we're running Monday morning):

```python
from datetime import date, timedelta

today = date.today()  # Monday
week_start = today - timedelta(days=7)  # Previous Monday
week_end = today - timedelta(days=1)    # Previous Sunday

week_label = week_start.strftime("%Y-%m-%d")
```

Read `~/brain/content/` directory for files modified or created this past week:

```python
import os, glob
from datetime import datetime

content_dir = os.path.expanduser("~/brain/content")
os.makedirs(content_dir, exist_ok=True)

content_files = []
if os.path.exists(content_dir):
    for f in glob.glob(os.path.join(content_dir, "**/*.md"), recursive=True):
        mtime = datetime.fromtimestamp(os.path.getmtime(f)).date()
        if week_start <= mtime <= week_end:
            content_files.append((f, open(f).read()))
```

---

## Step 2 — GBrain context search

```python
results = gbrain_search("content published posts linkedin blog twitter this week")
gbrain_context = results.get("answer", "")
```

Use this to supplement file-based counting if any posts aren't tracked in brain files.

---

## Step 3 — Count posts by platform

Parse content files for platform indicators:

```python
linkedin_count = 0
twitter_count = 0
blog_count = 0

# Platform detection from file content
LINKEDIN_SIGNALS = ["platform: LinkedIn", "[LinkedIn]", "linkedin-post", "linkedin.com/posts"]
TWITTER_SIGNALS  = ["platform: X", "[X]", "x-thread-draft", "twitter.com", "x.com", "type: thread"]
BLOG_SIGNALS     = ["platform: Blog", "[Blog]", "personal-site-update", "layout: post", "_posts/"]

for file_path, content in content_files:
    # Skip ideas files (they plan content, don't confirm it was posted)
    if "ideas-" in os.path.basename(file_path):
        continue

    content_lower = content.lower()
    if any(sig.lower() in content_lower for sig in LINKEDIN_SIGNALS):
        linkedin_count += 1
    elif any(sig.lower() in content_lower for sig in TWITTER_SIGNALS):
        twitter_count += 1
    elif any(sig.lower() in content_lower for sig in BLOG_SIGNALS):
        blog_count += 1

# Also parse GBrain context for additional signals
if "linkedin" in gbrain_context.lower() and linkedin_count == 0:
    # GBrain knows about a LinkedIn post the file scan missed
    import re
    linkedin_mentions = len(re.findall(r'linkedin\s+post|posted.*linkedin', gbrain_context, re.IGNORECASE))
    linkedin_count = max(linkedin_count, min(linkedin_mentions, 5))

# Blog goal is monthly — count posts in current calendar month
blog_month_count = 0
current_month = today.strftime("%Y-%m")
for f in glob.glob(os.path.join(content_dir, "**/*.md"), recursive=True):
    if "ideas-" in os.path.basename(f):
        continue
    mtime = datetime.fromtimestamp(os.path.getmtime(f)).date()
    if mtime.strftime("%Y-%m") == current_month:
        content = open(f).read()
        if any(sig.lower() in content.lower() for sig in BLOG_SIGNALS):
            blog_month_count += 1
```

---

## Step 4 — Calculate streak

Track consecutive weeks where ALL targets were met.

```python
import json

streak_file = os.path.expanduser("~/brain/content/.streak.json")
streak_data = {"streak": 0, "last_week_complete": False}

if os.path.exists(streak_file):
    try:
        streak_data = json.loads(open(streak_file).read())
    except (json.JSONDecodeError, KeyError):
        pass  # start fresh

# Check if last week hit all targets
LINKEDIN_GOAL = 2
TWITTER_GOAL  = 3
BLOG_GOAL_MONTHLY = 1  # per month

last_week_complete = (
    linkedin_count >= LINKEDIN_GOAL and
    twitter_count >= TWITTER_GOAL
    # Blog not checked weekly — only monthly
)

if last_week_complete:
    streak_data["streak"] = streak_data.get("streak", 0) + 1
else:
    streak_data["streak"] = 0

streak_data["last_week_complete"] = last_week_complete
streak_data["week"] = week_label

with open(streak_file, "w") as f:
    f.write(json.dumps(streak_data))

streak = streak_data["streak"]
```

---

## Step 5 — Build status indicators

```python
def status_icon(count, goal):
    return "✅" if count >= goal else "⚠️"

linkedin_status = status_icon(linkedin_count, LINKEDIN_GOAL)
twitter_status  = status_icon(twitter_count,  TWITTER_GOAL)
blog_status     = status_icon(blog_month_count, BLOG_GOAL_MONTHLY)
```

---

## Step 6 — Post to #tasks

Use the `messaging` tool to post to `DISCORD_TASKS_CHANNEL_ID`:

```
📅 Content Calendar — week of {week_label}

This week:
• LinkedIn: {linkedin_count}/{LINKEDIN_GOAL} posts {linkedin_status}
• X/Twitter: {twitter_count}/{TWITTER_GOAL} threads {twitter_status}
• Blog: {blog_month_count}/{BLOG_GOAL_MONTHLY} posts this month {blog_status}

Streak: {streak} week{"s" if streak != 1 else ""} consistent posting

[content-idea-engine runs in 10min with ideas for this week]
```

If all targets met:
Add: `🎯 All content targets met this week!`

---

## Step 7 — Alert if Sunday targets were missed

If any weekly target (LinkedIn or Twitter) was NOT met, post to `DISCORD_ALERTS_CHANNEL_ID`:

```
⚠️ Content targets missed last week ({week_label}):
{f"• LinkedIn: {linkedin_count}/{LINKEDIN_GOAL}" if linkedin_count < LINKEDIN_GOAL else ""}
{f"• X/Twitter: {twitter_count}/{TWITTER_GOAL}" if twitter_count < TWITTER_GOAL else ""}

Ideas incoming in 10 min — use /linkedin, /thread, or /blog to catch up this week.
```

Only post the alert if at least one target was missed. Do not alert if only the blog monthly target is behind (blog posts take longer — missing a week is fine).

---

## Error handling

| Failure | Action |
|---------|--------|
| content_dir missing | Create it, proceed with 0 counts and note "No content directory found yet" |
| streak_file corrupted | Reset streak to 0, log the reset |
| GBrain search fails | Proceed with file-based counts only |
| File parsing fails | Skip that file, proceed with remaining |
| #tasks post fails | Retry once; if still fails, post to #alerts as fallback |
| Missing env vars | Stop before processing |

---

## Notes

- Blog counts are monthly, not weekly — missing a week on blog is not alerted
- Streak resets only when BOTH LinkedIn AND Twitter targets are missed simultaneously
- The `.streak.json` file is a lightweight state store in brain/ — safe to delete to reset streak
- Content detection is heuristic (file signals) — a LinkedIn post not tracked in brain files won't be counted
- GBrain context provides a secondary signal but is not the primary source of truth
- Runs 10 minutes before content-idea-engine to give Dhruva calendar context first
