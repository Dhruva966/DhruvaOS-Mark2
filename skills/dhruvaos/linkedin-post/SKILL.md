---
name: linkedin-post
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a LinkedIn post, preview in #corrections, post only after explicit Dhruva approval via local Playwright (headless Chromium on Omen)."
schedule: null
gbrain:
  reads: ["people/*", "projects/*", "goals/*"]
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
    tags: [LinkedIn, Outbound, Phase5, Quality-Firewall, Playwright]
---

# LinkedIn Post

## Purpose
Draft a LinkedIn post grounded in Dhruva's recent work and trajectory, preview it for approval in Discord, then publish via a headless Chromium session on Omen using stored LinkedIn cookies. Thoughtful builder voice, not corporate promotion.

## Context
- Trigger: `/linkedin <context or topic>` in Discord
- Channels: preview + approval flows through #corrections
- Data sources: GBrain (people, projects, goals) for recent context worth sharing
- Tunables: see `~/brain/config/content-guidelines.md` for voice, length, hashtag/emoji limits, and ending style; `~/brain/config/content-goals.md` for posting cadence
- Tools: GBrain search + think, Claude Sonnet (Tier 2), Discord messaging + clarify, local Playwright with `~/.hermes/linkedin_cookies.json`

## Goal
A LinkedIn draft is previewed in #corrections; on explicit 👍 from Dhruva, the post is published from Dhruva's authenticated LinkedIn session via headless Chromium on Omen. Without approval, nothing is posted.

## Constraints
- Tier 2 (Sonnet 4.6) mandatory. Approval required on every run, no exceptions.
- Never publishes without explicit 👍 from DISCORD_ALLOWED_USER in #corrections.
- Reactor identity check: reaction must come from DISCORD_ALLOWED_USER account; reject otherwise.
- If the preview message is edited after posting, treat the approval as invalid.
- Do not name private systems (DhruvaOS, Drew) in outbound copy.
- If the LinkedIn session is expired, stop and report; do not attempt to log in programmatically.
- If the composer or post controls cannot be found, stop and report — never guess-click.
- Never retry a failed post silently; always surface the failure to #corrections.
- Voice, length, hashtag and emoji limits follow `~/brain/config/content-guidelines.md`.

## Notes
- LinkedIn's DOM drifts; selector arrays may need maintenance. `data-test-id` is most stable, `aria-label` second, class names least.
- Playwright's `storage_state` auto-refreshes cookies on each successful run.
