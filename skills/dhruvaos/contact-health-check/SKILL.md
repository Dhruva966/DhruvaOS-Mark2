---
name: contact-health-check
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily: scan GBrain + Notion People DB for overdue contact intervals; post alerts to #alerts if any contact window is exceeded."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
    - NOTION_API_KEY
    - NOTION_PEOPLE_DB_ID
gbrain:
  reads: ["people/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, CRM, Alerts, Daily]
---

# Contact Health Check

## Purpose
Once a day, identify people Dhruva is overdue reaching out to based on their relationship tier and last-contact date. Pulls from both GBrain people entities and the Notion People DB, then posts overdue contacts to #alerts so Dhruva can decide whether to reconnect. Internal alert only — never messages the contact.

## Context
- Trigger: daily cron (~8:30am Pacific)
- Channels: `DISCORD_ALERTS_CHANNEL_ID` (#alerts) — internal only
- Data sources: GBrain search across people entities (fields: `name`, `last_contact_date`, `relationship_tier`, `slug`), Notion People DB (`NOTION_PEOPLE_DB_ID`) properties `Name`, `Last Contact`, `Relationship` / `Role`
- Tunables: check `~/brain/config/relationship-windows.md` for the per-tier overdue windows and tier-name mappings (friend / professional / acquaintance, etc.); use sensible defaults if missing
- Deduplication: prefer the GBrain entry when a slug matches across both sources

## Goal
Every known contact is evaluated against the threshold for its relationship tier. Anyone past their tier's window appears in an #alerts post, sorted by how long it has been, with reasonable caps and overflow handling for very long lists. A clean day with no overdue contacts is a silent exit. If both data sources fail entirely, a single warning is posted so Dhruva knows the check did not run.

## Constraints
- Internal alert only — never sends a message to any contact
- Contacts with no last-contact date on file are skipped silently (not flagged)
- A single source failure (GBrain or Notion) is non-fatal: continue with whatever data is available
- Both sources failing → post one warning to #alerts, do not retry silently
- Date parse failures on a single record skip that record silently
- Respect Discord per-message size limits with sensible caps and an overflow line pointing to `~/brain/people/`
