---
name: meeting-prep-brief
version: 1.1.0
tier: 1
outbound: false
requires_approval: false
description: "Every 30min: check Google Calendar for meetings starting in 30-45 minutes; post attendee background brief to #briefings. Deduplicates within 2-hour window."
daily_token_budget: 8000
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - GOOGLE_CALENDAR_ID
gbrain:
  reads: ["people/*", "daily/*"]
  writes: ["daily/meeting-prep-{{date}}-{{event_id}}.md"]
tests: tests/
metadata:
  hermes:
    tags: [Calendar, Meetings, Briefings, People, Daily]
---

# Meeting Prep Brief

## Purpose
Catch upcoming meetings early enough to be useful: scan the calendar on a short interval, find events starting soon, and post a concise attendee-background prep brief to #briefings. Quiet by default — no qualifying event means no message.

## Context
- Trigger: Cron on a short recurring interval (every ~30 minutes) — invoked by Hermes.
- Channels: `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings) for posting.
- Data sources: Google Calendar via `~/.hermes/scripts/google_api_helper.py`; GBrain semantic search over `people/*` for attendee background and over `daily/*` for dedup history.
- Tunables: Check `~/brain/config/timing.md` for current values (lead-time window for "starting soon", dedup window); use sensible defaults if missing. Check `~/brain/config/relationship-windows.md` for what counts as a recent interaction.
- Tools: `terminal` (Google API helper inside Hermes venv), `code_execution`, GBrain MCP (`gbrain search`, `gbrain call extract_facts`), Discord `messaging`.

## Goal
For each calendar event entering the lead-time window that hasn't already been briefed, a short Discord message lands in #briefings with the event title and per-attendee background (role, last interaction, suggested questions). A dedup fact is written to GBrain so the next run doesn't repost. When there's nothing to brief, the skill exits silently.

## Constraints
- Internal brief — no outbound approval gate.
- Never post a brief composed entirely of placeholder text — if no attendee has any GBrain data, skip the event silently. Silence beats noise.
- Skip all-day events.
- Deduplicate against recent briefs (use GBrain search over today's brief facts before posting).
- Calendar failure → log error and silent exit. Do not post a partial brief.
- Discord message stays within the per-message limit; truncate attendee sections from the bottom and indicate omitted attendees rather than dropping the whole post.
- Use Tier 1 (GPT-4o-mini) reasoning for synthesis — meeting prep is internal and cost-sensitive.
- Brain writes use the GBrain single-writer contract — wrap any `gbrain import` / `embed` / `dream` invocation in `flock -n ~/.gbrain/gbrain-write.lock` to prevent concurrent corruption. If the lock is busy, defer to the next stale embed cycle (the file write itself is durable).

## Notes
- After each posted brief, write a dedup fact via `gbrain call extract_facts` so the next short-interval run sees it.
- Attendee name derivation from email is a reasonable fallback when calendar `displayName` is missing.
