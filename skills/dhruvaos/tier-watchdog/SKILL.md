---
name: tier-watchdog
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily check: detect skills escalating beyond their configured tier >30% of runs → alert #alerts"
schedule: "0 6 * * *"
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

## Purpose
Daily cost-and-routing sentinel. Inspects the last week of Hermes gateway logs to detect skills
that are being escalated to a higher model tier than their configured one. When the
escalation rate is high enough to warrant permanent promotion (per `MODEL_ROUTING.md`), it
surfaces the signal to `#alerts`.

## Context
- Trigger: daily cron at 06:00
- Channels: `#alerts` only when the escalation signal fires; silent otherwise
- Data sources: `~/.hermes/logs/gateway.log` (7-day window) via `hermes_log_read`, with direct file read as fallback; tier policy in `MODEL_ROUTING.md`
- Tunables: escalation-rate trigger threshold and weekly-window length in `~/brain/config/cost-thresholds.md` (with timing in `~/brain/config/timing.md`)
- Tools: `hermes_log_read`, code_execution (parsing + rates), messaging

## Goal
For each skill observed over the week, compute the escalation rate (runs where the actual tier
exceeded the configured tier). If any skill exceeds the policy threshold, post a consolidated
`#alerts` message naming the skill, the run counts, the rate, the tier actually in use, and the
recommended promotion command. If nothing crosses the threshold, stay silent.

## Constraints
- Threshold is policy, not code — defer to `~/brain/config/cost-thresholds.md`. Do not hardcode the percentage.
- Use explicit `configured_tier`/`actual_tier` log entries when present; fall back to model-name inference only when the log line lacks numeric tiers.
- Silent on missing/empty logs, on logs without tier data, and on weeks where no skill crosses the threshold.
- No shell commands; `hermes_log_read` with direct file read as fallback.
- One Discord post per run, max; truncate before the 2000-char hard limit.
- No approval required. Internal monitoring.
- The tier name map (phi4-mini → 0, gpt-4o-mini → 1, claude-sonnet → 2, claude-opus → 3) follows `MODEL_ROUTING.md` and the project root `CLAUDE.md`; pull live model IDs from there, not from this skill body.

## Notes
- Sort flagged skills by escalation rate descending and include both the actual tier in use and the suggested target tier so Dhruva can act in one read.
- Cite `MODEL_ROUTING.md` policy in the alert footer so the recommendation is auditable.
- An empty log or absent tier instrumentation is a quiet no-op, not an error — Hermes may not log tier on every version.
