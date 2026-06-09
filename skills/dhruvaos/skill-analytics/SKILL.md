---
name: skill-analytics
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Weekly skill health report: invocations, error rates, DEGRADED flags, UNUSED flags → #tasks"
schedule: "0 21 * * 0"
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

## Purpose
Weekly per-skill health review. Parses the recent Hermes gateway log, computes invocations and
error rates per skill, flags chronically failing ("degraded") and unused skills, and posts the
summary to `#tasks` so Dhruva can decide what to fix, retire, or promote.

## Context
- Trigger: cron every Sunday evening
- Channels: `#tasks` (weekly report); silent when everything is healthy
- Data sources: `~/.hermes/logs/gateway.log` (7-day window) via `hermes_log_read`, direct file read as fallback
- Tunables: weekly-window length, unused-threshold age, degraded error-rate threshold in `~/brain/config/timing.md`
- Tools: `hermes_log_read`, code_execution (parsing + stats), messaging

## Goal
A single weekly `#tasks` message that surfaces degraded skills (chronic error rate), unused
skills (no recent runs), overall run/error totals, and a quick healthy-list — enough for Dhruva
to take action in one read. On weeks where everything is healthy, the skill produces nothing.

## Constraints
- Silent exit on missing/empty log or when nothing crosses the degraded / unused bars.
- No shell commands; use `hermes_log_read` with direct file read as fallback.
- Read enough lines to cover a full 7-day window of typical traffic — over-request rather than under-request.
- Use timestamps to bucket runs into the weekly window; ignore log entries that fall outside it.
- Single Discord post; truncate before the 2000-char hard limit if needed.
- No approval required. Internal report only.
- Don't hardcode thresholds in the skill body — defer to `~/brain/config/timing.md` so policy can shift without code changes.

## Notes
- Sort degraded skills by error rate descending and include a follow-up command per skill (e.g. `hermes logs <skill>`).
- For unused skills, show the last-run date so Dhruva can decide whether to retire or kickstart them.
- Include a one-line aggregate (total runs, total errors, overall error rate) at the top for quick scanning.
