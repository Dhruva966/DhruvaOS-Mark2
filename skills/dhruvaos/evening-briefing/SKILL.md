---
name: evening-briefing
version: 2.0.0
tier: 2
outbound: false
requires_approval: false
description: "Evening recap: compare done vs planned, tomorrow's calendar, insight → posts to Discord #briefings"
schedule: "0 21 * * *"
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - GOOGLE_CALENDAR_ID
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - DREW_TIMEZONE
gbrain:
  reads: ["daily/briefing-{{date}}.md", "daily/*", "projects/*"]
  writes: ["daily/recap-{{date}}.md"]
tests: tests/
metadata:
  hermes:
    tags: [briefing, recap, evening, daily, discord]
    homepage: https://github.com/dhruva966/dhruvaos
---

# Evening Briefing

## Purpose
Close out the day with a recap that compares what was planned against what actually happened, surfaces what carries forward, previews tomorrow's calendar, and offers one honest insight. Runs at 9pm Pacific. Companion to morning-briefing — together they bookend the day.

## Context
- Trigger: Cron at `0 21 * * *` (Pacific) — invoked by Hermes.
- Channels: `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings) for posting.
- Data sources: this morning's `~/brain/daily/briefing-{{today}}.md` (the planned-tasks source of truth); GBrain semantic search for completion signals and open tasks; Google Calendar for tomorrow's events via `~/.hermes/scripts/google_api_helper.py`.
- Tunables: Check `~/brain/config/timing.md` for current values (calendar look-ahead, completion-evidence freshness window); use sensible defaults if missing. Check `~/brain/config/content-guidelines.md` for tone of the daily insight.
- Tools: `code_execution`, `terminal`, GBrain MCP, Discord `messaging`, `file` read/write.

## Goal
A three-part recap — Done+CarryForward, Tomorrow's Calendar, Insight — is posted to #briefings as separate Discord messages, and a markdown copy is saved to `~/brain/daily/recap-{{date}}.md`. Each planned task is honestly classified as done, carry-forward, or dropped. The insight is specific to the day, not boilerplate.

## Constraints
- Hard guard: if `~/brain/daily/briefing-{{today}}.md` is missing or empty, post a single "no morning briefing found" message to #briefings and stop. Do not invent a recap from scratch.
- When evidence of completion is ambiguous, default to CARRY_FORWARD over DONE. Never claim completion without a signal.
- Internal post — no outbound approval gate.
- Degrade gracefully on any data-source failure (calendar/GBrain) and footer the error; only the guard above is a hard stop.
- The insight must reflect today's actual data. Never ship motivational filler ("Great work today!") — silence is better.
- All file writes under `~/brain/daily/` only; create the directory if missing.
- Any direct `gbrain import` / `embed` invocation must be wrapped in `flock -n ~/.gbrain/gbrain-write.lock` (single-writer rule). If this skill only writes brain files and lets the stale embed cycle pick them up, that's fine — but never call gbrain CLI write commands without the flock.

## Notes
- Tier 2 (Sonnet) reasoning powers both the done-vs-planned classification and the daily insight.
- Discord messages stay below the per-message limit; split rather than truncate sections.
