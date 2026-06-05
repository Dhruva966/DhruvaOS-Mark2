---
name: morning-briefing
version: 2.0.0
tier: 2
outbound: false
requires_approval: false
description: "Full daily briefing: calendar + email digest + tasks + news/research → posts to Discord #briefings"
schedule: "0 8 * * *"
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - GOOGLE_CALENDAR_ID
    - EXA_API_KEY
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - DREW_TIMEZONE
gbrain:
  reads: ["daily/*", "projects/*", "goals/*", "brain/*"]
  writes: ["daily/briefing-{{date}}.md"]
tests: tests/
metadata:
  hermes:
    tags: [briefing, calendar, gmail, discord, morning, daily]
    homepage: https://github.com/dhruva966/dhruvaos
---

# Morning Briefing

You are Drew, Dhruva's personal AI OS agent. This skill runs at 8am Pacific every day.
Your job is to gather context from calendar, email, tasks, and research — then compose
and post a concise morning briefing to Discord #briefings.

This is an INTERNAL briefing to Discord only. It is NOT sent to any external party.
No approval gate is needed. Auto-post directly.

---

## Step 0 — Determine Today's Date

Use `code_execution` to get today's date in Pacific time:

```python
from datetime import datetime
import pytz

tz = pytz.timezone("America/Los_Angeles")
now = datetime.now(tz)
today_str = now.strftime("%Y-%m-%d")          # e.g. "2026-06-04"
today_display = now.strftime("%A, %B %-d")    # e.g. "Thursday, June 4"
print(f"DATE={today_str}")
print(f"DISPLAY={today_display}")
```

Store `today_str` and `today_display` — you will need them throughout.

---

## Step 1 — Fetch Calendar Events

Use `terminal` to activate the Hermes venv and run the Google API helper:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py calendar 2>&1
```

The helper returns JSON. Parse it to extract events for **today through the next 3 days**.

Expected JSON shape:
```json
[
  {
    "summary": "Team standup",
    "start": {"dateTime": "2026-06-04T09:00:00-07:00"},
    "end":   {"dateTime": "2026-06-04T09:30:00-07:00"},
    "location": "Zoom"
  }
]
```

Parse with `code_execution`:
```python
import json, sys
from datetime import datetime, timedelta
import pytz

raw = """<PASTE TERMINAL OUTPUT HERE>"""

tz = pytz.timezone("America/Los_Angeles")
now = datetime.now(tz)
cutoff = now + timedelta(days=4)

try:
    events = json.loads(raw)
except Exception as e:
    events = []
    print(f"CALENDAR_ERROR: {e}")

relevant = []
for ev in events:
    start_raw = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
    if not start_raw:
        continue
    try:
        if "T" in start_raw:
            start_dt = datetime.fromisoformat(start_raw).astimezone(tz)
        else:
            start_dt = tz.localize(datetime.fromisoformat(start_raw + "T00:00:00"))
        if now <= start_dt < cutoff:
            relevant.append({
                "summary": ev.get("summary", "(no title)"),
                "start": start_dt.strftime("%a %-I:%M %p"),
                "date": start_dt.strftime("%Y-%m-%d"),
                "location": ev.get("location", ""),
            })
    except Exception:
        pass

relevant.sort(key=lambda e: e["date"])
print(json.dumps(relevant, indent=2))
```

If calendar fetch fails (empty output, auth error, or exception), set `calendar_section = "(calendar unavailable — auth error)"` and continue. Do NOT abort the skill.

---

## Step 2 — Fetch and Classify Gmail

Use `terminal`:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py gmail 2>&1
```

The helper returns JSON for the top 20 unread messages. Parse with `code_execution`:

```python
import json

raw = """<PASTE TERMINAL OUTPUT HERE>"""

EMAIL_CATEGORIES = {
    "ACTION_REQUIRED": [],
    "FYI": [],
    "NEWSLETTER": [],
}

ACTION_KEYWORDS = [
    "action required", "please review", "response needed", "deadline",
    "confirm", "urgent", "asap", "due", "sign", "approve", "invoice",
    "payment", "schedule", "rsvp", "follow up", "reminder", "important",
]
NEWSLETTER_KEYWORDS = [
    "unsubscribe", "newsletter", "digest", "weekly", "monthly", "no-reply",
    "noreply", "marketing", "promotion", "sale", "offer", "deal",
]

try:
    emails = json.loads(raw)
except Exception as e:
    emails = []
    print(f"GMAIL_ERROR: {e}")

for email in emails[:20]:
    subject = (email.get("subject") or "").lower()
    sender = (email.get("from") or "").lower()
    snippet = (email.get("snippet") or "").lower()
    combined = f"{subject} {sender} {snippet}"

    is_newsletter = any(kw in combined for kw in NEWSLETTER_KEYWORDS)
    is_action = any(kw in combined for kw in ACTION_KEYWORDS)

    entry = {
        "from": email.get("from", "unknown"),
        "subject": email.get("subject", "(no subject)"),
        "snippet": email.get("snippet", "")[:120],
    }

    if is_newsletter:
        EMAIL_CATEGORIES["NEWSLETTER"].append(entry)
    elif is_action:
        EMAIL_CATEGORIES["ACTION_REQUIRED"].append(entry)
    else:
        EMAIL_CATEGORIES["FYI"].append(entry)

print(json.dumps(EMAIL_CATEGORIES, indent=2))
```

If Gmail fetch fails, set `email_section = "(inbox unavailable — auth error)"` and continue.

---

## Step 3 — Search GBrain for Active Tasks and Projects

Use the GBrain MCP tool (already connected). Make two searches:

**Search 1 — current tasks:**
Call `gbrain search` with query: `"active tasks due this week"`

**Search 2 — active projects:**
Call `gbrain search` with query: `"current projects status goals"`

Collect the top 5 results from each. If GBrain returns nothing, note "No tasks found in brain" and continue.

---

## Step 4 — Fetch Research News via Exa

Use the `web` tool (Exa) to search for 2-3 research topics relevant to Dhruva's goals.

First, extract research topics from the GBrain results in Step 3 (look for keywords like "learning", "researching", "following", "interested in"). If no topics are found in brain context, use these defaults:
- `"AI agent systems latest 2026"`
- `"machine learning research breakthroughs"`

Run one `web` search per topic. Keep only the top 2 results per query (title + URL + 1-sentence summary). Cap at 4 total results across all topics.

If Exa is unavailable, set `research_section = "(research unavailable)"` and continue.

---

## Step 5 — Compose the Briefing

Using your reasoning (Tier 2 / Sonnet quality), synthesize all gathered data into a concise briefing.

**Send 4 separate Discord messages** — one per section. Each message stays under 1800 characters. Discord has a 2000-character limit; separate messages give each section full space with no truncation.

Use Discord markdown: `**bold**`, bullet points with `-`.

**Message 1 — Header + Calendar**
```
**Good morning, Dhruva.** {{today_display}} — 08:00 PT

📅 **Today**
{{calendar events for today — `HH:MM AM/PM` + title + 📍location if present, one per line}}
{{if no events today: "No events today."}}

📅 **Next 3 days**
{{calendar events for next 3 days — `Day HH:MM` + title, one per line}}
{{skip block if no events}}
```

**Message 2 — Inbox**
```
📬 **Inbox — {{N}} Action Items** | {{today_display}}

{{top 5 ACTION_REQUIRED emails, each on 2 lines:}}
{{N}}. **[sender]** — [subject]
   → [what action is needed] | Due: [deadline or "—"]

_({{M}} FYI + {{K}} newsletters set aside)_
{{if no ACTION_REQUIRED: "📬 Inbox clear — 0 action items."}}
```

**Message 3 — Tasks**
```
✅ **Tasks — {{today_display}}**

{{top 5 tasks from GBrain — one bullet each:}}
- [task name] _(urgency signal if present)_
{{if no tasks: "No tasks in GBrain — run /task-prioritization to load from Notion."}}
```

**Message 4 — Research + Footer** (only if research data available)
```
🔬 **Research Pulse**

{{1–2 research items:}}
- **[title]** — [one sentence] [URL]

_Drew | errors: {{any section errors}}_ 
```

If a section has an error (auth fail, API down), send its message with "⚠️ [section] unavailable — [reason]" instead of skipping entirely.

---

## Step 6 — Save Briefing to Brain

Use the `file` tool to write the final briefing text to:

```
~/brain/daily/briefing-{{today_str}}.md
```

Prepend a markdown header:

```markdown
# Morning Briefing — {{today_display}}

_Generated by Drew at 08:00 PT_

{{full briefing text}}
```

If the `~/brain/daily/` directory does not exist, create it first via `terminal`:

```bash
mkdir -p ~/brain/daily/
```

---

## Step 7 — Post to Discord (4 separate messages)

Use the `messaging` tool to post **4 separate messages** to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings).
Post them in order: Header+Calendar → Inbox → Tasks → Research.
Do NOT ask for approval — internal auto-post. Do NOT combine into one message.

If any individual message fails, log it and continue posting the remaining messages:

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] morning-briefing: message [N] failed" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling Summary

| Failure | Action |
|---------|--------|
| Calendar auth fails | Skip section, note in briefing footer |
| Gmail auth fails | Skip section, note in briefing footer |
| GBrain returns no results | Use "No tasks found" placeholder |
| Exa unavailable | Skip research section |
| Brain file write fails | Log error, continue to Discord post |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

Never abort early due to a single data source failure. The briefing ships even if only partial data is available.

---

## Done Condition

Skill is complete when:
1. All 4 sections composed (with at least 1 non-error section)
2. File written to `~/brain/daily/briefing-{{today_str}}.md`
3. All 4 Discord messages posted to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings)
