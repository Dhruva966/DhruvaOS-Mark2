---
name: morning-briefing
version: 2.0.0
tier: 2
outbound: false
requires_approval: false
description: "Full daily briefing: calendar + email digest + tasks + news/research → posts to Discord #briefings"
schedule: "0 8 * * *"
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - GOOGLE_CALENDAR_ID
    - EXA_API_KEY
    - DISCORD_BRIEFINGS_CHANNEL_ID
    - DREW_TIMEZONE
gbrain:
  reads: ["daily/*", "projects/*", "goals/*", "brain/*", "resources/papers/*"]
  writes: ["daily/briefing-{{date}}.md"]
daily_token_budget: 20000
tests: tests/
metadata:
  hermes:
    tags: [briefing, calendar, gmail, discord, morning, daily]
    homepage: https://github.com/dhruva966/dhruvaos
---

# Morning Briefing

## Purpose
Start Dhruva's day with a single coherent snapshot of what matters: today's calendar, the next few days ahead, inbox action items, active tasks, and a research pulse. Runs at 8am Pacific so the briefing is ready before the day begins.

## Context
- Trigger: Cron at `0 8 * * *` (Pacific) — invoked by Hermes.
- Channels: `DISCORD_BRIEFINGS_CHANNEL_ID` (#briefings) for posting.
- Data sources: Google Calendar and Gmail via `~/.hermes/scripts/google_api_helper.py`; GBrain semantic search for tasks/projects/goals; paper-monitor cache under `~/brain/resources/papers/`; Exa web search as fallback for research pulse.
- Tunables: Check `~/brain/config/timing.md` for current values (calendar look-ahead window, paper-monitor cache freshness, message-length budget); use sensible defaults if missing. Check `~/brain/config/content-goals.md` for the topics that anchor the research pulse.
- Tools: `code_execution`, `terminal` (for the Google API helper inside the Hermes venv), GBrain MCP, Exa `web`, Discord `messaging`, `file` write.

## Goal
A multi-part briefing — Header+Calendar, Inbox, Tasks, Research Pulse — is posted to #briefings as separate Discord messages (each within Discord's per-message limit), and a markdown copy is saved to `~/brain/daily/briefing-{{date}}.md`. The briefing ships even when individual data sources fail, with explicit "unavailable" notes for any missing section.

## Constraints
- Internal briefing only — no outbound approval gate, auto-post.
- Never abort the whole skill because one data source failed. Degrade gracefully and footer the error.
- Inbox classification must reflect actual signal (action vs FYI vs newsletter); prefer Tier 2 reasoning over rigid keyword lists when judgment is needed.
- Prefer the paper-monitor cache over Exa when fresh results exist for today (saves API spend and stays consistent with what the rest of the system already saw).
- All file writes under `~/brain/daily/` only; create the directory if missing.
- Discord messages: separate messages per section so each gets full space; truncate within a message rather than dropping a section silently.
- Any direct `gbrain import` / `embed` invocation must be wrapped in `flock -n ~/.gbrain/gbrain-write.lock` (single-writer rule). If this skill only writes brain files and lets the stale embed cycle pick them up, that's fine — but never call gbrain CLI write commands without the flock.

## Notes
- Tier 2 (Sonnet) reasoning composes the briefing — this is read-by-human text but stays internal, so no human-approval gate applies.
- "Research Pulse" wording and topic selection should be anchored in `~/brain/config/content-goals.md` rather than hardcoded.
