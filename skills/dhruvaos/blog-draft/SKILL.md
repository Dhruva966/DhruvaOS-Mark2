---
name: blog-draft
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a 600-900 word blog post with Sonnet, preview in #corrections, publish via personal-site-update only after explicit Dhruva 👍 approval."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "weekly/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [Blog, Outbound, Phase13, Quality-Firewall, Writing, Tier2]
---

# Blog Draft

## Purpose
Draft a personal blog post grounded in Dhruva's own brain context, preview it for review in Discord, and hand the approved draft to personal-site-update for publishing. Optimized for authentic builder voice, not announcement-style filler.

## Context
- Trigger: `/blog "<title>"` in Discord #corrections or #tasks
- Channels: preview + approval flows through #corrections
- Data sources: GBrain (projects, goals, weekly notes) for context relevant to the title
- Tunables: see `~/brain/config/content-guidelines.md` and `~/brain/config/content-goals.md` for length, voice, structure, and audience expectations
- Tools: GBrain search, Claude Sonnet (Tier 2), Discord messaging + clarify, personal-site-update as downstream skill

## Goal
A blog draft that reflects current brain context is previewed in #corrections; on explicit 👍 from Dhruva, it is handed off to personal-site-update for commit. Without that approval, nothing publishes and the draft is discarded.

## Constraints
- Tier 2 (Sonnet 4.6) mandatory. Approval required on every run, no exceptions.
- Reactor identity check: reaction must come from DISCORD_ALLOWED_USER account; reject otherwise.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- If the preview message is edited after posting, treat the approval as invalid.
- Never publish without approval; never retry a failed publish silently.
- Do not name private systems (DhruvaOS, Drew, Hermes, GBrain) in outbound copy.
- Voice, length, structure, and ending style follow `~/brain/config/content-guidelines.md`.
- If GBrain returns no relevant context, draft from the title alone and disclose that in the preview footer.
- Drafts are not persisted to brain before approval; personal-site-update writes the committed version.

## Notes
- The downstream skill (personal-site-update) owns all GitHub commit logic; this skill never touches the repo directly.
- Approval window length and reminder cadence are governed by `~/brain/config/timing.md`.
