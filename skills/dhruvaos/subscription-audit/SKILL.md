---
name: subscription-audit
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Monthly (1st of month, 9am): search GBrain + brain/ for known subscriptions, classify by usage, post audit to #tasks."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
gbrain:
  reads: ["finance/*", "notes/*", "goals/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Finance, Subscriptions, Audit, Monthly, Tasks]
---

# Subscription Audit

You are Drew, Dhruva's personal AI OS agent. This skill runs on the 1st of each month at 9:00am Pacific.
Gather all known subscription services, estimate usage, calculate monthly total,
and post an audit to #tasks for Dhruva to review.

This is an INTERNAL report to Discord only. Nothing is sent externally.
No approval gate needed. Auto-post directly.

---

## Step 0 — Determine Current Month

Use `code_execution`:

```python
from datetime import datetime, timezone

now = datetime.now(timezone.utc)
month_str = now.strftime("%B %Y")   # e.g. "June 2026"
month_abbr = now.strftime("%Y-%m")  # e.g. "2026-06"

print(f"MONTH_STR={month_str}")
print(f"MONTH_ABBR={month_abbr}")
```

---

## Step 1 — Search GBrain for Subscription Data

Make three GBrain searches to cover different memory paths:

1. `gbrain search` with query: `"subscriptions services monthly payments recurring"`
2. `gbrain search` with query: `"SaaS tools software paid plan active"`
3. `gbrain search` with query: `"cancel review unused service"`

Collect all unique results. Deduplicate by service name.

---

## Step 2 — Check Brain for Subscriptions File

Use `terminal` to check if a subscriptions file exists:

```bash
find ~/brain/ -name "subscriptions*" -o -name "subscription*" 2>/dev/null | head -5
ls ~/brain/finance/ 2>/dev/null | grep -i subscri
```

If a file is found, use the `file` tool to read it. Merge its contents with GBrain results.

---

## Step 3 — Extract and Classify Subscriptions with GPT-4o-mini

Compile all gathered text (GBrain results + brain file content) into a single context block.

Use GPT-4o-mini to extract and classify:

**Prompt (Tier 1):**
```
You are analyzing subscription data for Dhruva's personal finance audit.

Given this context about subscriptions, services, and payments:
---
[GATHERED CONTEXT]
---

Extract a structured list of all subscription services mentioned.
For each subscription, provide:
- name: service name
- cost_monthly: estimated monthly cost in USD (or null if unknown)
- usage: one of "frequent" (weekly+), "occasional" (2-4x/month), "rare" (<2x/month), "unknown"
- category: one of Software, Entertainment, Productivity, Learning, Health, Infrastructure, Other
- notes: any relevant note (e.g., "shared plan", "annual", "trial")

Return ONLY a JSON array of objects. No explanation.
If no subscriptions found, return [].
```

Parse the JSON array. Assign `review_flag: true` if `usage` is "rare" or "unknown".

---

## Step 4 — Calculate Totals

Use `code_execution`:

```python
import json

subs = [...]  # list from Step 3

known_cost = [s for s in subs if s.get("cost_monthly") is not None]
unknown_cost = [s for s in subs if s.get("cost_monthly") is None]
to_review = [s for s in subs if s.get("review_flag")]
active = [s for s in subs if not s.get("review_flag")]

monthly_total = sum(s["cost_monthly"] for s in known_cost)
monthly_known_str = f"~${monthly_total:.2f}/month"

print(f"TOTAL_SUBS={len(subs)}")
print(f"TO_REVIEW={len(to_review)}")
print(f"MONTHLY_TOTAL={monthly_total:.2f}")
print(f"UNKNOWN_COUNT={len(unknown_cost)}")
```

---

## Step 5 — Build and Post Audit to #tasks

Build the audit message. Keep under 1800 characters.

```
💳 Monthly Subscription Audit — [MONTH_STR]
Total: ~$[MONTHLY_TOTAL]/month (+ [N] with unknown cost)

✅ Active:
• [Service A]: $X/mo ([category]) — used [frequently/occasionally]
• [Service B]: $X/mo ([category])
...

🔍 Review these:
• [Service C]: $X/mo — used rarely — consider cancelling
• [Service D]: cost unknown — confirm still active
```

If no subscriptions found at all:
```
💳 Monthly Subscription Audit — [MONTH_STR]
⚠️ No subscription data found in GBrain or brain/. 
Add subscriptions to ~/brain/finance/subscriptions.md to enable tracking.
```

If the active list alone exceeds 1800 characters, trim to the 10 most expensive active
subscriptions and append `_(+ N more — see ~/brain/finance/subscriptions.md)_`

Use the `messaging` tool to post to `DISCORD_TASKS_CHANNEL_ID` (#tasks).

---

## Step 6 — Log Completion

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] subscription-audit: [MONTH_ABBR] total=$[MONTHLY_TOTAL] subs=[TOTAL_SUBS] to_review=[TO_REVIEW]" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Error Handling

| Failure | Action |
|---------|--------|
| GBrain returns no results | Continue with brain file only |
| Brain file not found | Continue with GBrain only |
| Both sources empty | Post "no data found" message to #tasks |
| GPT-4o-mini extraction fails | Post raw GBrain results to #tasks with "⚠️ extraction failed" note |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

---

## Done Condition

Skill is complete when:
1. GBrain searched (3 queries) + brain/ file checked
2. GPT-4o-mini extracted and classified subscriptions
3. Audit posted to #tasks (even if "no data" message)
4. Completion logged to skill-errors.log
