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

## Purpose
Failure-memory half of the self-improvement loop. Fingerprints errors from the recent Hermes
log window, deduplicates against `system/failure-log.md` in the brain, and only escalates to
`#alerts` when a failure is a *repeat*. Known-bad skills shouldn't burn tokens being retried
silently — this skill gives Hermes a persistent memory of them.

## Context
- Trigger: cron every 6 hours, scheduled 5 minutes after `error-detection`
- Channels: `#alerts` only when there are repeated failures; silent for first-time failures and clean runs
- Data sources: `~/.hermes/logs/gateway.log` tail, `~/brain/system/failure-log.md` (canonical state), GBrain search as a search aid
- Tunables: log window size, fingerprint length, repeated-failure message cap in `~/brain/config/timing.md`
- Tools: `hermes_log_read`, code_execution (parsing, fingerprinting), GBrain search, terminal (flock + import + embed), messaging

## Goal
Every error in the window is fingerprinted, classified as new or repeat against the existing
backlog, and persisted in `system/failure-log.md` with first-seen / last-seen / count / status.
Repeated open failures get one consolidated `#alerts` post; new failures stay silent. A
`SKIP_RETRY=[...]` hint is emitted to stdout so Hermes can avoid expensive retries on
known-bad skills.

## Constraints
- Always acquire `flock` on `~/.gbrain/gbrain-write.lock` before writing the file or running ingest. If the lock is busy, the file write still goes through but ingest is deferred to the next run — do not retry within this run.
- Silent on first-time failures: they're logged to the brain, not paged.
- Repeated failure = same fingerprint, status `open`, seen in a prior run. Only those go to Discord.
- Fingerprint must be stable across runs — normalize timestamps and IDs out of the error string before hashing.
- One Discord post per run, max. Truncate the list of repeats before Discord's hard length limit.
- No approval required. No outbound to anything except `#alerts`.
- Treat GBrain search failure as "no known failures" and proceed; do not block on it.

## Notes
- Stay aligned with `error-detection` on log-window size and error patterns so the two skills see the same surface.
- `SKIP_RETRY=[...]` line on stdout is the integration point with Hermes' retry logic — keep emitting it even on a no-alert run when there are persistent opens.
- Resolved entries stay in the file (under a Resolved section) for historical context but never feed the repeat-alert path.
