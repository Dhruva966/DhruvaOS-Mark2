---
name: x-thread-draft
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a 5-7 tweet X/Twitter thread with Sonnet from a topic, preview in #corrections, submit to XPosterOS queue only after explicit Dhruva 👍 approval. Trigger: /thread '<topic>' or 'write a thread about', 'post a thread', 'tweet about'."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
    - XPOSTEROS_API_URL
metadata:
  hermes:
    tags: [Twitter, X, Thread, Outbound, Phase13, Quality-Firewall, XPosterOS, Tier2]
---

# X Thread Draft

## Purpose
Draft an X/Twitter thread anchored in Dhruva's brain context, preview it in Discord, and submit the approved thread to the XPosterOS queue. Hook-first, builder voice, no hashtag spam.

## Context
- Trigger: `/thread "<topic>"` in Discord
- Channels: preview + approval in #corrections
- Data sources: GBrain (projects, goals) for opinions, experiences, and lessons relevant to the topic
- Tunables: see `~/brain/config/content-guidelines.md` for voice, hook style, hashtag rules, and per-tweet length expectations; `~/brain/config/content-goals.md` for cadence
- Tools: GBrain search, Claude Sonnet (Tier 2), Discord messaging + clarify, XPosterOS HTTP API (`XPOSTEROS_API_URL`, default `http://127.0.0.1:8081`)

## Goal
A thread that reads as authentic builder voice is previewed in #corrections; on explicit 👍 from Dhruva, it is submitted to XPosterOS as a draft for the posting queue. Without approval, nothing is queued.

## Constraints
- Tier 2 (Sonnet 4.6) mandatory. Approval required on every run, no exceptions.
- Reactor identity check: reaction must come from DISCORD_ALLOWED_USER account; reject otherwise.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- If the preview message is edited after posting, treat the approval as invalid.
- Every tweet must respect X's per-tweet character limit; regenerate if any tweet exceeds it.
- Never submit to XPosterOS without approval; never retry a failed submission silently.
- Do not name private systems (DhruvaOS, Drew) in outbound copy.
- Thread structure, hook style, and CTA conventions follow `~/brain/config/content-guidelines.md`.
- If GBrain has no relevant context, draft from the topic alone and disclose that in the preview footer.

## Notes
- XPosterOS dry-run mode means submitted drafts will not actually post; check `/system/health` before assuming publication.
- Final scheduling and posting are handled by xposteros-control and the XPosterOS workers, not this skill.
