---
name: subscription-audit
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Monthly (1st of month, 9am): search GBrain + brain/ for known subscriptions, classify by usage, post audit to #tasks."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
gbrain:
  reads: ["finance/*", "notes/*", "goals/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Finance, Subscriptions, Audit, Monthly, Tasks]
---

# Subscription Audit

## Purpose
Once a month, sweep GBrain and `~/brain/` for known recurring subscriptions, classify them by
usage frequency, total the monthly burn, and surface anything Dhruva should reconsider — posted
to #tasks for human review.

## Context
- **Trigger:** monthly cron on the 1st (cron set via `hermes cron create`, not skill YAML).
- **Channels:** posts to `DISCORD_TASKS_CHANNEL_ID` (#tasks). No external sends.
- **Data sources:** GBrain finance/notes/goals namespaces, plus any
  `~/brain/finance/subscriptions*.md` file.
- **Tunables:** spend tiers, "review threshold" (cost x usage), category taxonomy, the
  monthly-total alert ceiling, and the post-length cap live in
  `~/brain/config/cost-thresholds.md`. Usage labels ("frequent / occasional / rare / unknown")
  and how they map to a review flag also live there.
- **Tools:** Tier 1 model (GPT-4o-mini) for extraction+classification from gathered context;
  `gbrain_search` (multiple complementary queries); local file read; `messaging`.

## Goal
A single #tasks post listing active subscriptions, flagged-for-review subscriptions, and the
known monthly total — or a clearly-actionable "no data found, add subscriptions here" message
when neither GBrain nor the brain file has anything.

## Constraints
- Read-only against finance data: no writes back to brain or GBrain, no outbound.
- All thresholds (cost tiers, review trigger, monthly total alert, output length cap) come from
  `~/brain/config/cost-thresholds.md`. Do not hardcode dollar values or usage bands.
- Category and usage taxonomies are fixed in config — do not invent new labels.
- Deduplicate subscriptions across data sources by normalized service name before classifying.
- If extraction fails, post the raw gathered context with an explicit "extraction failed" flag
  rather than silently dropping the audit.
- Unknown-cost subscriptions must be counted and surfaced separately from the known monthly
  total — never imputed.
- When the post exceeds the configured length cap, trim to the most expensive active items and
  link to the brain file rather than truncating mid-section.
- All required env vars must be present before any processing.
