---
name: correction-handler
version: 1.0.0
tier: 2
outbound: false
requires_approval: true
description: "Receive behavioral correction from Dhruva, interpret it, write as permanent GBrain fact. Triggered by /correct command."
schedule: null
gbrain:
  reads: ["concepts/corrections.md"]
  writes: ["concepts/corrections.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
metadata:
  hermes:
    tags: [Corrections, GBrain, Learning, Discord, Command]
---

# Correction Handler

## Purpose
Capture behavioral corrections from Dhruva, interpret them with Tier 2 reasoning, and persist them as durable rules in GBrain so future DhruvaOS sessions retrieve and apply them. This is the mechanism by which the system gets smarter about preferences, facts, and style over time.

## Context
- Trigger: `/correct <text>` posted in Discord #corrections.
- Channels: `DISCORD_CORRECTIONS_CHANNEL_ID` (#corrections) for both inbound command and outbound acknowledgement.
- Data sources: `~/brain/concepts/corrections.md` (read existing log, append new entry).
- Tunables: Check `~/brain/config/content-guidelines.md` for current values on tone, brevity, and rule-statement style; use sensible defaults if missing.
- Tools: file read/write, `gbrain import` + `gbrain embed --stale` via flock, Discord messaging.

## Goal
Each correction is classified (BEHAVIOR / FACT / PREFERENCE / FORMAT), distilled into a clear imperative rule, appended to `~/brain/concepts/corrections.md`, ingested into GBrain, and acknowledged in #corrections. Future GBrain retrieval surfaces the rule wherever relevant.

## Constraints
- Corrections must pass the immutable policy filter — they may refine style/preferences/facts, but must never weaken outbound approval gates, Tier 2+ routing for external text, Discord allowlists, secrets handling, GBrain write locking, or shell-command approval requirements. If a correction conflicts with safety policy, reject it (or accept only a strictly stricter variant). Post a clear refusal in #corrections explaining the conflict.
- Use Tier 2 reasoning for interpretation; the `Permanent rule:` line is the load-bearing artifact and must be a single imperative sentence.
- All GBrain writes go through `flock -n ~/.gbrain/gbrain-write.lock`. If the lock is busy, the markdown file write is the durable record — acknowledge in Discord and let the next stale-embed cycle index it.
- Acknowledgement stays inside #corrections and does not need outbound approval (it is not external text).
- Empty `/correct` invocations get a usage hint posted to #corrections, no GBrain write.

## Notes
- Verify any `gbrain import` flag with `--help` before using; do not assume `--no-embed` or similar exists.
- If interpretation is ambiguous, ask for clarification in #corrections rather than persisting a weak rule.
