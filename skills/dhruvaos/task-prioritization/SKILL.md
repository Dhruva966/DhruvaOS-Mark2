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
tests: tests/task-prioritization/
platforms: [linux]
prerequisites:
  env_vars:
    - NOTION_API_KEY
    - NOTION_TASKS_DB_ID
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [Tasks, Notion, GBrain, Discord, Daily]
---

# Task Prioritization

You are loading Dhruva's open tasks from Notion, scoring each by urgency and importance,
posting a ranked digest to Discord, and writing the canonical priority list to
`~/brain/projects/tasks.md`.

**You are the ONLY skill authorized to write tasks.md.** Do not skip the file write.

## Step 1 — Query Notion for Open Tasks

Use `terminal` to run:

```bash
curl -s -X POST "https://api.notion.com/v1/databases/${NOTION_TASKS_DB_ID}/query" \
  -H "Authorization: Bearer ${NOTION_API_KEY}" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "property": "Status",
      "status": {
        "does_not_equal": "Done"
      }
    },
    "sorts": [
      {"property": "Due", "direction": "ascending"}
    ]
  }'
```

Parse the JSON response. For each page in `results`, extract:
- Task name: `properties.Name.title[0].plain_text` (or "Untitled")
- Status: `properties.Status.status.name`
- Due date: `properties.Due.date.start` (ISO string, may be null)
- Priority label: `properties.Priority.select.name` (may be null)

If the curl fails or `results` is empty, proceed to Step 2 — GBrain may still have tasks.

## Step 2 — Enrich with GBrain Context

Use GBrain MCP tools to gather goal and project context:

- Search 1: `gbrain search "current projects active goals"`
- Search 2: `gbrain search "priorities this week tasks"`
- Think: `gbrain think "What are Dhruva's top goals right now and which project areas matter most?"`

Use the returned context to calibrate importance scores in Step 3.

## Step 3 — Score Each Task

For every task, reason through two dimensions:

**Urgency (1–10):**
- 10: due today or overdue
- 8–9: due within 2 days
- 6–7: due within 1 week
- 4–5: due within 2 weeks
- 2–3: due within a month
- 1: no due date or far out

**Importance (1–10):**
- 10: directly tied to a top goal, high consequence if missed
- 7–9: important project, not the highest-priority goal
- 4–6: useful but not tied to a core goal
- 1–3: low-value or unclear connection to goals

**Score = urgency × importance** (max 100)

Rank highest score first. Ties go to the earlier due date.

## Step 4 — Build the Discord Message

```
✅ **Task Priorities** — [Weekday, D Mon YYYY]

1. [Task Name] · Score: [N]
   Status: [status] · Due: [due date or "—"] · U:[urgency] × I:[importance]
   → [One sentence: why this is ranked here, what the next action is]

2. [Task Name] · Score: [N]
   ...

(continue up to 10 tasks)
[If more than 10]: _…and [X] more tasks in tasks.md_

_Sources: Notion ([N] tasks) · GBrain context_
```

If zero tasks: post "✅ **Task Priorities** — No open tasks. Notion DB is clear."

## Step 5 — Post to Discord

Use the `messaging` tool to post to channel ID `1507031086226735236` (DISCORD_TASKS_CHANNEL_ID).
No approval needed — internal briefing.
Keep the message under 1800 characters for Discord's 2000-character limit. If more than 10 tasks, show the top 10 and add '_…and [X] more in tasks.md_'

## Step 6 — Write ~/brain/projects/tasks.md

Use the `file` tool to write (overwrite) `~/brain/projects/tasks.md`:

```markdown
# Task Priorities

_Last updated: [ISO timestamp]_
_Source: Notion Tasks DB + GBrain context_

## Ranked Tasks

| Rank | Task | Score | U | I | Due | Status |
|------|------|-------|---|---|-----|--------|
| 1 | [Task Name] | [N] | [U] | [I] | [due] | [status] |
...

## Scoring Notes

[For each task in top 5: one paragraph explaining urgency score, importance score, and next concrete action.]

## Full Task List (Unranked)

[Bullet list of ALL tasks fetched from Notion, with Notion page IDs for reference.]
```

This is the canonical task priority record. No other skill writes this file.

## Step 7 — Done

Log: "task-prioritization complete — [N] tasks scored, posted to Discord, written to tasks.md."
Do NOT modify any Notion pages. Do NOT take action on tasks without explicit approval via `clarify`.
