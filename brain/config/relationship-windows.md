---
title: "Relationship Windows"
type: config
updated: 2026-06-09
---

# Relationship Windows

How long before Drew nudges Dhruva to reach out. Edit to change check-in frequency by tier.

## Alert thresholds (days since last contact)
- **friend** — alert if > **30 days**
- **professional** — alert if > **60 days**
- **acquaintance** — alert if > **90 days**

## Birthday window
- Alert ahead of birthdays within next **7 days** (in addition to day-of)

## Tier mapping
Source field is `relationship_tier` in GBrain people entries, or Notion `Relationship` / `Role` property.

- "Friend" / "Close Friend" → **friend**
- "Colleague" / "Mentor" / "Professional" / "Network" → **professional**
- Anything else (or missing) → **acquaintance**

## Suggested-message hint
Drew may append a 1-line suggested opener for tier = friend or close friend. Never for professional or acquaintance (avoids feeling formulaic).

## Notes
- Contacts with no `last_contact_date` are skipped silently — Drew never invents dates
- If a relationship is dormant by choice, mark it `tier: dormant` in the person file and Drew will ignore
