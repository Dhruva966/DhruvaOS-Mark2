---
name: add-task
version: 1.0.0
tier: 1
outbound: false
requires_approval: true
description: "Parse natural-language task from Discord, add to Notion Tasks DB + GBrain tasks-inbox. Triggered by /task command."
schedule: null
gbrain:
  reads: []
  writes: ["projects/tasks-inbox.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - NOTION_API_KEY
    - NOTION_TASKS_DB_ID
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [Tasks, Notion, GBrain, Discord, Command]
---

# Add Task

## Purpose
Capture a free-form task from Dhruva's `/task` command in Discord and durably record it in both Notion (Tasks DB) and the brain (`~/brain/projects/tasks-inbox.md`) so it surfaces in the next task-prioritization run. The skill is the front door for inbox capture — it exists to make recording a task frictionless without ever losing one.

## Context
- Trigger: `/task <free text>` posted in Discord #tasks
- Channels: confirmation posts back to `DISCORD_TASKS_CHANNEL_ID` (#tasks)
- Data sources: Notion Tasks DB (`NOTION_TASKS_DB_ID`), brain inbox at `~/brain/projects/tasks-inbox.md`
- Downstream: task-prioritization reads `tasks-inbox.md` on its next run and merges into the ranked list
- Tools: GBrain CLI for immediate indexing (`gbrain import`, `gbrain embed --stale`); fall back to the nightly stale-embed cron if the write lock is busy
- Notion properties available on Tasks DB: `Name`, `Status`, `Source`, `Priority`, `Due`

## Goal
The task exists in Notion (with parsed due date and priority where present), is appended to `~/brain/projects/tasks-inbox.md` without clobbering existing entries, is ingested into GBrain when the write lock is free, and a confirmation summary is posted to #tasks. If either Notion or the brain write fails, the other path still succeeds and the confirmation reflects what landed.

## Constraints
- Never interpolate user-supplied text directly into shell commands or Python source — JSON-encode user input (e.g., base64 over a JSON payload) before passing to any subprocess to prevent quote/backslash/newline injection
- Brain inbox writes must be read-modify-write: never overwrite `tasks-inbox.md`; preserve existing lines
- GBrain ingest must hold `~/.gbrain/gbrain-write.lock` via `flock -n`; if the lock is busy, skip immediate ingest (do not block) and note it in the confirmation
- Empty task text is invalid — respond with usage hint instead of writing anything
- Priority is constrained to `High` or `Normal`; anything else normalizes to `Normal`
- Confirmation message to #tasks does not require outbound approval (internal channel), but the skill's own write/shell operations still follow its frontmatter approval policy
- Do not modify any task or page beyond the new one being created
