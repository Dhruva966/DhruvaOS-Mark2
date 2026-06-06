---
name: tier-watchdog
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily check: detect skills escalating beyond their configured tier >30% of runs → alert #alerts"
schedule: null
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
    tags: [monitoring, tiers, cost, escalation, daily]
---

# Tier Watchdog

You are Drew's tier escalation monitor. This skill runs daily at 6am
(`0 6 * * *`). Your job is to scan the last 7 days of Hermes gateway logs,
detect any skill that is consistently being routed to a higher model tier
than its configured tier, and alert #alerts if the threshold is exceeded.

**Stay completely silent if no skills exceed the 30% escalation threshold.**

Per MODEL_ROUTING.md, escalation >30% of runs in a week triggers a permanent
promotion recommendation. This skill surfaces that signal.

Do NOT require agent-level approval. Do NOT run shell commands.

---

## Tier Map Reference

| Tier | Model |
|------|-------|
| 0 | phi4-mini (Ollama, local) |
| 1 | GPT-4o-mini (OpenAI) |
| 2 | Claude Sonnet 4.6 (Anthropic) |
| 3 | Claude Opus 4.8 (Anthropic) |

---

## Step 1 — Read 7 Days of Gateway Log

Use `hermes_log_read` to fetch the last 30,000 lines of
`~/.hermes/logs/gateway.log` (covers ~7 days of typical traffic):

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

Store as `log_text`. If empty or missing, exit silently.

---

## Step 2 — Parse Configured Tier vs. Actual Tier Per Run

Use `code_execution` to extract escalation data:

```python
import re
from collections import defaultdict

log_text = """<PASTE LOG TEXT HERE>"""

# ── Pattern explanations ────────────────────────────────────────────────────
#
# Hermes logs skill runs with lines like:
#   [skill:morning-briefing] configured_tier=2 actual_tier=2
#   [skill:morning-briefing] model=claude-sonnet-4-6 (tier2)
#   [skill:email-triage] tier escalation: configured=0 used=1
#   [skill:email-triage] routing: phi4-mini → gpt-4o-mini (escalated)
#
# We look for all of the above patterns. If a log line contains both a skill
# reference and a tier/model reference, we record it as one run observation.

SKILL_RE = re.compile(
    r"\[skill:([a-z0-9_-]+)\]|skill=([a-z0-9_-]+)",
    re.IGNORECASE,
)

# Match "configured_tier=N actual_tier=M" or "configured=N used=M"
CONFIG_ACTUAL_RE = re.compile(
    r"configured[_=]tier[=:]?\s*(\d)|configured[=:]?\s*(\d)",
    re.IGNORECASE,
)
ACTUAL_RE = re.compile(
    r"actual[_=]tier[=:]?\s*(\d)|used[=:]?\s*(\d)",
    re.IGNORECASE,
)

# Match escalation signal words
ESCALATION_RE = re.compile(r"\bescalat(ed|ion)\b", re.IGNORECASE)

# Match model name to tier number
MODEL_TIER_MAP = {
    "phi4-mini": 0,
    "phi4": 0,
    "ollama": 0,
    "gpt-4o-mini": 1,
    "gpt-4o": 1,
    "openai": 1,
    "claude-sonnet": 2,
    "sonnet": 2,
    "claude-opus": 3,
    "opus": 3,
}
MODEL_RE = re.compile(
    r"(phi4-mini|phi4|gpt-4o-mini|gpt-4o|claude-sonnet[^\s]*|claude-opus[^\s]*)",
    re.IGNORECASE,
)

# Data: per skill → list of (configured_tier, actual_tier) tuples
escalation_data = defaultdict(list)  # skill -> [(configured, actual)]
current_skill = None

for line in log_text.splitlines():
    skill_match = SKILL_RE.search(line)
    if skill_match:
        current_skill = next(g for g in skill_match.groups() if g)

    if not current_skill:
        continue

    # Case 1: explicit configured + actual tier numbers in the log line
    cfg_m = CONFIG_ACTUAL_RE.search(line)
    act_m = ACTUAL_RE.search(line)
    if cfg_m and act_m:
        configured = int(next(g for g in cfg_m.groups() if g))
        actual = int(next(g for g in act_m.groups() if g))
        escalation_data[current_skill].append((configured, actual))
        continue

    # Case 2: escalation signal word present — actual tier must be inferred
    if ESCALATION_RE.search(line):
        model_m = MODEL_RE.search(line)
        if model_m:
            model_name = model_m.group(1).lower()
            actual = next(
                (t for k, t in MODEL_TIER_MAP.items() if k in model_name), None
            )
            # We don't know configured tier from this line alone — mark as (None, actual)
            if actual is not None:
                escalation_data[current_skill].append((None, actual))

import json
print("RAW=" + json.dumps({k: v for k, v in escalation_data.items()}, default=str))
```

Store as `raw_escalation_data`.

---

## Step 3 — Compute Escalation Rates

Use `code_execution`:

```python
import json

raw = <PASTE RAW JSON HERE>

# For each skill, compute:
#   total_observed = runs where we have tier data
#   escalated      = runs where actual > configured (or actual > 0 when configured unknown)
#   escalation_rate = escalated / total_observed

results = {}
for skill, observations in raw.items():
    total = len(observations)
    if total == 0:
        continue
    escalated = sum(
        1 for (cfg, act) in observations
        if (cfg is not None and act > cfg) or (cfg is None and act > 0)
    )
    rate = round(escalated / total * 100, 1)

    # Infer the "used" tier (most common actual tier)
    actuals = [act for _, act in observations if act is not None]
    used_tier = max(set(actuals), key=actuals.count) if actuals else None

    results[skill] = {
        "total_observed": total,
        "escalated": escalated,
        "escalation_rate": rate,
        "used_tier": used_tier,
        "flag": rate > 30.0,
    }

print("RATES=" + json.dumps(results, indent=2))
```

Store as `rates`.

---

## Step 4 — Determine Whether to Alert

**Exit silently (no output) if NO skill has `flag == true`.**

If any skill has an escalation rate > 30%, continue to Step 5.

---

## Step 5 — Compose the Alert

Use `code_execution`:

```python
import json

rates = <PASTE RATES JSON HERE>

flagged = {k: v for k, v in rates.items() if v["flag"]}

TIER_NAMES = {0: "phi4-mini", 1: "gpt-4o-mini", 2: "claude-sonnet-4-6", 3: "claude-opus-4-8"}

lines = ["⚠️ **Tier Escalation Report** (last 7 days)\n"]

for skill, v in sorted(flagged.items(), key=lambda x: -x[1]["escalation_rate"]):
    runs = v["total_observed"]
    escalated = v["escalated"]
    rate = v["escalation_rate"]
    used_tier = v.get("used_tier")
    tier_name = TIER_NAMES.get(used_tier, f"tier {used_tier}") if used_tier is not None else "unknown"
    next_tier = (used_tier or 0)
    next_tier_name = TIER_NAMES.get(next_tier, f"tier {next_tier}")

    lines.append(f"• `{skill}` escalated **{escalated}/{runs} runs ({rate}%)**")
    lines.append(f"  Actual model used: {tier_name}")
    lines.append(f"  → Consider promoting to tier {next_tier} in `~/.hermes/config.yaml`")
    lines.append(f"  → Command: `hermes skill config {skill} --set tier={next_tier}`")
    lines.append("")

lines.append(
    "_Per MODEL_ROUTING.md: >30% escalation rate in one week = permanent promotion recommended._"
)

message = "\n".join(lines).strip()
if len(message) > 1950:
    message = message[:1947] + "…"
print(message)
```

Store as `alert_message`.

---

## Step 6 — Post to #alerts

Use the `messaging` tool to post `alert_message` to `DISCORD_ALERTS_CHANNEL_ID`.

```
channel: DISCORD_ALERTS_CHANNEL_ID
message: <alert_message>
```

Do NOT ask for approval — this is an internal monitoring alert.

If Discord post fails, log:
```
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] tier-watchdog: failed to post escalation alert" >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling Summary

| Failure | Action |
|---------|--------|
| Log file missing or empty | Exit silently |
| `hermes_log_read` unavailable | Fall back to direct file read |
| No tier data found in logs | Exit silently (Hermes may not log tier on all versions) |
| All skills at or below configured tier | Exit silently |
| Discord post fails | Log to skill-errors.log |

---

## Done Condition

Skill is complete when ONE of:

1. **No escalations exceed 30%** — silent exit with no output
2. **Escalations detected** — one message posted to `DISCORD_ALERTS_CHANNEL_ID` containing:
   - Skill name, escalated run count, total run count, escalation rate %
   - The model tier actually used
   - Recommended promotion command for config.yaml

**Cron setup:**
```bash
hermes cron create "0 6 * * *" "Tier Watchdog" --skill tier-watchdog --deliver discord
```
