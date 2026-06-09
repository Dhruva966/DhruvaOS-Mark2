---
name: content-idea-engine
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Monday 9am: pull recent GBrain context, generate 3-5 content ideas for LinkedIn/Blog/X, post to #tasks. Does NOT auto-post anything."
schedule: "0 9 * * 1"
gbrain:
  reads: ["projects/*", "goals/*", "weekly/*"]
  writes: ["content/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [Content, Ideas, LinkedIn, Blog, Twitter, Phase13, Cron, Monday]
---

# Content Idea Engine

## Purpose
Once a week, propose a small set of timely, context-grounded content ideas Dhruva can choose from.
The skill plans; it never publishes. Ideas should be rooted in what Dhruva actually did and learned
this week, not generic productivity filler.

## Context
- Trigger: Monday 9am cron (runs after `content-calendar` so Dhruva sees the gap first), or on demand.
- Channels: `DISCORD_TASKS_CHANNEL_ID`.
- Data sources: GBrain searches over recent work / projects / goals, most recent file under
  `~/brain/weekly/`, and any active content brain files.
- Tunables: per-platform mix and cadence in `~/brain/config/content-goals.md`; tone, voice, and
  formatting guidance in `~/brain/config/content-guidelines.md`.
- Tools: `gbrain_search`, `gbrain_think`, filesystem read of `~/brain/weekly/`, Tier 1 model for
  idea generation, file write under `~/brain/content/`, `gbrain` import, `messaging`.

## Goal
Generate a small set of specific, timely content ideas across the platforms Dhruva targets this
week, persist them as a dated brain file, and post them to #tasks so Dhruva can pick one and drive
it through a downstream draft skill.

## Constraints
- Ideas only — never call `linkedin-post`, `blog-draft`, `x-thread-draft`, or any outbound skill.
- Every idea must be grounded in recent context (work, weekly synthesis, GBrain). No generic
  "5 tips" filler; if context is thin, say so explicitly rather than inventing.
- Platform mix and how many ideas to surface come from `~/brain/config/content-goals.md`; hook
  style, voice, and formatting rules come from `~/brain/config/content-guidelines.md`.
- Tier 1 is the appropriate model here — these are internal ideas, not outbound copy. Tier 2 is
  reserved for the actual drafting skills.
- Persist the ideas as a dated markdown file in `~/brain/content/` and ingest into GBrain even if
  the Discord post later fails; the file is the durable record.
- Required env var must be present; stop and report if missing.
- Degrade gracefully: empty GBrain results, missing weekly file, or malformed model JSON should
  yield a clearly labelled lighter-weight post rather than an abort.

## Notes
- Downstream Dhruva picks an idea by replying with the matching slash command (`/blog`, `/linkedin`,
  `/thread`).
- If Discord delivery fails, the brain file is still on disk and re-ingestable via
  `flock -n ~/.gbrain/gbrain-write.lock gbrain import <path>`.
