---
title: "Timing Windows"
type: config
updated: 2026-06-09
---

# Timing Windows

How far ahead and back Drew looks for various data sources. Edit to widen or tighten any window.

## Calendar look-ahead
- morning-briefing: today + next **3 days**
- calendar-read (standalone): today + next **7 days**

## Email look-back
- email-triage: unread in last **48 hours**

## Monitoring windows
- api-cost-watchdog: last **24 hours** of gateway log
- error-detection: last **6 hours** of gateway log
- gbrain-health-monitor: hourly cadence
- skill-analytics: weekly window (Sun → Sat)
- tier-watchdog: daily window

## Cache validity
- paper-monitor cache reused by morning-briefing if written within last **8 hours**

## Task windows
- task-prioritization treats anything past `Due` date as overdue (day-of grace = 0)

## Notes
- All times in `DREW_TIMEZONE` (default America/Los_Angeles)
- The agent may override these when a user query asks for a different range
- Defaults exist so cron-triggered runs have something to anchor on
