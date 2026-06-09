---
name: health-ingest
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Parse an Apple Health export.xml, aggregate weekly sleep/steps/HR/calories, write brain files, and ingest into GBrain."
schedule: null
gbrain:
  reads: []
  writes: ["health/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_RESEARCH_CHANNEL_ID
metadata:
  hermes:
    tags: [Health, GBrain, Phase11, Import]
---

# Health Ingest

## Purpose
Turn a manually-uploaded Apple Health `export.xml` into weekly wellness summaries in the brain
and GBrain. Local-only, no outbound, no approval gate — Dhruva initiates each import explicitly.

## Context
- **Trigger:** `/health import <path>` in Discord (Dhruva SCPs `export.xml` to Omen first).
- **Channels:** posts only to `DISCORD_RESEARCH_CHANNEL_ID` (#research).
- **Data sources:** local `export.xml` (Apple Health Records); nothing else.
- **Tunables:** sanity bounds and which `HKQuantityType` identifiers to aggregate live in
  `~/brain/config/content-goals.md` (health section). Do not invent thresholds inline.
- **Tools:** Python stdlib only (`xml.etree.ElementTree`, `statistics`, `datetime`); `gbrain_ingest`
  for each written file; `messaging` for the summary post.

## Goal
Weekly markdown summaries exist under `~/brain/health/week-<YYYY-MM-DD>.md` covering every ISO week
in the export, each one ingested into GBrain, and a single brief confirmation posted to #research.

## Constraints
- No outbound writing. No approval gate (this is a local read+write skill only).
- **Data minimization:** never post raw health values, individual records, or per-day series to
  Discord. The #research confirmation may include aggregate averages only (e.g., "N weeks imported")
  and must omit anything that could identify medical specifics.
- Brain files store aggregated weekly stats only — no raw per-record dumps.
- Re-imports overwrite existing week files; do not append duplicates.
- Sleep aggregation counts any Apple `Asleep*` category variant; filter implausible durations using
  the sanity bounds in `~/brain/config/content-goals.md`.
- GBrain ingest is sequential, never parallel — one file at a time. A single ingest failure logs
  and continues; it does not abort the import.
- If the file is missing or unparseable, post a single actionable error to #research telling
  Dhruva exactly how to re-SCP and retry — no stack traces in Discord.
- All required env vars must be present before parsing begins.
- Brain writes use the GBrain single-writer contract — wrap any `gbrain import` / `embed` / `dream` invocation in `flock -n ~/.gbrain/gbrain-write.lock` to prevent concurrent corruption. If the lock is busy, defer to the next stale embed cycle (the file write itself is durable).
