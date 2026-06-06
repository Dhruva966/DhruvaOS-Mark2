---
name: daily-checkin
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Log a daily wellness check-in (sleep, exercise, energy) to brain and GBrain. Nightly cron posts a reminder; /checkin command collects answers via clarify."
schedule: "0 22 * * *"
gbrain:
  reads: ["health/checkins/*"]
  writes: ["health/checkins/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - DISCORD_ALERTS_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, Checkin, Wellness, Phase11, Cron]
---

# Daily Check-in (Phase 11)

**No outbound. No approval gate. Internal logging only.**

Two execution paths:

**A — Nightly cron (10pm):** Posts a reminder to #briefings. No data collection.
**B — /checkin command:** Collects wellness answers, writes brain file, updates streaks.

Cron setup:
```bash
hermes cron create "0 22 * * *" "Daily check-in reminder" --skill daily-checkin --deliver discord
```

---

## Path A — Nightly Cron Reminder (10pm)

When triggered by cron (no command argument present):

Post to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings):
```
🌙 Daily check-in — reply `/checkin` to log today's wellness
```

No further steps. Done.

---

## Path B — /checkin Command

When triggered by `/checkin` Discord command.

### Step 0 — Validate env vars

```python
import os

missing = [v for v in ["DISCORD_BRIEFINGS_CHANNEL_ID", "DISCORD_ALERTS_CHANNEL_ID"]
           if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

### Step 1 — Ask 3 check-in questions via clarify

Use the `clarify` tool to send ONE message and wait for ONE reply. Ask all three questions together so Dhruva answers in a single message:

```
How did you sleep last night? (hours or quality: great/ok/bad)
Did you exercise today? (yes/no/what)
Overall energy level today? (1-10)
```

Timeout: 5 minutes. If no reply, post "⏱ Check-in timed out — run /checkin again when ready." and stop.

---

### Step 2 — Parse answers with phi4-mini (Tier 0)

Pass the raw user reply to the local phi4-mini model for structured extraction.

Prompt to phi4-mini:
```
Parse this wellness check-in reply into structured JSON. Return ONLY valid JSON, no explanation.

User reply: "{user_reply}"

Expected JSON:
{
  "sleep_raw": "<original text about sleep>",
  "sleep_hours": <number or null — estimate from quality if no hours given: great=7.5, ok=6.5, bad=5.5>,
  "sleep_quality": "<great|ok|bad|unknown>",
  "exercise": <true|false>,
  "exercise_description": "<what they did, or 'none'>",
  "energy": <1-10 or null>,
  "notes": "<any other context from the reply>"
}
```

If phi4-mini returns malformed JSON, fall back to simple regex parsing:
- Sleep: look for number + "h" or "hours"; quality keywords
- Exercise: "yes" / "no" / named activity
- Energy: any digit 1-10

---

### Step 3 — Write check-in file

Write to `~/brain/health/checkins/YYYY-MM-DD.md`. Create directory if needed.

```python
from datetime import datetime
import os

today = datetime.now().strftime("%Y-%m-%d")
checkin_dir = os.path.expanduser("~/brain/health/checkins")
os.makedirs(checkin_dir, exist_ok=True)
file_path = os.path.join(checkin_dir, f"{today}.md")

content = f"""# Daily Check-in — {today}

**Sleep:** {parsed["sleep_raw"]} (~{parsed["sleep_hours"]}h) [{parsed["sleep_quality"]}]
**Exercise:** {"Yes — " + parsed["exercise_description"] if parsed["exercise"] else "No"}
**Energy:** {parsed["energy"]}/10

*Logged: {datetime.now().strftime("%Y-%m-%d %H:%M")}*
"""

with open(file_path, "w") as f:
    f.write(content)
```

---

### Step 4 — Calculate exercise streak

Read the last 7 daily checkin files to compute streak.

```python
from datetime import date, timedelta

today_date = date.today()
streak = 0
streak_broken_was = 0

# Walk backwards from yesterday (today not yet in historical context)
for days_back in range(1, 8):
    check_date = today_date - timedelta(days=days_back)
    path = os.path.join(checkin_dir, f"{check_date.isoformat()}.md")
    if not os.path.exists(path):
        break
    content = open(path).read()
    if "Exercise: No" in content or "Exercise:** No" in content:
        streak_broken_was = streak if streak >= 3 else 0
        break
    streak += 1

# Today's exercise also counts
today_exercised = parsed["exercise"]
if today_exercised:
    streak += 1
else:
    streak_broken_was = streak if streak >= 3 else 0
    streak = 0
```

---

### Step 5 — GBrain ingest

```python
gbrain_ingest(file_path)
```

---

### Step 6 — Post streak alerts if applicable

If today_exercised AND streak >= 3, add streak note to confirmation.

If streak was broken (streak_broken_was >= 3 and not today_exercised):
Post to `DISCORD_ALERTS_CHANNEL_ID` (#alerts):
```
💪 Exercise streak broken (was {streak_broken_was} days). Back at it tomorrow!
```

---

### Step 7 — Post confirmation to #briefings

Use the `messaging` tool to post to `DISCORD_BRIEFINGS_CHANNEL_ID`:

Base confirmation:
```
✅ Check-in logged. Sleep: {parsed["sleep_hours"]}h, Exercise: {"Yes — " + parsed["exercise_description"] if parsed["exercise"] else "No"}, Energy: {parsed["energy"]}/10
```

If exercise streak >= 3 (including today):
```
✅ Check-in logged. Sleep: {parsed["sleep_hours"]}h, Exercise: {parsed["exercise_description"]}, Energy: {parsed["energy"]}/10
🔥 Exercise streak: {streak} days
```

---

## Error handling

| Failure | Action |
|---------|--------|
| clarify timeout | Post "⏱ Check-in timed out" to #briefings and stop |
| phi4-mini parse failure | Fall back to regex; if regex also fails, write raw reply and note "(unparsed)" |
| Brain file write fails | Post "⚠️ Could not write check-in file: {error}" to #briefings |
| GBrain ingest fails | Log warning, still post confirmation (ingest can be retried via gbrain import) |
| Missing env var | Stop immediately, report which var is missing |

---

## Notes

- Sleep quality estimates when no hours given: great ≈ 7.5h, ok ≈ 6.5h, bad ≈ 5.5h
- Streak counts consecutive days with any exercise (including "walk" or "stretch")
- Streak is recalculated fresh each run — no separate state file needed
- If today's checkin file already exists, overwrite it (duplicate /checkin runs are safe)
