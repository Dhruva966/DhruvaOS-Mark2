---
name: failure-backlog
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Runs 5 min after error-detection (0 5,11,17,23 + 5 min = 5 */6 * * *): fingerprint errors from gateway log, check GBrain failure-log for repeats, backlog new failures silently, alert #alerts for repeated failures. Gives Hermes memory of known-bad skills to skip retries."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
daily_token_budget: 2000
gbrain:
  reads: ["system/failure-log.md"]
  writes: ["system/failure-log.md"]
tests: tests/
metadata:
  hermes:
    tags: [monitoring, failures, memory, deduplication, backlog, token-efficiency]
---

# Failure Backlog

You are Drew's failure-backlog watchdog. This skill runs every 6 hours at 5 minutes past
the hour (cron: `5 */6 * * *`), always 5 minutes after error-detection finishes.

Your job: read the gateway log, fingerprint each unique error, look up GBrain to see if
we've seen it before, record new failures silently, and alert #alerts for REPEATED failures.

**This gives Hermes failure memory.** Known-bad skills don't need expensive retries — they
need to be fixed. Repeated failures escalating through tiers burn tokens for nothing.

Stay completely **silent** (no Discord post) for new failures — they're just logged to the
brain. Only REPEATED failures (seen in a prior run) get a Discord post.

Do NOT require approval. This is internal monitoring only.

---

## Step 0 — Read Last 500 Lines of Gateway Log

Use `hermes_log_read` to fetch the last 500 lines of `~/.hermes/logs/gateway.log`.

If `hermes_log_read` is unavailable, fall back to direct file read:
```
file_path: ~/.hermes/logs/gateway.log
tail_lines: 500
```

Store raw log text as `log_lines`. If the file does not exist or is empty, exit silently
with no output.

---

## Step 1 — Parse Errors from Log

Use `code_execution` to extract error entries from the log:

```python
import re
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

log_lines = """<PASTE LOG LINES HERE>""".strip().splitlines()

# Gateway log format: YYYY-MM-DD HH:MM:SS,mmm LEVEL module.name: message
# Example: 2026-06-08 08:35:40,919 INFO gateway.run: Cron ticker stopped
TIMESTAMP_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")

ERROR_PATTERNS = [
    r"\bEXCEPTION\b",
    r"\bERROR\b",
    r"\bFAILED\b",
    r"\btraceback\b",
    r"\bTraceback\b",
]

GBRAIN_PATTERNS = [
    r"gbrain.*connection",
    r"MCP.*error",
    r"localhost:3131.*fail",
    r"gbrain.*timeout",
    r"gbrain.*refused",
]

CRON_PATTERNS = [
    r"cron.*fail",
    r"scheduled.*fail",
    r"cron.*error",
]

# Regex to extract skill name from Hermes log lines
SKILL_RE = re.compile(
    r"\[skill:([a-z0-9_-]+)\]|skill[=\s]+([a-z0-9_-]+)|running\s+([a-z0-9_-]+)",
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
    m = SKILL_RE.search(line)
    if m:
        current_skill = next((g for g in m.groups() if g), current_skill)

    if GBRAIN_RE.search(line):
        gbrain_failures.append(line.strip()[-200:])
        continue

    if CRON_RE.search(line):
        cron_failures.append(line.strip()[-200:])
        continue

    if ERROR_RE.search(line):
        errors_by_skill[current_skill].append(line.strip()[-200:])

error_data = {
    "by_skill": {k: {"count": len(v), "last": v[-1]} for k, v in errors_by_skill.items()},
    "gbrain": {"count": len(gbrain_failures), "last": gbrain_failures[-1] if gbrain_failures else None},
    "cron": {"count": len(cron_failures), "last": cron_failures[-1] if cron_failures else None},
}

total_errors = (
    sum(info["count"] for info in error_data["by_skill"].values())
    + error_data["gbrain"]["count"]
    + error_data["cron"]["count"]
)

print(f"TOTAL_ERRORS={total_errors}")
print("ERROR_DATA=" + json.dumps(error_data))
```

If `TOTAL_ERRORS` == 0, exit silently — nothing to backlog.

---

## Step 2 — Fingerprint All Errors

Use `code_execution` to compute fingerprints for all errors found:

```python
import hashlib
import json

error_data = <PASTE ERROR_DATA JSON>

def fingerprint(skill_name: str, last_msg: str) -> str:
    # Normalize: lowercase, strip timestamps/IDs, take first 80 chars
    normalized = re.sub(r"\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[\d,]*", "", last_msg)
    normalized = normalized.lower().strip()[:80]
    raw = f"{skill_name}|{normalized}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

fingerprinted = []

for skill_name, info in error_data["by_skill"].items():
    fp = fingerprint(skill_name, info["last"] or "")
    fingerprinted.append({
        "fingerprint": fp,
        "skill": skill_name,
        "error_type": "skill_error",
        "count": info["count"],
        "last_msg": (info["last"] or "")[:80],
    })

if error_data["gbrain"]["count"] > 0:
    fp = fingerprint("gbrain", error_data["gbrain"]["last"] or "")
    fingerprinted.append({
        "fingerprint": fp,
        "skill": "gbrain",
        "error_type": "gbrain_failure",
        "count": error_data["gbrain"]["count"],
        "last_msg": (error_data["gbrain"]["last"] or "")[:80],
    })

if error_data["cron"]["count"] > 0:
    fp = fingerprint("cron", error_data["cron"]["last"] or "")
    fingerprinted.append({
        "fingerprint": fp,
        "skill": "cron",
        "error_type": "cron_failure",
        "count": error_data["cron"]["count"],
        "last_msg": (error_data["cron"]["last"] or "")[:80],
    })

print("FINGERPRINTED=" + json.dumps(fingerprinted))
```

Store as `fingerprinted_errors`.

---

## Step 3 — Load Existing Failure Log from GBrain

Use the GBrain MCP tool to search for the failure log:

Call `gbrain search` with query: `"system failure-log fingerprint open"`

Also attempt direct read of `~/brain/system/failure-log.md`.

Use `code_execution` to parse the existing log:

```python
import re, json
from pathlib import Path

failure_log_path = Path.home() / "brain" / "system" / "failure-log.md"

known_failures = {}  # fingerprint -> {first_seen, last_seen, count, skill, status}

if failure_log_path.exists():
    content = failure_log_path.read_text(encoding="utf-8")
    # Parse entries by fingerprint
    # Each entry format:
    # ### `<fp>` — <skill_name>
    # - **first_seen:** YYYY-MM-DD
    # - **last_seen:** YYYY-MM-DD
    # - **count:** N
    # - **status:** open|resolved
    # - **last_msg:** `<message>`
    entry_re = re.compile(
        r"###\s+`([a-f0-9]{16})`\s+—\s+([^\n]+)\n"
        r".*?- \*\*first_seen:\*\* ([^\n]+)\n"
        r".*?- \*\*last_seen:\*\* ([^\n]+)\n"
        r".*?- \*\*count:\*\* (\d+)\n"
        r".*?- \*\*status:\*\* ([^\n]+)",
        re.DOTALL,
    )
    for m in entry_re.finditer(content):
        fp, skill, first_seen, last_seen, count, status = m.groups()
        known_failures[fp.strip()] = {
            "first_seen": first_seen.strip(),
            "last_seen": last_seen.strip(),
            "count": int(count.strip()),
            "skill": skill.strip(),
            "status": status.strip(),
        }

print(f"KNOWN_FAILURES_COUNT={len(known_failures)}")
print("KNOWN=" + json.dumps(known_failures))
```

---

## Step 4 — Classify: New vs. Repeated

Use `code_execution` to classify errors:

```python
import json
from datetime import date

today_iso = date.today().isoformat()

fingerprinted = <PASTE FINGERPRINTED JSON>
known_failures = <PASTE KNOWN JSON>

repeated = []  # fingerprints seen before this run
new_fps = []   # fingerprints not seen before

for err in fingerprinted:
    fp = err["fingerprint"]
    if fp in known_failures and known_failures[fp].get("status", "open") != "resolved":
        # Update existing entry
        known_failures[fp]["count"] += err["count"]
        known_failures[fp]["last_seen"] = today_iso
        known_failures[fp]["last_msg"] = err["last_msg"]
        repeated.append({**err, **known_failures[fp]})
    else:
        # Brand new failure
        known_failures[fp] = {
            "first_seen": today_iso,
            "last_seen": today_iso,
            "count": err["count"],
            "skill": err["skill"],
            "status": "open",
            "last_msg": err["last_msg"],
        }
        new_fps.append(err)

print(f"NEW={len(new_fps)} REPEATED={len(repeated)}")
print("UPDATED_KNOWN=" + json.dumps(known_failures))
print("REPEATED_LIST=" + json.dumps(repeated))

# Emit skip-retry hint to stdout (Hermes captures this in skill logs)
skip_skills = [r["skill"] for r in repeated if r["skill"] not in ("gbrain", "cron")]
if skip_skills:
    print("SKIP_RETRY=" + json.dumps(skip_skills))
```

---

## Step 5 — Write Updated Failure Log (flock guarded)

Use `code_execution` to build the updated failure-log.md content:

```python
from pathlib import Path
import json
from datetime import datetime, timezone

known_failures = <PASTE UPDATED_KNOWN JSON>

now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

lines = [
    "---",
    'title: "System Failure Backlog"',
    f'date: "{now_iso[:10]}"',
    'tags: ["system", "failures", "monitoring", "backlog"]',
    'source: "failure-backlog"',
    "---",
    "",
    "# System Failure Backlog",
    "",
    f"_Last updated: {now_iso} by failure-backlog_",
    "",
]

open_failures = {fp: v for fp, v in known_failures.items() if v.get("status") != "resolved"}
resolved_failures = {fp: v for fp, v in known_failures.items() if v.get("status") == "resolved"}

if open_failures:
    lines.append("## Open Failures")
    lines.append("")
    for fp, info in sorted(open_failures.items(), key=lambda x: -x[1]["count"]):
        lines.append(f"### `{fp}` — {info['skill']}")
        lines.append(f"- **first_seen:** {info['first_seen']}")
        lines.append(f"- **last_seen:** {info['last_seen']}")
        lines.append(f"- **count:** {info['count']}")
        lines.append(f"- **status:** {info.get('status', 'open')}")
        lines.append(f"- **last_msg:** `{info.get('last_msg', '')[:80]}`")
        lines.append("")

if resolved_failures:
    lines.append("## Resolved Failures")
    lines.append("")
    for fp, info in resolved_failures.items():
        lines.append(f"### `{fp}` — {info['skill']} ✅")
        lines.append(f"- **resolved:** {info.get('resolved_date', 'unknown')}")
        lines.append(f"- **total_count:** {info['count']}")
        lines.append("")

content = "\n".join(lines)
print("CONTENT_LEN=" + str(len(content)))
print("FAILURE_LOG_CONTENT=" + content)
```

Then write the file and re-ingest using `terminal`:

```bash
# Ensure brain/system/ directory exists
mkdir -p ~/brain/system/

# Write the updated failure log
cat > ~/brain/system/failure-log.md << 'FAILURELOG_EOF'
<FAILURE_LOG_CONTENT from code_execution above>
FAILURELOG_EOF

# Re-ingest into GBrain (flock guard prevents concurrent writes)
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:$PATH"
GBRAIN_BIN=$(command -v gbrain || echo "/home/dhruva/.bun/bin/gbrain")

flock -n ~/.gbrain/gbrain-write.lock sh -lc \
  "$GBRAIN_BIN import ~/brain/system/failure-log.md 2>&1 && $GBRAIN_BIN embed --stale 2>&1" \
  || echo "[failure-backlog] gbrain-write.lock busy — file written, ingest deferred (do not retry)"
```

If `flock` reports lock busy: log "deferred" and continue to Step 6. Do NOT retry.

---

## Step 6 — Alert Discord for Repeated Failures Only

**New failures → no Discord post. Silently logged to brain.**

For each repeated failure (already in failure-log.md before this run):

Use `code_execution` to format the alert:

```python
import json

repeated_list = <PASTE REPEATED_LIST JSON>

if not repeated_list:
    # Nothing to alert — exit silently
    exit()

alert_lines = ["⚠️ **Repeated Failure Report**\n"]

for r in repeated_list[:5]:  # cap at 5 to stay under Discord 2000-char limit
    alert_lines.append(
        f"🔁 `{r['skill']}` — seen **{r['count']}×** since {r['first_seen']}"
    )
    alert_lines.append(f"   Last: `{r['last_msg'][:80]}`")
    alert_lines.append(f"   ID: `{r['fingerprint'][:8]}`")
    alert_lines.append("")

if len(repeated_list) > 5:
    alert_lines.append(f"_(+ {len(repeated_list) - 5} more in ~/brain/system/failure-log.md)_")

message = "\n".join(alert_lines).strip()
# Discord hard limit: 2000 chars
if len(message) > 1950:
    message = message[:1947] + "…"

print(message)
```

Post `message` using the `messaging` tool to `DISCORD_ALERTS_CHANNEL_ID` (#alerts).

Do NOT ask for approval — this is an internal monitoring alert.

If Discord post fails, log to `~/.hermes/logs/skill-errors.log`:
```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] failure-backlog: failed to post repeated-failure alert" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| Log file missing or empty | Exit silently — nothing to backlog |
| `hermes_log_read` unavailable | Fall back to direct file read |
| GBrain search fails | Continue with empty `known_failures = {}` (treat all as new) |
| GBrain write lock busy | Log "deferred" to stdout, do not retry, continue to Step 6 |
| No repeated failures | Exit silently after writing failure-log.md |
| Discord post fails | Log to skill-errors.log; do not retry |

---

## Done Condition

Skill is complete when ONE of:

1. **Empty log / no errors**: silent exit, no file modification
2. **New failures only**: failure-log.md written with new entries, no Discord post, `SKIP_RETRY=[]` emitted to stdout
3. **Repeated failures found**: failure-log.md updated with incremented counts, Discord alert posted to `DISCORD_ALERTS_CHANNEL_ID`, `SKIP_RETRY=["skill-a", ...]` emitted to stdout
4. **Lock busy**: failure-log.md written (durable), ingest deferred, alert still posted if repeats exist

**Cron setup** (run 5 min after error-detection which runs at `0 */6 * * *`):
```bash
hermes cron create "5 */6 * * *" "Failure Backlog" --skill failure-backlog --deliver discord
```
