---
title: "Cost Thresholds"
type: config
updated: 2026-06-09
---

# Cost Thresholds

Drew checks this file before alerting on API costs. Edit to change alert triggers.

## Daily API cost alert
- Alert if Tier 2 + Tier 3 estimated cost in last 24h exceeds: **$2.00**
- Warn if daily × 30 projection exceeds: **$30.00**

## Per-skill budget overrides
Add entries here when a skill consistently overspends and you want a tighter alert:

```
# skill-name: expected_daily_usd
# morning-briefing: 0.10
```

## Notes
- Tier 0 (phi4-mini, local Ollama) is $0 — never counted
- Tier 1 (GPT-4o-mini) is ~$0.0001/call — usually negligible
- Tier 2 (Claude Sonnet 4.6) and Tier 3 (Claude Opus 4.8) are the monitored tiers
- Cost estimates are rough — actual billing in OpenAI / Anthropic dashboards is canonical
- If Dhruva has written a budget cap into GBrain (e.g., "monthly budget $50"), prefer that over the default
