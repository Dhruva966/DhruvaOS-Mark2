---
name: wellness-trend
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Sunday 8pm: read 7 daily check-ins, compute weekly wellness averages, compare to prior week, post summary + one suggestion to #briefings."
schedule: "0 20 * * 0"
gbrain:
  reads: ["health/checkins/*", "health/weekly-wellness-*"]
  writes: ["health/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, Wellness, Trend, Phase11, Cron, Sunday]
---

# Wellness Trend

## Purpose
At the end of each week, summarize Dhruva's wellness check-ins (sleep, exercise, energy), compare
to the prior week, and surface one specific, actionable observation in #briefings. Internal-only;
no outbound writing.

## Context
- **Trigger:** Sunday evening cron (see frontmatter `schedule`).
- **Channels:** posts to `DISCORD_BRIEFINGS_CHANNEL_ID`.
- **Data sources:** daily check-in files under `~/brain/health/checkins/`, prior
  `~/brain/health/weekly-wellness-*.md`, and a supplementary GBrain search for context gaps.
- **Tunables:** trend window length, minimum-days-logged threshold for confidence, and
  delta-arrow direction rules live in `~/brain/config/timing.md` and
  `~/brain/config/content-goals.md` (wellness section). Do not hardcode windows or thresholds.
- **Tools:** Tier 1 model (GPT-4o-mini) for the one-line observation+suggestion;
  `gbrain_search`, `gbrain_ingest`, `messaging`.

## Goal
A short #briefings post comparing this week's averages to last week's with directional indicators,
plus one specific suggestion, and a parseable `weekly-wellness-<week-start>.md` file written and
ingested into GBrain.

## Constraints
- No outbound writing. Internal report only — no approval gate required.
- Read the trend window and "low data" cutoff from `~/brain/config/` — never inline numeric
  thresholds in the skill.
- If fewer days are logged than the configured minimum, post a clearly-flagged low-confidence
  summary instead of suppressing it; never fabricate missing values.
- The observation+suggestion must be specific to this week's data (not generic advice); tone is
  thoughtful peer, not clinical.
- If the model call fails, post the metrics block without the note rather than blocking entirely.
- The persisted wellness file must use machine-readable `key: value` lines so future runs can
  parse the prior week without regex fragility.
- GBrain writes are sequential; ingest the new file before the run ends.
- All required env vars must be present before any processing.
- Brain writes use the GBrain single-writer contract — wrap any `gbrain import` / `embed` / `dream` invocation in `flock -n ~/.gbrain/gbrain-write.lock` to prevent concurrent corruption. If the lock is busy, defer to the next stale embed cycle (the file write itself is durable).

## Notes
Runs after weekly-learning-synthesis by cron ordering. Apple Health-derived metrics (resting HR,
calories) belong to `health-ingest`, not this skill.
