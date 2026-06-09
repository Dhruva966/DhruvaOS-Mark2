---
name: meeting-prep-brief
version: 1.1.0
tier: 1
outbound: false
requires_approval: false
description: "Every 30min: check Google Calendar for meetings starting in 30-45 minutes; post attendee background brief to #briefings. Deduplicates within 2-hour window."
daily_token_budget: 8000
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - GOOGLE_CALENDAR_ID
gbrain:
  reads: ["people/*", "daily/*"]
  writes: ["daily/meeting-prep-{{date}}-{{event_id}}.md"]
tests: tests/
metadata:
  hermes:
    tags: [Calendar, Meetings, Briefings, People, Daily]
---

# Meeting Prep Brief

You are Drew, Dhruva's personal AI OS agent. This skill runs every 30 minutes.
Check for any calendar events starting in the next 30–45 minutes. If found,
search GBrain for background on each attendee and post a prep brief to #briefings.

This is an INTERNAL brief to Discord only. Nothing is sent externally.
No approval gate needed. Auto-post directly.

---

## Step 0 — Get Current Time

Use `code_execution`:

```python
from datetime import datetime, timedelta, timezone

tz_offset = -7  # Pacific Daylight Time
import datetime as dt
now = dt.datetime.now(dt.timezone(dt.timedelta(hours=tz_offset)))
window_start = now + dt.timedelta(minutes=30)
window_end = now + dt.timedelta(minutes=45)

print(f"NOW={now.isoformat()}")
print(f"WINDOW_START={window_start.isoformat()}")
print(f"WINDOW_END={window_end.isoformat()}")
print(f"TODAY={now.strftime('%Y-%m-%d')}")
```

---

## Step 1 — Fetch Google Calendar Events

Use `terminal` to call the Google API helper:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py calendar 2>&1
```

Parse the JSON output with `code_execution`:

```python
import json
from datetime import datetime, timedelta, timezone
import datetime as dt

raw = """[TERMINAL OUTPUT]"""

tz_offset = -7
local_tz = dt.timezone(dt.timedelta(hours=tz_offset))
now = dt.datetime.now(local_tz)
window_start = now + dt.timedelta(minutes=30)
window_end = now + dt.timedelta(minutes=45)

try:
    events = json.loads(raw)
except Exception:
    events = []
    print("CALENDAR_ERROR: parse failed")

target_events = []
for ev in events:
    start_raw = (ev.get("start") or {}).get("dateTime") or (ev.get("start") or {}).get("date")
    if not start_raw or "T" not in start_raw:
        continue  # skip all-day events
    try:
        start_dt = dt.datetime.fromisoformat(start_raw).astimezone(local_tz)
    except ValueError:
        continue
    if window_start <= start_dt <= window_end:
        target_events.append({
            "id": ev.get("id", ""),
            "summary": ev.get("summary", "(no title)"),
            "start": start_dt.strftime("%-I:%M %p"),
            "minutes_away": int((start_dt - now).total_seconds() / 60),
            "attendees": [
                a.get("email", "") for a in ev.get("attendees", [])
                if not a.get("self", False)
            ],
        })

print(f"TARGET_EVENT_COUNT={len(target_events)}")
for e in target_events:
    print(json.dumps(e))
```

**If TARGET_EVENT_COUNT is 0: stop here. Silent exit. Do NOT post to Discord.**

If calendar fetch fails entirely (auth error, helper not found), log the error and exit silently:

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] meeting-prep-brief: calendar unavailable" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Step 2 — Deduplication Check

For each target event, check if a briefing was already posted in the last 2 hours.

Call `gbrain search` with query: `"meeting prep brief [EVENT_SUMMARY] [TODAY_DATE]"`

If results mention this exact event was briefed less than 2 hours ago:
skip this event and continue to the next. Post nothing for the duplicate.

---

## Step 3 — Research Each Attendee

For each attendee email/name in the event (skip Dhruva's own address):

1. Derive the person's name from their email (e.g., `alex.chen@company.com` → "Alex Chen")
   or use the `displayName` from the calendar attendee object if available.

2. Call `gbrain search` with query: `"<name> background history role company"`
3. Call `gbrain search` with query: `"<name> <company if known> recent interaction"`

Collect results. If both searches return nothing for an attendee:
mark that attendee as "no GBrain data — background unknown".

**If ALL attendees have no GBrain data: skip this event. Do NOT post a brief with no content.**
A brief with no actual information is not useful.

---

## Step 4 — Compose Brief with GPT-4o-mini (Tier 1)

For each event with at least one attendee having GBrain data,
compose a meeting prep brief.

Use GPT-4o-mini reasoning to synthesize the GBrain search results into:
- Who they are (role, company, 1 sentence)
- Shared history or last interaction date
- 1–2 suggested discussion topics or questions based on context

Keep each attendee section to 3–4 lines max. Total brief under 1500 characters.

Brief format:
```
📋 Meeting prep: <event title> in <N> mins (<start time>)

👤 <Attendee Name>: <role/company — 1 sentence background>
💬 Context: <last interaction or shared history, or "First meeting" if none>
❓ Good questions: <1-2 suggested questions>
```

If multiple attendees have data, stack their sections with a blank line between.

---

## Step 5 — Post to #briefings

Use the `messaging` tool to post to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings).
Keep under 1800 characters. If longer, truncate attendee sections from the bottom
and append `_(+ N more attendees — see GBrain for full context)_`.

---

## Step 6 — Record Briefing in GBrain (Deduplication)

Call `gbrain call extract_facts` with fact:
`"Meeting prep brief posted for event '<EVENT_SUMMARY>' at <TODAY_DATE> <CURRENT_TIME>"`

This allows the next 30-min run to detect the duplicate and skip gracefully.

Also log to skill file:
```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] meeting-prep-brief: posted for '<event>' in <N> mins" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| Calendar API unavailable | Log error, silent exit — do NOT post partial brief |
| All attendees unknown in GBrain | Skip event silently — brief with no data is not useful |
| GPT-4o-mini call fails | Log error, silent exit for that event |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |
| GBrain dedup write fails | Continue — worst case is a duplicate brief (acceptable) |

Never post a brief that is entirely placeholder text with no real context.
Silence is better than noise.

---

## Done Condition

Skill is complete when:
1. Calendar checked for 30–45 minute window
2. For each qualifying event: either brief posted OR silent skip (no data / deduplicated)
3. Deduplication fact written to GBrain for each posted brief
4. Completion logged to skill-errors.log
