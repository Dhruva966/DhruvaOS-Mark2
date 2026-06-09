---
name: calendar-read
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Fetch Google Calendar events for today + next 7 days and return a formatted agenda block. Composable — designed to be called standalone or embedded in morning-briefing."
schedule: null
gbrain:
  reads: []
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - GOOGLE_CALENDAR_ID
metadata:
  hermes:
    tags: [Calendar, Agenda, Composable, Daily]
---

# Calendar Read

## Purpose
Produce a clean, human-readable agenda of Dhruva's upcoming Google Calendar events. Composable: either returns the formatted block to a caller (typically morning-briefing) or, when run standalone, posts it to #briefings. Read-only — never modifies calendar state.

## Context
- Trigger: standalone `/agenda` style invocation, or sub-call from morning-briefing
- Channels: when run standalone, post to `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings); when called by another skill, return the formatted string to the caller
- Data sources: Google Calendar via `~/.hermes/scripts/google_api_helper.py calendar` (returns JSON array of events; each has `summary`, `start`, `end`, optional `location`)
- Tunables: check `~/brain/config/timing.md` for the look-ahead window length and timezone; use sensible defaults (Pacific, week-ahead) if missing
- Output format: agenda grouped by day, headers like "Today" / "Tomorrow" / weekday, events sorted by start time, all-day events labeled, location included when present

## Goal
The agent returns (or posts) an agenda string covering the configured look-ahead window starting from now. Events are grouped by date in Pacific time, sorted by start within each day, and days with no events are omitted. An empty window yields a single "no events" line. If the calendar fetch fails, the agent returns a clear failure message rather than fake data.

## Constraints
- Read-only — never create, modify, or delete calendar events
- Calendar fetch failure must be reported plainly (do not fabricate events)
- All-day events render distinctly from timed events
- When embedded in morning-briefing, return the block as-is for the caller to splice — do not post separately
