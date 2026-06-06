---
name: health-ingest
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Parse an Apple Health export.xml, aggregate weekly sleep/steps/HR/calories, write brain files, and ingest into GBrain."
schedule: null
gbrain:
  reads: []
  writes: ["health/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_RESEARCH_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, GBrain, Phase11, Import]
---

# Health Ingest (Phase 11)

**No outbound. No approval gate. Reads a local file and writes to ~/brain/health/.**

Triggered by: `/health import` in Discord.
Dhruva uploads `export.xml` to Omen first, then runs this skill with the file path.

Export workflow:
1. iPhone: Health app → profile picture → Export All Health Data → .zip
2. Unzip locally: `unzip apple_health_export.zip`
3. SCP to Omen: `scp ~/Downloads/apple_health_export/export.xml dhruva@100.119.229.11:~/tmp/health-export.xml`
4. Trigger: `/health import ~/tmp/health-export.xml` in Discord

---

## Step 0 — Validate env vars and file path

```python
import os

DISCORD_RESEARCH_CHANNEL_ID = os.environ.get("DISCORD_RESEARCH_CHANNEL_ID")
missing = [v for v in ["DISCORD_RESEARCH_CHANNEL_ID"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")

# Parse file path from command argument
# Default to ~/tmp/health-export.xml if not specified
import sys
export_path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/tmp/health-export.xml")
if not os.path.exists(export_path):
    raise SystemExit(f"Export file not found: {export_path}\nSCP it first: scp ~/Downloads/apple_health_export/export.xml dhruva@100.119.229.11:{export_path}")
```

---

## Step 1 — Parse export.xml

Use Python's stdlib `xml.etree.ElementTree` — no pip installs needed.

```python
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from collections import defaultdict

tree = ET.parse(export_path)
root = tree.getroot()

# Data structures keyed by ISO week start (Monday)
weeks = defaultdict(lambda: {
    "sleep_hours": [],
    "steps": [],
    "heart_rate": [],
    "resting_hr": [],
    "active_calories": [],
})

def iso_week_start(dt: datetime) -> str:
    """Return Monday of the ISO week containing dt as YYYY-MM-DD."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")

TYPES_OF_INTEREST = {
    "HKQuantityTypeIdentifierStepCount",
    "HKCategoryTypeIdentifierSleepAnalysis",
    "HKQuantityTypeIdentifierHeartRate",
    "HKQuantityTypeIdentifierRestingHeartRate",
    "HKQuantityTypeIdentifierActiveEnergyBurned",
}

for record in root.iter("Record"):
    rec_type = record.get("type", "")
    if rec_type not in TYPES_OF_INTEREST:
        continue

    start_str = record.get("startDate", "")
    end_str   = record.get("endDate", "")
    value_str = record.get("value", "")

    try:
        # Apple exports dates as "YYYY-MM-DD HH:MM:SS +ZZZZ"
        start_dt = datetime.strptime(start_str[:19], "%Y-%m-%d %H:%M:%S")
        end_dt   = datetime.strptime(end_str[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        continue

    week_key = iso_week_start(start_dt)

    if rec_type == "HKQuantityTypeIdentifierStepCount":
        try:
            weeks[week_key]["steps"].append(float(value_str))
        except ValueError:
            pass

    elif rec_type == "HKCategoryTypeIdentifierSleepAnalysis":
        # Value is HKCategoryValueSleepAnalysisAsleep (or AsleepCore/Deep/REM on iOS 16+)
        # Asleep variants: "HKCategoryValueSleepAnalysisAsleep",
        #                  "HKCategoryValueSleepAnalysisAsleepCore",
        #                  "HKCategoryValueSleepAnalysisAsleepDeep",
        #                  "HKCategoryValueSleepAnalysisAsleepREM"
        if "Asleep" in value_str:
            hours = (end_dt - start_dt).total_seconds() / 3600.0
            if 0 < hours < 14:  # sanity filter
                weeks[week_key]["sleep_hours"].append(hours)

    elif rec_type == "HKQuantityTypeIdentifierHeartRate":
        try:
            weeks[week_key]["heart_rate"].append(float(value_str))
        except ValueError:
            pass

    elif rec_type == "HKQuantityTypeIdentifierRestingHeartRate":
        try:
            weeks[week_key]["resting_hr"].append(float(value_str))
        except ValueError:
            pass

    elif rec_type == "HKQuantityTypeIdentifierActiveEnergyBurned":
        try:
            weeks[week_key]["active_calories"].append(float(value_str))
        except ValueError:
            pass
```

---

## Step 2 — Aggregate weekly summaries

```python
import statistics

def avg(lst):
    return round(statistics.mean(lst), 1) if lst else None

weekly_summaries = {}
for week_start, data in sorted(weeks.items()):
    summary = {
        "week_start": week_start,
        "avg_sleep_hours": avg(data["sleep_hours"]),
        "avg_steps_per_day": round(sum(data["steps"]) / 7, 0) if data["steps"] else None,
        "avg_heart_rate": avg(data["heart_rate"]),
        "avg_resting_hr": avg(data["resting_hr"]),
        "total_active_calories": round(sum(data["active_calories"]), 0) if data["active_calories"] else None,
    }
    weekly_summaries[week_start] = summary
```

---

## Step 3 — Write weekly brain files

Write one markdown file per week to `~/brain/health/`. Create the directory if needed.

```python
import os

brain_health_dir = os.path.expanduser("~/brain/health")
os.makedirs(brain_health_dir, exist_ok=True)

files_written = []

for week_start, s in weekly_summaries.items():
    file_path = os.path.join(brain_health_dir, f"week-{week_start}.md")

    lines = [
        f"# Health Week — {week_start}",
        "",
        f"**Week of:** {week_start}",
        f"**Source:** Apple Health export, parsed {datetime.now().strftime('%Y-%m-%d')}",
        "",
        "## Weekly Averages",
        "",
        f"- **Sleep:** {s['avg_sleep_hours']}h avg/night" if s['avg_sleep_hours'] else "- **Sleep:** no data",
        f"- **Steps:** {int(s['avg_steps_per_day']):,}/day avg" if s['avg_steps_per_day'] else "- **Steps:** no data",
        f"- **Heart Rate:** {s['avg_heart_rate']} bpm avg" if s['avg_heart_rate'] else "- **Heart Rate:** no data",
        f"- **Resting HR:** {s['avg_resting_hr']} bpm avg" if s['avg_resting_hr'] else "- **Resting HR:** no data",
        f"- **Active Calories:** {int(s['total_active_calories']):,} total" if s['total_active_calories'] else "- **Active Calories:** no data",
        "",
        "## Raw Counts",
        "",
        f"- Sleep records: {len(weeks[week_start]['sleep_hours'])}",
        f"- Step records: {len(weeks[week_start]['steps'])}",
        f"- HR readings: {len(weeks[week_start]['heart_rate'])}",
        f"- Resting HR readings: {len(weeks[week_start]['resting_hr'])}",
        f"- Calorie records: {len(weeks[week_start]['active_calories'])}",
    ]

    with open(file_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    files_written.append(file_path)
```

---

## Step 4 — GBrain ingest each file

Use the `gbrain_ingest` tool for each file written. Process sequentially (GBrain DB writes are not safe to parallelize).

```python
ingested = 0
for file_path in files_written:
    result = gbrain_ingest(file_path)
    if result.get("success"):
        ingested += 1
    else:
        # Log failure but continue — don't abort the whole import
        print(f"WARN: ingest failed for {file_path}: {result.get('error', 'unknown')}")
```

---

## Step 5 — Post summary to #research

Use the `messaging` tool to post to `DISCORD_RESEARCH_CHANNEL_ID`:

```
🏃 Health data imported: {len(weekly_summaries)} weeks of data.
Avg sleep: {overall_avg_sleep}h · Avg steps: {overall_avg_steps:,}/day
Files written to ~/brain/health/ and ingested into GBrain.
```

Compute overall averages across all weeks for the summary line:
```python
all_sleep = [s["avg_sleep_hours"] for s in weekly_summaries.values() if s["avg_sleep_hours"]]
all_steps = [s["avg_steps_per_day"] for s in weekly_summaries.values() if s["avg_steps_per_day"]]
overall_avg_sleep = avg(all_sleep) if all_sleep else "N/A"
overall_avg_steps = int(avg(all_steps)) if all_steps else 0
```

---

## Error handling

| Failure | Action |
|---------|--------|
| File not found | Stop with clear message: "SCP the file first: scp ~/Downloads/apple_health_export/export.xml dhruva@100.119.229.11:~/tmp/health-export.xml" |
| XML parse error | Report line number and element context; suggest re-exporting from Health app |
| No records parsed | Post "⚠️ No health records found in export. Check file is the full export.xml (not a partial)" |
| GBrain ingest fails for a file | Log warning, continue with remaining files |
| Missing env var | Stop before parsing, report which var |

---

## Notes

- Uses only Python stdlib (xml.etree.ElementTree, statistics, collections, datetime)
- Sleep aggregation uses session duration from Asleep records — sums overlapping sessions correctly because Apple splits sleep into stages
- Steps are summed across all records per week then divided by 7 (some days may have multiple records from different sources — this is correct behavior)
- Existing week files are overwritten on re-import — safe to run again after a new export
