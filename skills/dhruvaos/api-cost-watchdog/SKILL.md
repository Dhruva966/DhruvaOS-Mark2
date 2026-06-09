---
name: api-cost-watchdog
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily 9am: parse Hermes gateway log for LLM API calls in last 24h, estimate cost per tier, alert #alerts if daily spend > $2 or monthly projection > $30."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
gbrain:
  reads: ["goals/*", "notes/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Costs, API, Monitoring, Alerts, Daily]
---

# API Cost Watchdog

You are Drew, Dhruva's personal AI OS agent. This skill runs daily at 9:00am Pacific.
Parse the Hermes gateway log to count LLM API calls per tier in the last 24 hours,
estimate the daily cost, and alert Dhruva if spend is abnormal.

This is an INTERNAL alert to Discord only. Nothing is sent externally.
No approval gate needed. Auto-post directly.

---

## Cost Estimates (rough averages based on typical DhruvaOS skill usage)

| Model | Tier | Est. cost per call |
|-------|------|-------------------|
| claude-sonnet | 2 | $0.003 |
| claude-opus   | 3 | $0.015 |
| gpt-4o-mini   | 1 | $0.0001 |
| phi4-mini     | 0 | $0.0000 (local) |
| gemini-3.1-flash-lite | fallback | ~$0.0001 |

> **Gemini fallback (active):** Gemini calls are included in grep and MODEL_PATTERNS below.

Thresholds:
- Alert if daily Tier 2+3 estimated cost > **$2.00**
- Add monthly projection warning if daily average × 30 > **$30.00**

---

## Step 0 — Determine 24h Window

Use `code_execution`:

```python
from datetime import datetime, timedelta, timezone
now = datetime.now(timezone.utc)
cutoff = now - timedelta(hours=24)
print(f"NOW={now.isoformat()}")
print(f"CUTOFF={cutoff.isoformat()}")
print(f"CUTOFF_SIMPLE={cutoff.strftime('%Y-%m-%dT%H:%M')}")
```

---

## Step 1 — Parse Gateway Log

Use `terminal` to extract relevant lines from the last 24 hours:

```bash
CUTOFF="[CUTOFF_SIMPLE_FROM_STEP_0]"
LOG="$HOME/.hermes/logs/gateway.log"

if [ ! -f "$LOG" ]; then
    echo "LOG_MISSING"
    exit 0
fi

# Extract lines from last 24 hours that mention a model name
grep -E "claude-sonnet|claude-opus|gpt-4o-mini|phi4-mini|gemini" "$LOG" | \
  awk -v cutoff="$CUTOFF" '
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}/ {
        ts = substr($0, 1, 16)
        if (ts >= cutoff) print
    }
  ' | tail -2000
```

If `LOG_MISSING` is returned, post to #alerts:
`⚠️ api-cost-watchdog: ~/.hermes/logs/gateway.log not found — logging may be disabled`
and stop.

---

## Step 2 — Count Calls Per Model and Group by Skill

Use `code_execution` to parse the log lines:

```python
import re
from collections import defaultdict

log_lines = """[TERMINAL OUTPUT FROM STEP 1]"""

MODEL_PATTERNS = {
    "claude-sonnet":          re.compile(r"claude[-._]sonnet",        re.IGNORECASE),
    "claude-opus":            re.compile(r"claude[-._]opus",           re.IGNORECASE),
    "gpt-4o-mini":            re.compile(r"gpt-4o[-._]mini",           re.IGNORECASE),
    "phi4-mini":              re.compile(r"phi4[-._]mini",             re.IGNORECASE),
    "gemini-3.1-flash-lite":  re.compile(r"gemini[-._]3\.1[-._]flash", re.IGNORECASE),
    "gemini":                 re.compile(r"gemini",                    re.IGNORECASE),
}

counts = defaultdict(int)
# Also track calls per skill (best-effort: depends on [skill:name] markers in log)
calls_by_skill = defaultdict(lambda: {"sonnet": 0, "opus": 0, "gpt4omini": 0, "phi4": 0})
current_skill = "unknown"

SKILL_RE = re.compile(
    r"\[skill:([a-z0-9_-]+)\]|skill[=\s]+([a-z0-9_-]+)|running\s+([a-z0-9_-]+)",
    re.IGNORECASE,
)

for line in log_lines.strip().splitlines():
    # Track most recent skill context (best-effort)
    sm = SKILL_RE.search(line)
    if sm:
        current_skill = next((g for g in sm.groups() if g), current_skill)

    for model, pattern in MODEL_PATTERNS.items():
        if pattern.search(line):
            counts[model] += 1
            # Map model to short key for per-skill tracking
            tier_key = {
                "claude-sonnet": "sonnet",
                "claude-opus": "opus",
                "gpt-4o-mini": "gpt4omini",
                "phi4-mini": "phi4",
            }.get(model, "unknown")
            calls_by_skill[current_skill][tier_key] += 1
            break  # count each log line once

COSTS = {
    "claude-sonnet":         0.003,
    "claude-opus":           0.015,
    "gpt-4o-mini":           0.0001,
    "phi4-mini":             0.0,
    "gemini-3.1-flash-lite": 0.0001,
    "gemini":                0.0001,
}

# Per-skill estimated cost
skill_costs = {}
for skill, mc in calls_by_skill.items():
    cost = (mc["sonnet"] * 0.003 + mc["opus"] * 0.015 + mc["gpt4omini"] * 0.0001)
    if cost > 0:
        skill_costs[skill] = {"calls": dict(mc), "est_cost": round(cost, 4)}

top3 = sorted(skill_costs.items(), key=lambda x: -x[1]["est_cost"])[:3]

total_cost = sum(counts[m] * COSTS.get(m, 0) for m in counts)
tier2_cost = counts["claude-sonnet"] * COSTS["claude-sonnet"]
tier3_cost = counts["claude-opus"]   * COSTS["claude-opus"]
tier23_cost = tier2_cost + tier3_cost

print(f"TOTAL_CALLS={sum(counts.values())}")
print(f"SONNET_CALLS={counts['claude-sonnet']}")
print(f"OPUS_CALLS={counts['claude-opus']}")
print(f"GPT4OMINI_CALLS={counts['gpt-4o-mini']}")
print(f"PHI4_CALLS={counts['phi4-mini']}")
print(f"TOTAL_COST={total_cost:.4f}")
print(f"TIER23_COST={tier23_cost:.4f}")
print(f"MONTHLY_PROJ={total_cost * 30:.2f}")
import json
print("TOP3=" + json.dumps(top3))
```

---

## Step 3 — Check Brain for Budget Notes

Call `gbrain search` with query: `"API cost budget monthly spend limit"`

Look for any notes Dhruva has written about expected API spend or budget caps.
If a custom budget is found (e.g., "monthly budget $50"), use that threshold instead of $30.
Note the custom budget in the alert if triggered.

---

## Step 4 — Evaluate and Alert

**If `TIER23_COST` <= 2.00: do NOT post threshold alert. But ALWAYS append a daily summary
line to the completion log (Step 5) so cost trends are visible even on normal days.**

Build the cost summary (for threshold alert OR log line):

```
💸 API cost today: ~$X.XX (Sonnet: N | Opus: M | GPT-4o-mini: K | phi4-mini: L)
📊 Top spenders today: <skill1> ~$X.XX | <skill2> ~$X.XX | <skill3> ~$X.XX
```

If `TOP3` list is empty (no skill markers in log), omit the "Top spenders" line.

**Threshold alert conditions:**

If `TIER23_COST` > 2.00, post the cost summary to `DISCORD_ALERTS_CHANNEL_ID` (#alerts).

If monthly projection (daily × 30) > $30.00, append:
```
⚠️ Monthly projection: ~$X.XX/month — review skill cron frequency
```

**Budget overage check:** Use `terminal` to read `daily_token_budget` fields from deployed skills:

```bash
grep -r "daily_token_budget:" ~/.hermes/skills/dhruvaos/ 2>/dev/null | \
  grep -oP "([a-z0-9_-]+)/SKILL\.md:daily_token_budget: \K[0-9]+" || echo ""
```

For any skill in `TOP3` that has a `daily_token_budget` value, estimate token count as:
`est_tokens = est_cost_usd / 0.003 * 1000` (rough conversion assuming Sonnet pricing).

If `est_tokens > daily_token_budget * 1.5`, append:
```
⚠️ <skill> exceeded budget estimate (actual ~$X.XX, budget ~$Y.YY)
```

If a custom budget from GBrain was found and exceeded, append:
```
🎯 Budget note: [BRAIN_BUDGET_NOTE]
```

Use the `messaging` tool to post to `DISCORD_ALERTS_CHANNEL_ID` (#alerts).

---

## Step 5 — Log Completion

Log to a dedicated cost log (not skill-errors.log — this is normal data, not an error):

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] api-cost-watchdog: sonnet=N opus=M gpt4omini=K daily_cost=$X.XX" \
  >> ~/.hermes/logs/api-cost.log
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| Log file missing | Post warning to #alerts and stop |
| Log file empty (0 calls) | Silent exit — no calls = no cost |
| GBrain budget search fails | Continue with default $30 threshold |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

---

## Done Condition

Skill is complete when:
1. Gateway log parsed for last 24 hours
2. Call counts and cost estimated per model
3. Either: cost alert posted to #alerts, OR silent exit (within normal bounds)
4. Completion logged to skill-errors.log
