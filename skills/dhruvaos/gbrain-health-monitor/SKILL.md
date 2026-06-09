---
name: gbrain-health-monitor
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Hourly: ping GBrain MCP at 127.0.0.1:3131/health, auto-recover via PM2 restart if down, post to #alerts on failure or recovery. Silent when healthy."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
gbrain:
  reads: []
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [GBrain, Health, Monitoring, Alerts, Recovery, Hourly]
---

# GBrain Health Monitor

## Purpose
Hourly liveness check on the GBrain MCP service. When it's down, attempt a self-heal via PM2,
track consecutive failures, and notify `#alerts` on failure or recovery. Silent when everything
is healthy.

## Context
- Trigger: hourly cron
- Channels: `#alerts` only (failure, recovery, sustained-outage cadence)
- Data sources: GBrain HTTP health endpoint at `http://127.0.0.1:3131/health`, failure counter at `~/.gbrain/health-failures.count`
- Tunables: alert cadence during sustained outage and recovery wait window in `~/brain/config/timing.md`
- Tools: terminal (curl + PM2 restart of `gbrain-mcp`), messaging

## Goal
GBrain confirmed responsive (or auto-recovery attempted and outcome recorded); failure counter
reflects current state; `#alerts` is told the bare minimum — first failure, sustained-outage
checkpoints, or recovery — and nothing on a healthy hour.

## Constraints
- Uses the HTTP health endpoint (port 3131), never the `gbrain` CLI — the CLI takes a PGLite lock and contends with normal writes.
- "Healthy" requires HTTP 200 AND a body containing `"status":"ok"`. Anything else is DOWN.
- On DOWN: attempt one PM2 restart of `gbrain-mcp`, wait briefly, re-check. Do not retry beyond that within one run.
- Suppress alert spam during long outages — alert on first failure, then at a steady cadence (see timing config), and again on recovery.
- Reset the failure counter on recovery; increment on each consecutive down run.
- Never request approval — internal monitoring only.
- No GBrain reads or writes inside this skill; it must work even when GBrain is offline.

## Notes
- Recovery message acknowledges how many consecutive failures preceded it.
- If PM2 restart is the cause of recovery, label the alert so Drew knows it was auto-healed vs. naturally recovered.
- One-line status summary to the session log at end of every run (healthy / down / recovered) helps post-mortem.
