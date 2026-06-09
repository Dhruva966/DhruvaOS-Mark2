---
name: task-prioritization
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Load all non-done tasks from Notion, enrich with GBrain context, score by urgency×importance, post ranked list to Discord #tasks, and write ~/brain/projects/tasks.md. The ONLY skill authorized to write tasks.md."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: ["projects/tasks.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - NOTION_API_KEY
    - NOTION_TASKS_DB_ID
    - DISCORD_TASKS_CHANNEL_ID
    - OPENAI_API_KEY
metadata:
  hermes:
    tags: [Tasks, Notion, GBrain, Discord, Daily]
---

# Task Prioritization

## Purpose
Pull every open task from Notion, enrich with current goal and project context from GBrain, score each task on urgency and importance, post a ranked digest to #tasks, and write the canonical priority record to `~/brain/projects/tasks.md`. The single source of truth for what matters now.

## Context
- Trigger: scheduled cron (typically morning) or manual invocation
- Channels: `DISCORD_TASKS_CHANNEL_ID` (#tasks) for the digest — internal, no outbound approval
- Data sources: Notion Tasks DB (`NOTION_TASKS_DB_ID`) — properties `Name`, `Status`, `Due`, `Priority`; GBrain searches over current projects, active goals, and weekly priorities; `gbrain think` for higher-order context on what matters this week
- Canonical artifact: `~/brain/projects/tasks.md` — overwritten on every run with the ranked list, scoring notes for top items, and the full unranked task list including Notion page IDs
- Tunables: check `~/brain/config/content-goals.md` and any related priority/scoring notes for tunables on top-N digest size and scoring calibration; use sensible defaults if missing
- Scoring shape: each task gets an urgency dimension (driven by due date) and an importance dimension (driven by goal alignment from GBrain context); the combined score determines ranking, with earlier due date as the tiebreaker

## Goal
A ranked list of all open Notion tasks exists in `~/brain/projects/tasks.md` with a per-task urgency and importance score, the top items have a one-sentence rationale and next action, the digest is posted to #tasks within Discord's size limits, and an overflow pointer is added when the list is long. An empty queue posts a clean "no open tasks" status. Notion is read-only here — no task fields are mutated.

## Constraints
- task-prioritization is the ONLY skill authorized to write `~/brain/projects/tasks.md` — never share this write path with any other skill
- Read-only with respect to Notion — never modify, create, or close tasks
- Never take action on a task without explicit user approval via `clarify`
- If Notion query fails or returns nothing, still attempt the GBrain enrichment path and write whatever ranked output is possible
- Respect Discord's per-message size limit; on overflow, show the top items in chat and point at `tasks.md` for the rest
- The brain-file write must be a full overwrite of the canonical content (header timestamp, ranked table, scoring notes, full unranked list with Notion IDs) — do not append
- Any direct `gbrain import` / `embed` invocation must be wrapped in `flock -n ~/.gbrain/gbrain-write.lock` (single-writer rule). If this skill only writes brain files and lets the stale embed cycle pick them up, that's fine — but never call gbrain CLI write commands without the flock.
