---
name: calendar-read
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Fetch Google Calendar events for today + next 7 days and return a formatted agenda block. Composable — designed to be called standalone or embedded in morning-briefing."
schedule: null
gbrain:
  reads: []
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - GOOGLE_CALENDAR_ID
metadata:
  hermes:
    tags: [Calendar, Agenda, Composable, Daily]
---

# Calendar Read

You are fetching Dhruva's calendar events for today through the next 7 days and returning
a clean, human-readable agenda. This skill is composable — morning-briefing may call it
and embed its output.

## Step 1 — Fetch Calendar Events

Use the `terminal` tool to run:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py calendar 2>&1
```

This returns a JSON array of events. Each item has: `summary`, `start`, `end`, `location` (may be absent).

If the command fails, return: "📅 Calendar fetch failed — check Google credentials."

## Step 2 — Parse and Group by Date

From the JSON array:

1. Filter to events whose start date is today or within the next 7 days (inclusive).
2. Group events by date (YYYY-MM-DD).
3. Within each date group, sort by start time ascending.

Use `code_execution` to parse:

```python
import json
from datetime import datetime, timedelta
import pytz

raw = """<PASTE TERMINAL OUTPUT HERE>"""
tz = pytz.timezone("America/Los_Angeles")
now = datetime.now(tz)
cutoff = now + timedelta(days=7)

try:
    events = json.loads(raw)
except:
    events = []

grouped = {}
for ev in events:
    start_raw = ev.get("start", {}) if isinstance(ev.get("start"), dict) else {}
    start_str = ev.get("start", "") if isinstance(ev.get("start"), str) else start_raw.get("dateTime") or start_raw.get("date", "")
    if not start_str:
        continue
    try:
        if "T" in start_str:
            dt = datetime.fromisoformat(start_str).astimezone(tz)
        else:
            dt = tz.localize(datetime.fromisoformat(start_str + "T00:00:00"))
        if now <= dt < cutoff:
            day = dt.strftime("%Y-%m-%d")
            grouped.setdefault(day, []).append({
                "summary": ev.get("summary", "(no title)"),
                "time": dt.strftime("%-I:%M %p") if "T" in start_str else "All day",
                "sort_time": dt.strftime("%H:%M"),
                "location": ev.get("location", ""),
            })
    except:
        pass

for day in sorted(grouped):
    grouped[day].sort(key=lambda e: e.get("sort_time", "00:00"))

print(json.dumps(grouped, indent=2))
```

## Step 3 — Format the Agenda Block

Produce output in this format:

```
📅 **Agenda — [Today's Date, e.g. Wednesday, 4 Jun 2026]**

**Today**
• [HH:MM AM/PM] — [Event Title]
  📍 [Location]   ← omit if no location

**Tomorrow · [Weekday D Mon]**
• [HH:MM AM/PM] — [Event Title]

**[Weekday D Mon]**
• ...
```

All-day events: show as `• All day — [Event Title]`.
Omit date sections with no events.
If the entire 7-day window has no events, return: "📅 No events scheduled for the next 7 days."

## Step 4 — Return the Formatted Agenda

Return the formatted agenda string as your output.
If called from another skill (morning-briefing), the caller embeds this in its message.
If called standalone, post it to Discord `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings).

This skill is READ-ONLY. Do not modify any calendar events.
