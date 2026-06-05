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
tests: tests/add-task/
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

Triggered by `/task <text>` in Discord #tasks.
Example: `/task "submit CS101 homework due Friday"` or just `/task submit CS101 homework due Friday`

Parse the task text and add it to both Notion and GBrain. Post confirmation to Discord.

## Step 1 — Parse Task Text

Extract from the user's message:
- **Task text** — the main task description (everything after `/task`)
- **Due date** — any date/day reference: "due Friday", "by 5pm", "tomorrow", "June 10", "next week"
- **Priority** — any urgency signal: "urgent", "asap", "important", "critical" → High priority; otherwise Normal

Format the task for display:
```
[task text]  (due: [date if found] | priority: [High/Normal])
```

## Step 2 — Add to Notion Tasks DB

Use `terminal` with a Python heredoc to safely JSON-encode the task text (prevents injection from quotes/backslashes in task text):

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && python3 - <<'PYEOF'
import os, json, urllib.request, urllib.error

task_text = "[TASK TEXT FROM STEP 1]"  # agent substitutes actual task text
due_date = "[DUE DATE OR None]"         # agent substitutes ISO date or None
priority = "[High or Normal]"           # agent substitutes from Step 1

properties = {
    "Name": {"title": [{"text": {"content": task_text}}]},
    "Status": {"status": {"name": "Not started"}},
    "Source": {"select": {"name": "Discord"}},
    "Priority": {"select": {"name": priority}},
}
if due_date and due_date != "None":
    properties["Due"] = {"date": {"start": due_date}}

body = json.dumps({
    "parent": {"database_id": os.environ["NOTION_TASKS_DB_ID"]},
    "properties": properties,
})

req = urllib.request.Request(
    "https://api.notion.com/v1/pages",
    data=body.encode(),
    headers={
        "Authorization": f"Bearer {os.environ['NOTION_API_KEY']}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        print(f"NOTION_OK: {json.loads(resp.read())['id']}")
except urllib.error.HTTPError as e:
    print(f"NOTION_ERROR: {e.code} {e.read().decode()[:200]}")
PYEOF
```

If output contains `NOTION_ERROR`, note it but continue — GBrain write is the fallback.

## Step 3 — Write to GBrain tasks-inbox.md

Use `terminal` to ensure the file exists (atomic create), then use `file` tool to read current content, append the new task line, and write back:

```bash
mkdir -p ~/brain/projects/
touch ~/brain/projects/tasks-inbox.md
```

Then use the `file` tool to:
1. Read `~/brain/projects/tasks-inbox.md`
2. Append this line: `- [ ] [task text] [due: <date or omit>] [added: <today YYYY-MM-DD>]`
3. Write the full content back

Do NOT overwrite — other tasks may already be in the inbox. Always read first, then write the full content including existing lines.

## Step 3b — GBrain ingest (immediate searchability)

After writing tasks-inbox.md, signal GBrain to index the new task:

```bash
gbrain import ~/brain/projects/tasks-inbox.md 2>&1 | head -3
gbrain embed --stale 2>&1 | head -3
```

If gbrain not in PATH: use `/home/dhruva/.bun/bin/gbrain` as fallback.
If ingest fails, continue — task-prioritization will still pick up the file.

## Step 4 — Post Confirmation to Discord

Use the `messaging` tool to post to channel ID `1507031086226735236` (#tasks):

```
✅ Task added: [task text]
📅 Due: [date or "—"] · Priority: [High/Normal]
📋 In Notion + GBrain tasks-inbox
```

No approval needed — this is a confirmation message for an internal add operation.

## Step 5 — Done

Skill complete. task-prioritization will pick up the new task from tasks-inbox.md on its next run and merge it into the ranked list.

## Error Handling

| Failure | Action |
|---------|--------|
| Notion API returns error | Note in confirmation, GBrain write still succeeds |
| GBrain file write fails | Note in confirmation, Notion write still succeeds |
| Both fail | Post error to #tasks: "Failed to add task — try again or add manually in Notion" |
| No task text | Post to #tasks: "Usage: /task <task description>" |
