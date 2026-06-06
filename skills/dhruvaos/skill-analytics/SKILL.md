---
name: skill-analytics
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Weekly skill health report: invocations, error rates, DEGRADED flags, UNUSED flags → #tasks"
schedule: null
gbrain:
  reads: []
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [analytics, health, monitoring, weekly, skills]
---

# Skill Analytics

You are Drew's weekly skill health analyst. This skill runs every Sunday at 9pm
(`0 21 * * 0`). Your job is to parse 7 days of Hermes gateway logs, compute
per-skill health stats, and post a summary to #tasks.

**Stay completely silent if all skills are healthy** — no Discord message,
no output. Silent exit = everything looks good.

Do NOT require agent-level approval. Do NOT run shell commands — use
`hermes_log_read` to read log content.

---

## Step 1 — Determine the 7-Day Window

Use `code_execution` to compute timestamps:

```python
from datetime import datetime, timedelta, timezone

now = datetime.now(timezone.utc)
week_ago = now - timedelta(days=7)
month_ago = now - timedelta(days=30)

week_ago_str = week_ago.strftime("%Y-%m-%dT%H:%M:%SZ")
month_ago_str = month_ago.strftime("%Y-%m-%dT%H:%M:%SZ")
now_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

print(f"WEEK_AGO={week_ago_str}")
print(f"MONTH_AGO={month_ago_str}")
print(f"NOW={now_str}")
```

Store `week_ago_str`, `month_ago_str`, and `now_str`.

---

## Step 2 — Read Gateway Log (Last 7 Days)

Use `hermes_log_read` to fetch log lines. Request the maximum available lines —
Hermes gateway generates roughly 50–200 lines per skill run, so 7 days at
~20 runs/day ≈ 10,000–30,000 lines. Request at least 30,000 lines:

```
hermes_log_read:
  path: ~/.hermes/logs/gateway.log
  tail_lines: 30000
```

If `hermes_log_read` is unavailable, fall back to direct file read:
```
file_path: ~/.hermes/logs/gateway.log
tail_lines: 30000
```

Store as `log_text`.

If the log file is empty or does not exist, exit silently.

---

## Step 3 — Parse Per-Skill Stats

Use `code_execution` to compute invocation counts, error counts, and last-run
timestamps for each skill:

```python
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

log_text = """<PASTE LOG TEXT HERE>"""
week_ago_str = "<WEEK_AGO>"
month_ago_str = "<MONTH_AGO>"

week_ago = datetime.fromisoformat(week_ago_str.replace("Z", "+00:00"))
month_ago = datetime.fromisoformat(month_ago_str.replace("Z", "+00:00"))

# Hermes log format (ISO timestamp at line start):
# 2026-06-01T08:00:12Z [INFO] [skill:morning-briefing] Starting run
# Also handles: skill=morning-briefing and "running morning-briefing"
TIMESTAMP_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)")
SKILL_RE = re.compile(
    r"\[skill:([a-z0-9_-]+)\]|skill=([a-z0-9_-]+)|running\s+([a-z0-9_-]+)",
    re.IGNORECASE,
)
START_RE = re.compile(r"\b(Starting run|Invoking skill|skill started|run started)\b", re.IGNORECASE)
ERROR_RE = re.compile(r"\b(EXCEPTION|ERROR|FAILED|Traceback)\b", re.IGNORECASE)

# Per-skill data structures
invocations = defaultdict(list)  # skill -> [timestamp of each run start]
errors = defaultdict(int)        # skill -> total error lines
last_seen = {}                   # skill -> most recent timestamp (any log line)

current_skill = None
current_ts = None

for line in log_text.splitlines():
    ts_match = TIMESTAMP_RE.match(line)
    if ts_match:
        try:
            current_ts = datetime.fromisoformat(
                ts_match.group(1).replace("Z", "+00:00")
            )
        except ValueError:
            pass

    skill_match = SKILL_RE.search(line)
    if skill_match:
        current_skill = next(g for g in skill_match.groups() if g)

    if current_skill and current_ts:
        # Track the latest timestamp we've seen for this skill (for UNUSED check)
        if current_skill not in last_seen or current_ts > last_seen[current_skill]:
            last_seen[current_skill] = current_ts

        # Count invocations only within the 7-day window
        if current_ts >= week_ago:
            if START_RE.search(line):
                invocations[current_skill].append(current_ts)
            if ERROR_RE.search(line):
                errors[current_skill] += 1

# Build health summary
all_skills = set(invocations.keys()) | set(errors.keys()) | set(last_seen.keys())

import json

now = datetime.now(timezone.utc)
month_ago = now - timedelta(days=30)

results = {}
for skill in all_skills:
    runs = len(invocations.get(skill, []))
    err = errors.get(skill, 0)
    rate = round((err / runs * 100), 1) if runs > 0 else 0.0
    last = last_seen.get(skill)
    last_run_str = last.strftime("%Y-%m-%d") if last else "never"
    unused = (last is None) or (last < month_ago)
    degraded = rate > 20.0

    results[skill] = {
        "runs": runs,
        "errors": err,
        "error_rate": rate,
        "last_run": last_run_str,
        "degraded": degraded,
        "unused": unused,
    }

print("STATS=" + json.dumps(results, indent=2))
```

Store as `stats`.

---

## Step 4 — Determine Whether to Post

**Exit silently (no output) if ALL skills satisfy:**
- `degraded == false`, AND
- `unused == false`

If any skill is DEGRADED or UNUSED, continue to Step 5.

---

## Step 5 — Compose the Weekly Report

Use `code_execution` to format the report:

```python
import json
from datetime import datetime, timezone

stats = <PASTE STATS JSON HERE>
now = datetime.now(timezone.utc)
report_date = now.strftime("%Y-%m-%d")

degraded = {k: v for k, v in stats.items() if v["degraded"]}
unused = {k: v for k, v in stats.items() if v["unused"] and not v["degraded"]}
healthy = {k: v for k, v in stats.items() if not v["degraded"] and not v["unused"]}

total_runs = sum(v["runs"] for v in stats.values())
total_errors = sum(v["errors"] for v in stats.values())
overall_rate = round(total_errors / total_runs * 100, 1) if total_runs > 0 else 0.0

lines = [
    f"📊 **Weekly Skill Health** — {report_date}",
    f"Total runs: {total_runs} | Errors: {total_errors} ({overall_rate}%)",
    "",
]

if degraded:
    lines.append("🔴 **DEGRADED** (>20% error rate — fix needed):")
    for skill, v in sorted(degraded.items(), key=lambda x: -x[1]["error_rate"]):
        lines.append(
            f"• `{skill}`: {v['runs']} runs, {v['errors']} errors ({v['error_rate']}%)"
        )
        lines.append(f"  → run `hermes logs {skill}` for details")
    lines.append("")

if unused:
    lines.append("⚫ **UNUSED** (no runs in 30 days):")
    for skill, v in sorted(unused.items()):
        lines.append(f"• `{skill}`: last run {v['last_run']}")
    lines.append("")

if healthy:
    healthy_names = ", ".join(f"`{k}`" for k in sorted(healthy.keys()))
    lines.append(f"✅ **Healthy:** {healthy_names}")

message = "\n".join(lines).strip()
# Discord hard limit: 2000 chars
if len(message) > 1950:
    message = message[:1947] + "…"
print(message)
```

Store as `report_message`.

---

## Step 6 — Post to #tasks

Use the `messaging` tool to post `report_message` to `DISCORD_TASKS_CHANNEL_ID`.

```
channel: DISCORD_TASKS_CHANNEL_ID
message: <report_message>
```

Do NOT ask for approval — this is an internal monitoring report only.

If Discord post fails, log:
```
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] skill-analytics: failed to post weekly report" >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling Summary

| Failure | Action |
|---------|--------|
| Log file missing or empty | Exit silently |
| `hermes_log_read` unavailable | Fall back to direct file read |
| All skills healthy | Exit silently — no message |
| Discord post fails | Log to skill-errors.log |
| Parsing error mid-log | Continue with partial data; note in report |

---

## Done Condition

Skill is complete when ONE of:

1. **All healthy** — silent exit with no output
2. **Issues found** — one message posted to `DISCORD_TASKS_CHANNEL_ID` containing:
   - Total runs and error rate for the week
   - DEGRADED skills (>20% error rate) with counts
   - UNUSED skills (0 runs in 30 days) with last-run date
   - Healthy skills list

**Cron setup:**
```bash
hermes cron create "0 21 * * 0" "Skill Analytics" --skill skill-analytics --deliver discord
```
