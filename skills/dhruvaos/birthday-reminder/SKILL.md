---
name: birthday-reminder
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily 8am: check GBrain + brain/people/ frontmatter for upcoming birthdays (today + 7-day window); post to #alerts."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
gbrain:
  reads: ["people/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, Birthdays, Alerts, Daily]
---

# Birthday Reminder

## Purpose
Each morning, surface any birthdays happening today or in the near-term window so Dhruva can reach out in time. Cross-checks GBrain entities and `~/brain/people/` frontmatter, then posts an internal alert with suggested message snippets for closer relationships. Exists so birthdays for friends and family never get missed.

## Context
- Trigger: daily cron at 8:00am Pacific
- Channels: `DISCORD_ALERTS_CHANNEL_ID` (#alerts) — internal only, never messages the contact
- Data sources: GBrain search (queries scoped to people and birthday context), `~/brain/people/*` markdown frontmatter (look for a `birthday:` field — full `YYYY-MM-DD` or partial `--MM-DD` when year is unknown)
- Tunables: check `~/brain/config/relationship-windows.md` for the look-ahead window length and tier-specific suggested-message behavior; use sensible defaults if missing
- Relationship tiers come from GBrain `relationship_tier` or people-file frontmatter — closer tiers get a suggested-message snippet appended

## Goal
All known people are checked against today's date in Pacific time; anyone with a birthday today or inside the look-ahead window appears in #alerts. Each alert names the person, the date, age (when birth year is known and the date is partial-free), and includes a brief suggested message for closer relationships. A quiet day with no matches is a silent exit. Discord message size limits are respected by splitting into multiple messages if needed.

## Constraints
- Internal only — never message the birthday contact
- Partial `--MM-DD` dates are valid and must be supported (skip age calculation)
- Feb 29 birthdays on non-leap years collapse to Feb 28 for comparison
- Date parse failures on a single record skip that person silently rather than aborting
- If GBrain returns nothing, continue with brain-file scan only; if brain people directory is missing, continue with GBrain only; both empty = silent exit
- Respect Discord per-message size limits — split into multiple posts rather than truncating content
