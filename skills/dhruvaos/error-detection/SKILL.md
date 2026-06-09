---
name: error-detection
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Scan Hermes gateway log every 6h; alert #alerts if any skill errors or GBrain failures detected"
schedule: "0 */6 * * *"
gbrain:
  reads: []
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
metadata:
  hermes:
    tags: [monitoring, errors, logs, alerts, health]
---

# Error Detection

You are Drew's error-detection watchdog. This skill runs every 6 hours via cron
(`0 */6 * * *`). Your job is to scan the Hermes gateway log for errors, group
them by skill, and post a summary to #alerts if anything needs attention.

**Stay completely silent if no errors are found.** An empty stdout means no
Discord message is posted (Hermes --no-agent delivers stdout to Discord).

Do NOT require approval. Do NOT run shell commands — use `hermes_log_read` to
read log content.

---

## Step 1 — Read the Last 500 Lines of Gateway Log

Use `hermes_log_read` to fetch the last 500 lines of `~/.hermes/logs/gateway.log`.

If `hermes_log_read` is unavailable, fall back to reading the file directly:
```
file_path: ~/.hermes/logs/gateway.log
tail_lines: 500
```

Store the raw log text as `log_lines` (a list of strings, one per line).

If the log file does not exist or is empty, exit silently with no output.

---

## Step 2 — Parse Errors by Skill

Use `code_execution` to parse the log lines:

```python
import re
from collections import defaultdict

log_lines = """<PASTE LOG LINES HERE>""".strip().splitlines()

# Patterns that indicate a skill error
ERROR_PATTERNS = [
    r"\bEXCEPTION\b",
    r"\bERROR\b",
    r"\bFAILED\b",
    r"\btraceback\b",
    r"\bTraceback\b",
]

# GBrain-specific failure patterns
GBRAIN_PATTERNS = [
    r"gbrain.*connection",
    r"MCP.*error",
    r"localhost:3131.*fail",
    r"gbrain.*timeout",
    r"gbrain.*refused",
]

# Cron failure patterns
CRON_PATTERNS = [
    r"cron.*fail",
    r"scheduled.*fail",
    r"cron.*error",
]

# Regex to extract skill name from Hermes log lines.
# Hermes log format: [ISO-TIMESTAMP] [LEVEL] [skill:SKILL_NAME] message
# Also matches: skill=SKILL_NAME or running SKILL_NAME
SKILL_RE = re.compile(
    r"\[skill:([a-z0-9_-]+)\]|skill=([a-z0-9_-]+)|running\s+([a-z0-9_-]+)",
    re.IGNORECASE,
)

ERROR_RE = re.compile("|".join(ERROR_PATTERNS), re.IGNORECASE)
GBRAIN_RE = re.compile("|".join(GBRAIN_PATTERNS), re.IGNORECASE)
CRON_RE = re.compile("|".join(CRON_PATTERNS), re.IGNORECASE)

errors_by_skill = defaultdict(list)
gbrain_failures = []
cron_failures = []
current_skill = "unknown"

for line in log_lines:
    # Track the most recent skill context
    m = SKILL_RE.search(line)
    if m:
        current_skill = next(g for g in m.groups() if g) or current_skill

    # GBrain connection failures (attributed to system, not one skill)
    if GBRAIN_RE.search(line):
        gbrain_failures.append(line.strip()[-200:])
        continue

    # Cron failures
    if CRON_RE.search(line):
        cron_failures.append(line.strip()[-200:])
        continue

    # General skill errors
    if ERROR_RE.search(line):
        errors_by_skill[current_skill].append(line.strip()[-200:])

# Filter: only skills with >3 errors in this window
high_error_skills = {
    skill: errs
    for skill, errs in errors_by_skill.items()
    if len(errs) >= 1  # report any, flag >3 separately
}

print(f"ERROR_SKILLS={len(high_error_skills)}")
print(f"GBRAIN_FAILURES={len(gbrain_failures)}")
print(f"CRON_FAILURES={len(cron_failures)}")

import json
print("DATA=" + json.dumps({
    "by_skill": {k: {"count": len(v), "last": v[-1]} for k, v in high_error_skills.items()},
    "gbrain": {"count": len(gbrain_failures), "last": gbrain_failures[-1] if gbrain_failures else None},
    "cron": {"count": len(cron_failures), "last": cron_failures[-1] if cron_failures else None},
}))
```

Store the parsed `DATA` dict as `error_data`.

---

## Step 3 — Determine Whether to Alert

**Exit silently (no output) if ALL of the following are true:**

- `error_data["by_skill"]` is empty, AND
- `error_data["gbrain"]["count"]` == 0, AND
- `error_data["cron"]["count"]` == 0

If any errors exist, continue to Step 4.

---

## Step 4 — Compose the Alert Message

Use `code_execution` to format the alert:

```python
import json

error_data = <PASTE DATA JSON HERE>

lines = ["🚨 **Hermes Error Report** (last 500 log lines)\n"]

# ── Skill errors ──────────────────────────────────────────────
skill_errors = error_data.get("by_skill", {})
if skill_errors:
    lines.append("**Skill Errors:**")
    for skill, info in sorted(skill_errors.items(), key=lambda x: -x[1]["count"]):
        count = info["count"]
        last_msg = info["last"][:100]  # hard cap at 100 chars
        flag = " ⚠️ HIGH" if count > 3 else ""
        lines.append(f"• `{skill}` — {count} error(s){flag}")
        lines.append(f"  Last: `{last_msg}`")
        lines.append(f"  → run `hermes logs {skill}` for full trace")
    lines.append("")

# ── GBrain failures ───────────────────────────────────────────
gbrain = error_data.get("gbrain", {})
if gbrain.get("count", 0) > 0:
    last = (gbrain.get("last") or "")[:100]
    lines.append(f"**GBrain Connection Failures:** {gbrain['count']}")
    lines.append(f"  Last: `{last}`")
    lines.append(f"  → check `gbrain onboard --check --json`")
    lines.append("")

# ── Cron failures ─────────────────────────────────────────────
cron = error_data.get("cron", {})
if cron.get("count", 0) > 0:
    last = (cron.get("last") or "")[:100]
    lines.append(f"**Cron Failures:** {cron['count']}")
    lines.append(f"  Last: `{last}`")
    lines.append(f"  → check `hermes cron list`")
    lines.append("")

message = "\n".join(lines).strip()
# Discord hard limit: 2000 chars
if len(message) > 1950:
    message = message[:1947] + "…"
print(message)
```

Store as `alert_message`.

---

## Step 5 — Post to #alerts

Use the `messaging` tool to post `alert_message` to `DISCORD_ALERTS_CHANNEL_ID`.

```
channel: DISCORD_ALERTS_CHANNEL_ID
message: <alert_message>
```

Do NOT ask for approval before posting — this is an internal monitoring alert only.

If the Discord post fails, log to `~/.hermes/logs/skill-errors.log`:
```
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] error-detection: failed to post alert to Discord" >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling Summary

| Failure | Action |
|---------|--------|
| Log file missing or empty | Exit silently — no alert |
| `hermes_log_read` unavailable | Fall back to direct file read |
| Parsing produces no errors | Exit silently — no alert |
| Discord post fails | Log to skill-errors.log; do not retry |

---

## Done Condition

Skill is complete when:

1. Log parsed — all 500 lines scanned for ERROR, EXCEPTION, FAILED, Traceback, GBrain
   connection errors, and cron failures
2. Errors grouped by skill name with counts and last-message excerpts (≤100 chars each)
3. If any errors found: one message posted to `DISCORD_ALERTS_CHANNEL_ID`
4. If no errors found: silent exit with no output

**Cron setup:**
```bash
hermes cron create "0 */6 * * *" "Error Detection" --skill error-detection --deliver discord
```

**Companion skill:** `failure-backlog` runs at `5 */6 * * *` (5 min later) and reads the
same gateway log to fingerprint errors, deduplicate against GBrain history, and alert on
REPEATED failures. These two skills are deliberately independent — no sub-skill dispatch
needed. failure-backlog handles failure memory; this skill handles real-time alerting.
