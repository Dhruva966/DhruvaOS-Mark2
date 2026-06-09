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

## Purpose
Real-time error watchdog for the Hermes gateway. Reads the recent log window, groups problems by
skill (plus GBrain-connection and cron failures), and surfaces a concise alert to `#alerts` only
when something needs attention. This is the upstream half of the self-improvement loop —
`failure-backlog` is the downstream memory half.

## Context
- Trigger: cron every 6 hours
- Channels: `#alerts` (only when errors are present); silent otherwise
- Data sources: `~/.hermes/logs/gateway.log` (tail window) via `hermes_log_read`, with direct file read as fallback
- Tunables: log-window size, per-skill "high error rate" threshold, and message length cap in `~/brain/config/timing.md`
- Tools: `hermes_log_read`, code_execution (parsing), messaging

## Goal
If the recent log window contains skill exceptions, GBrain connection issues, or cron failures,
`#alerts` gets one well-formatted message grouped by skill with a one-line excerpt and a pointer
to the right follow-up command. If nothing is wrong, the skill produces no output.

## Constraints
- Silent exit on empty log, missing log, or a clean window. No "all good" pings.
- Never run shell commands — use `hermes_log_read` (fall back to direct file read only if the tool is unavailable).
- Attribute errors to the most recent skill context line; treat GBrain and cron failures as system-level (not per-skill).
- Keep excerpt lines short enough to read at a glance; truncate before Discord's hard 2000-char limit.
- One Discord post per run, maximum. If posting fails, log to `~/.hermes/logs/skill-errors.log` and exit — do not retry.
- No approval required — this is internal monitoring.
- Companion skill `failure-backlog` runs shortly after on the same log window for fingerprinting and dedup. Keep this skill focused on freshness; do not duplicate that work here.

## Notes
- Output messages should include the right next command per failure type (e.g. `hermes logs <skill>`, `gbrain onboard --check --json`, `hermes cron list`).
- Flag skills with disproportionately high error counts so Dhruva can prioritize, without hardcoding a count threshold here — let the parser surface counts and mark outliers.
