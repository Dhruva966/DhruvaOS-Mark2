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

## Purpose
Once a day, estimate how much Dhruva spent on LLM API calls over the last 24 hours by parsing the Hermes gateway log, and raise an internal alert if either the daily spend or its monthly projection exceeds budget. Exists so cost surprises surface in #alerts before the credit card does.

## Context
- Trigger: daily cron at 9:00am Pacific
- Channels: `DISCORD_ALERTS_CHANNEL_ID` (#alerts) for threshold alerts; silent on normal days
- Data sources: `~/.hermes/logs/gateway.log` (per-call model invocations), deployed skills under `~/.hermes/skills/dhruvaos/` (for `daily_token_budget` fields)
- Tunables: check `~/brain/config/cost-thresholds.md` for current daily and monthly thresholds and per-model unit costs; use sensible defaults if missing. GBrain may also hold notes about custom budgets — search for relevant budget context before deciding
- Models tracked: claude-sonnet (tier 2), claude-opus (tier 3), gpt-4o-mini (tier 1), phi4-mini (tier 0, local/free)
- Output log: append a daily summary line to `~/.hermes/logs/api-cost.log` (not skill-errors.log — this is normal telemetry)

## Goal
A 24-hour window of API calls is parsed from the gateway log, calls and estimated cost are tallied per model and per skill (best-effort using `[skill:...]` markers), and a daily cost line is appended to `api-cost.log`. If daily Tier 2+3 cost or its 30-day projection exceeds the configured thresholds, an alert is posted to #alerts including the top spending skills and any per-skill budget overruns. Days within bounds exit silently after logging.

## Constraints
- Internal alert only — never sends anything external; no approval gate needed
- Missing gateway log is a real failure mode: post a one-line warning to #alerts and stop
- Empty log (zero calls parsed) is normal — silent exit
- GBrain search failures are non-fatal — fall back to defaults from `cost-thresholds.md`
- Per-skill cost attribution is best-effort; if no skill markers are present in the log, omit the top-spenders line rather than fabricating attribution
- Always append a daily telemetry line even on quiet days so trends remain visible
