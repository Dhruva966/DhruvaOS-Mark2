---
name: content-calendar
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Monday 8:50am: count posts by platform this week vs weekly goals, post calendar summary to #tasks. Alerts to #alerts if Sunday targets were missed."
schedule: "50 8 * * 1"
gbrain:
  reads: ["content/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - DISCORD_ALERTS_CHANNEL_ID
metadata:
  hermes:
    tags: [Content, Calendar, Tracking, Phase13, Cron, Monday]
---

# Content Calendar

## Purpose
Give Dhruva a Monday-morning view of last week's content output against his weekly goals so he
walks into the week knowing exactly where the gaps are. Pure observability — never posts content,
never drafts content.

## Context
- Trigger: Monday 8:50am cron (10 min before `content-idea-engine`), or on-demand via `/calendar`.
- Channels: `DISCORD_TASKS_CHANNEL_ID` (summary), `DISCORD_ALERTS_CHANNEL_ID` (missed-target alert).
- Data sources: `~/brain/content/**/*.md` (modified in the prior week), GBrain context as a
  secondary signal, optional lightweight streak state in `~/brain/content/.streak.json`.
- Tunables: weekly per-platform targets and monthly blog target live in `~/brain/config/content-goals.md`.
- Tools: filesystem read of `~/brain/content/`, `gbrain_search`, `messaging`.

## Goal
Post a single readable weekly content summary to #tasks showing posts-vs-target per platform with
a clear ok/behind indicator and the current consistency streak. If any weekly target was missed,
also post a concise alert to #alerts so Dhruva can catch up before the new week fills up.

## Constraints
- Never post outbound content; this skill only reports.
- Do not invent counts — derive from brain files and GBrain context, ignore `ideas-*.md` files
  (they describe planned, not published, content).
- Weekly targets and the monthly blog cadence come from `~/brain/config/content-goals.md`. Do not
  hardcode platform numbers in the skill.
- Skip the missed-target alert when only the monthly blog target is trailing — blog posts run on
  a longer cadence and a single off-week is not actionable.
- Streak resets only when the weekly per-platform targets (not the monthly blog target) are missed.
- Required env vars must be present; if not, stop before processing and surface which are missing.
- Degrade gracefully: missing content dir, corrupt streak file, or failed GBrain search must not
  abort the run — proceed with what is available and note the gap.
- If the #tasks post fails, retry once and fall back to #alerts so the report is not lost.

## Notes
- Streak state is a single small JSON file in `~/brain/content/`; safe to delete to reset.
- Runs 10 minutes before `content-idea-engine` so Dhruva sees the calendar before fresh ideas land.
