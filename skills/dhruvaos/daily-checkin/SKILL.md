---
name: daily-checkin
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Log a daily wellness check-in (sleep, exercise, energy) to brain and GBrain. Nightly cron posts a reminder; /checkin command collects answers via clarify."
schedule: "0 22 * * *"
gbrain:
  reads: ["health/checkins/*"]
  writes: ["health/checkins/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - DISCORD_ALERTS_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, Checkin, Wellness, Phase11, Cron]
---

# Daily Check-in

## Purpose
Capture a lightweight nightly wellness snapshot (sleep, movement, energy) so trends and streaks
become visible over time in the brain, and so the rest of DhruvaOS can reason about Dhruva's
state. Internal logging only — no outbound, no approval gate.

## Context
- Trigger: two paths — a 10pm nightly cron that only posts a reminder, and an on-demand `/checkin`
  command that collects the answers and writes the brain file.
- Channels: `DISCORD_BRIEFINGS_CHANNEL_ID` (reminder + confirmation),
  `DISCORD_ALERTS_CHANNEL_ID` (streak-broken alert).
- Data sources: prior days' files under `~/brain/health/checkins/` for streak calculation.
- Tunables: reminder cadence in `~/brain/config/timing.md`; what counts as "exercise", streak
  thresholds, and sleep-quality-to-hours estimates in `~/brain/config/relationship-windows.md`
  (or a dedicated health config if Dhruva adds one).
- Tools: `clarify` (single-message question + reply), phi4-mini (Tier 0 structured parsing),
  filesystem write under `~/brain/health/checkins/`, GBrain ingest, `messaging`.

## Goal
For the cron path: a single short reminder lands in #briefings. For the `/checkin` path: a dated
markdown file is written under `~/brain/health/checkins/`, ingested into GBrain, and a
confirmation posted in #briefings that includes the current exercise streak if it is meaningful;
a streak-broken note posts to #alerts only when a real streak just ended.

## Constraints
- Two paths, one skill: a cron invocation with no user reply only posts the reminder and stops.
- The `/checkin` path asks for the day's wellness signals in a single `clarify` round — let the
  agent compose the prompt from context (sleep, movement, energy) rather than hardcoding the
  exact wording. One message, one reply.
- Parse the reply with phi4-mini (Tier 0) into structured fields; fall back to simple regex if the
  model returns malformed JSON, and if even that fails, persist the raw reply with an "(unparsed)"
  marker rather than dropping data.
- One file per day at `~/brain/health/checkins/YYYY-MM-DD.md`; re-running on the same day overwrites
  cleanly.
- Streak math is recomputed from the file history each run — no separate state file to drift.
- Only alert on a broken streak when the streak that just ended was actually meaningful (threshold
  lives in config, not in the skill).
- Required env vars must be present; stop and report if missing.
- Internal only: no outbound, no approval gate, no Tier 2+ calls.

## Notes
- `clarify` timeout should yield a friendly "ran out of time, try again" reply rather than a
  silent failure.
- If GBrain ingest fails, the brain file is still durable and can be re-imported via
  `flock -n ~/.gbrain/gbrain-write.lock gbrain import <path>`.
