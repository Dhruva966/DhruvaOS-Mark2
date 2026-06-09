---
name: weekly-learning-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Sunday 9pm: query GBrain for the week's learning, synthesize insights via Sonnet, save to brain/weekly/, post digest to #briefings."
schedule: "0 21 * * 0"
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_BRIEFINGS_CHANNEL_ID
gbrain:
  reads: ["resources/papers/*", "resources/video/*", "resources/media/*", "resources/research-*", "weekly/*"]
  writes: ["weekly/week-YYYY-MM-DD.md"]
tests: tests/
metadata:
  hermes:
    tags: [Synthesis, Weekly, Learning, GBrain, Discord, Briefings, Cron, Sonnet]
---

# Weekly Learning Synthesis

## Purpose
At the end of each week, pull everything that landed in the brain over the last seven days,
synthesize it with Tier 2 reasoning, and produce a single readable digest that surfaces the few
actual learnings, the most interesting cross-domain connection, and one open question worth
chasing next week. The synthesis itself becomes a brain node future weeks can reference.

## Context
- Trigger: Sunday 9pm Pacific cron.
- Channels: `DISCORD_BRIEFINGS_CHANNEL_ID`.
- Data sources: GBrain queries across the week's new papers, videos, podcasts, and research notes;
  prior weekly syntheses for trend context.
- Tunables: rolling window definition and synthesis tone in `~/brain/config/timing.md` and
  `~/brain/config/content-guidelines.md`.
- Tools: multiple `gbrain_search` calls, Tier 2 Claude Sonnet for synthesis, file write under
  `~/brain/weekly/`, `gbrain` import under flock, `messaging`.

## Goal
Each Sunday ends with a dated synthesis file under `~/brain/weekly/`, ingested into GBrain, and a
focused digest posted to #briefings naming the week's key learnings, the standout connection
between something new and something already in the brain, the open question worth carrying
forward, and a brain-growth count.

## Constraints
- Synthesis is internal — no outbound content, no approval gate.
- Tier 2 (Sonnet) is required for the synthesis step; this is reasoning-heavy work that needs the
  better model.
- If the week had nothing ingested, post a short honest "light week" message rather than fabricated
  insights, and skip writing the synthesis file.
- Every learning must be specific and traceable to brain content this week; reject generic filler.
- The synthesis must include exactly one top connection (new-this-week ↔ already-in-brain) and one
  open question — the value is in the focus, not in volume.
- Path safety: weekly file must resolve inside `~/brain/weekly/`.
- GBrain ingest runs under `flock -n ~/.gbrain/gbrain-write.lock`; a busy lock notes-and-continues.
- Partial GBrain query failures degrade gracefully — use what is available and note the gap in the
  synthesis rather than aborting.
- The Discord digest must fit in a single message; trim bullet length before truncating mid-bullet.

## Notes
- The synthesis file is also a brain node, so next week's run can build on the trend.
- If the Sonnet call itself fails, post a minimal raw-titles digest so #briefings still gets the
  weekly heartbeat.
