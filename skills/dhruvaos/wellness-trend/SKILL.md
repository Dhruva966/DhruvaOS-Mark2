---
name: wellness-trend
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Sunday 8pm: read 7 daily check-ins, compute weekly wellness averages, compare to prior week, post summary + one suggestion to #briefings."
schedule: "0 20 * * 0"
gbrain:
  reads: ["health/checkins/*", "health/weekly-wellness-*"]
  writes: ["health/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, Wellness, Trend, Phase11, Cron, Sunday]
---

# Wellness Trend (Phase 11)

**Cron: Sunday 8pm. No outbound. No approval gate. Tier 1 (GPT-4o-mini) for summary.**

Cron setup:
```bash
hermes cron create "0 20 * * 0" "Weekly wellness trend" --skill wellness-trend --deliver discord
```

---

## Step 0 — Validate env vars

```python
import os

missing = [v for v in ["DISCORD_BRIEFINGS_CHANNEL_ID"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

## Step 1 — GBrain context search

```python
results = gbrain_search("health checkin sleep exercise energy this week")
gbrain_context = results.get("answer", "")
```

Use this to supplement file-based data if any checkin files are missing.

---

## Step 2 — Read last 7 daily checkin files

```python
from datetime import date, timedelta
import os, re

checkin_dir = os.path.expanduser("~/brain/health/checkins")
today = date.today()

this_week_data = []
for days_back in range(7):
    check_date = today - timedelta(days=days_back)
    path = os.path.join(checkin_dir, f"{check_date.isoformat()}.md")
    if not os.path.exists(path):
        this_week_data.append({"date": check_date.isoformat(), "missing": True})
        continue

    text = open(path).read()

    # Parse sleep hours from "~Xh" or "~X.Xh"
    sleep_match = re.search(r'~([\d.]+)h', text)
    sleep_hours = float(sleep_match.group(1)) if sleep_match else None

    # Parse exercise
    exercise = "Exercise:** Yes" in text or "Exercise: Yes" in text

    # Parse energy from "Energy: X/10"
    energy_match = re.search(r'Energy:\*\*? (\d+)/10|Energy: (\d+)/10', text)
    energy = int(energy_match.group(1) or energy_match.group(2)) if energy_match else None

    this_week_data.append({
        "date": check_date.isoformat(),
        "sleep_hours": sleep_hours,
        "exercise": exercise,
        "energy": energy,
        "missing": False,
    })
```

---

## Step 3 — Calculate this week's averages

```python
import statistics

def safe_avg(values):
    vals = [v for v in values if v is not None]
    return round(statistics.mean(vals), 1) if vals else None

sleep_vals  = [d["sleep_hours"] for d in this_week_data if not d.get("missing")]
energy_vals = [d["energy"]      for d in this_week_data if not d.get("missing") and d.get("energy")]
exercise_days = sum(1 for d in this_week_data if not d.get("missing") and d.get("exercise"))

this_week = {
    "avg_sleep":    safe_avg(sleep_vals),
    "exercise_days": exercise_days,
    "avg_energy":   safe_avg(energy_vals),
    "days_logged":  sum(1 for d in this_week_data if not d.get("missing")),
}
```

---

## Step 4 — Compare to previous week

Read last week's wellness summary if it exists:

```python
last_sunday = today - timedelta(days=7)
prev_week_path = os.path.expanduser(f"~/brain/health/weekly-wellness-{last_sunday.isoformat()}.md")

prev_week = None
if os.path.exists(prev_week_path):
    prev_text = open(prev_week_path).read()
    prev_sleep_match  = re.search(r'avg_sleep:\s*([\d.]+)', prev_text)
    prev_energy_match = re.search(r'avg_energy:\s*([\d.]+)', prev_text)
    prev_ex_match     = re.search(r'exercise_days:\s*(\d+)', prev_text)
    prev_week = {
        "avg_sleep":    float(prev_sleep_match.group(1))  if prev_sleep_match  else None,
        "avg_energy":   float(prev_energy_match.group(1)) if prev_energy_match else None,
        "exercise_days": int(prev_ex_match.group(1))      if prev_ex_match     else None,
    }

def delta_arrow(current, previous):
    """Return ↑, ↓, or → based on comparison. Returns '' if no previous."""
    if previous is None or current is None:
        return ""
    if current > previous:
        return "↑"
    elif current < previous:
        return "↓"
    return "→"

sleep_arrow  = delta_arrow(this_week["avg_sleep"],    prev_week["avg_sleep"]    if prev_week else None)
energy_arrow = delta_arrow(this_week["avg_energy"],   prev_week["avg_energy"]   if prev_week else None)
ex_arrow     = delta_arrow(this_week["exercise_days"], prev_week["exercise_days"] if prev_week else None)
```

---

## Step 5 — Generate summary with Sonnet (Tier 2 quality, Tier 1 model)

Note: This is a Tier 1 skill using GPT-4o-mini for cost efficiency. The summary is internal (not outbound), so Tier 1 is appropriate.

Pass week data to the model and request a brief wellness observation + one actionable suggestion:

Prompt:
```
Dhruva's wellness data for the week of {today - timedelta(days=6)} to {today}:

Sleep: {this_week["avg_sleep"]}h avg/night ({sleep_arrow} from {prev_week["avg_sleep"] if prev_week else "no prior data"})
Exercise: {this_week["exercise_days"]}/7 days ({ex_arrow})
Energy: {this_week["avg_energy"]}/10 avg ({energy_arrow})
Days logged: {this_week["days_logged"]}/7

Write ONE brief, specific observation and ONE concrete actionable suggestion (not generic advice).
Keep total response under 40 words. Tone: direct, like a thoughtful friend, not a doctor.
```

Store the model response as `wellness_note`.

---

## Step 6 — Post to #briefings

Use the `messaging` tool to post to `DISCORD_BRIEFINGS_CHANNEL_ID`:

```
💚 Weekly Wellness
Sleep: {this_week["avg_sleep"]}h avg {sleep_arrow}{"from " + str(prev_week["avg_sleep"]) + "h" if prev_week and prev_week["avg_sleep"] else ""}
Exercise: {this_week["exercise_days"]}/7 days {ex_arrow}
Energy: {this_week["avg_energy"]}/10 avg {energy_arrow}

Note: {wellness_note}
```

If fewer than 3 days were logged this week, add:
```
⚠️ Only {this_week["days_logged"]}/7 check-ins logged — data may be incomplete.
```

---

## Step 7 — Save weekly wellness file and ingest

```python
from datetime import datetime

week_start = (today - timedelta(days=6)).isoformat()
output_path = os.path.expanduser(f"~/brain/health/weekly-wellness-{week_start}.md")

file_content = f"""# Weekly Wellness — {week_start}

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Days logged:** {this_week["days_logged"]}/7

## Metrics
avg_sleep: {this_week["avg_sleep"]}
exercise_days: {this_week["exercise_days"]}
avg_energy: {this_week["avg_energy"]}

## Prior Week
prev_avg_sleep: {prev_week["avg_sleep"] if prev_week else "N/A"}
prev_exercise_days: {prev_week["exercise_days"] if prev_week else "N/A"}
prev_avg_energy: {prev_week["avg_energy"] if prev_week else "N/A"}

## Note
{wellness_note}
"""

with open(output_path, "w") as f:
    f.write(file_content)

gbrain_ingest(output_path)
```

---

## Error handling

| Failure | Action |
|---------|--------|
| No check-in files found | Post "💚 Weekly Wellness — no check-in data found. Run /checkin daily to track trends." |
| Model call fails | Post raw data without the Note section; skip note rather than blocking |
| GBrain search fails | Proceed with file-based data only |
| File write fails | Post summary to Discord still; log the write error |
| Missing env var | Stop before any processing |

---

## Notes

- Skill runs after weekly-learning-synthesis (8pm vs 7pm) — ordered by cron schedule naturally
- The wellness summary is intentionally brief — Dhruva can drill into daily checkin files for detail
- Metrics stored in the brain file use machine-readable format (key: value) for easy future parsing
- Resting HR and calorie data (from Apple Health) are not tracked here — those come from health-ingest
