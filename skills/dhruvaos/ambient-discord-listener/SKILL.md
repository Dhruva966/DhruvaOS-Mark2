---
name: ambient-discord-listener
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Triggered on EVERY Discord message from DISCORD_ALLOWED_USER (not just /commands). Classifies intent via phi4-mini, then acts silently: logs context to brain, creates tasks, queues research, or tags people — no Discord reply unless explicitly needed."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALLOWED_USER
gbrain:
  reads: ["daily/*", "people/*", "projects/*", "goals/*"]
  writes: ["daily/ambient-{{date}}.md", "people/*", "projects/*", "goals/*"]
tests: tests/
metadata:
  hermes:
    tags: [ambient, discord, listener, context, intent, passive, proactive, memory]
    trigger: on_message  # fires on every non-command Discord message from allowed user
---

# Ambient Discord Listener

You are Drew's ambient awareness engine. This skill fires on **every Discord message** from
Dhruva that does NOT start with `/`. No cron — real-time, event-driven.

**Your job is to notice things, not to respond.** Stay silent unless Dhruva is asking a
direct question. Log context, create tasks, queue research, tag people — silently. The
morning briefing and evening briefing will surface what you captured.

This is how Drew becomes ambient: not just reacting to commands, but building context from
every interaction.

---

## When to Stay Silent (most of the time)

Stay completely silent (no Discord reply) for:
- Statements ("I had a great meeting with Alex today")
- Passing thoughts ("I should look into edge inference on Snapdragon X")
- Goal mentions ("I want to apply to Stripe internship")
- Person mentions ("Shivansh is working on something interesting")
- Frustrations ("I can't figure out this OAuth flow")
- Casual observations

Reply in Discord ONLY when:
- Dhruva directly asks you something ("Drew, what do you think about X?" or "Hey Drew, ...")
- Dhruva asks a question that references your capabilities ("can you look this up", "remind me")
- The message contains a clear implicit request for help

---

## Step 0 — Receive and Check Message

The triggering message arrives as `HERMES_TRIGGER_MESSAGE` in the environment.

Use `code_execution`:
```python
import os
message = os.environ.get("HERMES_TRIGGER_MESSAGE", "").strip()
channel = os.environ.get("HERMES_TRIGGER_CHANNEL", "").strip()
sender_id = os.environ.get("HERMES_TRIGGER_USER_ID", "").strip()
allowed_id = os.environ.get("DISCORD_ALLOWED_USER", "").strip()

# Only process messages from Dhruva
if sender_id != allowed_id:
    print("NOT_ALLOWED")
    exit()

# Skip command messages (skill dispatcher handles these)
if message.startswith("/"):
    print("IS_COMMAND")
    exit()

# Skip very short messages (reactions, "ok", "lol", etc.)
if len(message) < 10:
    print("TOO_SHORT")
    exit()

print(f"MESSAGE={message[:2000]}")
print(f"CHANNEL={channel}")
```

If `NOT_ALLOWED`, `IS_COMMAND`, or `TOO_SHORT`: exit immediately. No action.

---

## Step 1 — Classify Intent via phi4-mini (Tier 0, local, free)

Use `llm_call` with `tier: 0` (phi4-mini via Ollama):

```
Classify this message from Dhruva into ALL applicable intent categories.
Return ONLY a JSON object.

Message: "[MESSAGE]"

Categories (can have multiple):
- "task": creates or implies a task/action item (e.g. "I need to...", "remind me to...", "I should...")
- "goal": mentions a medium/long-term goal or ambition
- "person": mentions a person by name (capture who)
- "project": mentions a project, startup, or specific work
- "question": Dhruva is asking Drew something directly
- "research": implies wanting information or investigation
- "correction": correcting Drew's behavior or preference
- "context": general life update or observation worth remembering
- "none": passing remark, not worth capturing

Return format:
{
  "intents": ["task", "person"],
  "task_text": "apply to Stripe internship by July 1",
  "people": ["Alex", "Shivansh"],
  "project": null,
  "goal_text": null,
  "research_query": null,
  "is_question_for_drew": false,
  "summary": "one sentence describing what happened"
}

Only fill fields that apply. Set others to null or [].
```

Parse the response. If parse fails or intents is `["none"]`: exit silently.

---

## Step 2 — Act on Each Intent (in order, silently)

### If "task" in intents AND task_text is set:

Use `gbrain_ingest` to append to `daily/ambient-{{today_str}}.md`:
```markdown
- [ ] [TASK_TEXT] _(captured from ambient, [time])_
```

Also call the `add-task` skill as a subskill (or write directly to `~/brain/projects/tasks-inbox.md`).
**Do not reply in Discord.** The task will surface in the evening briefing.

### If "goal" in intents AND goal_text is set:

Use `gbrain_ingest` to write to `goals/ambient-goals.md`:
```markdown
## [DATE]
[GOAL_TEXT]
_Source: ambient Discord_
```

### If "person" in intents AND people is non-empty:

For each person in `people`:
1. Call `gbrain_search(query=f"people {person}")` to find their existing brain entry
2. If found: use `gbrain_ingest` to append an interaction note:
   ```markdown
   ### [DATE] — Ambient mention
   [SUMMARY]
   ```
3. If not found AND person seems significant (mentioned with context, not in passing):
   Create `people/[person_slug].md` stub:
   ```markdown
   ---
   title: "[Person Name]"
   tags: ["person"]
   source: "ambient-discord-listener"
   date: "[DATE]"
   ---
   # [Person Name]
   First mentioned: [DATE]
   Context: [SUMMARY]
   ```

### If "project" in intents AND project is set:

Use `gbrain_search(query=f"projects {project}")` to find existing project entry.
Append a note if found. Create stub if it seems like a significant new project mention.

### If "research" in intents AND research_query is set:

Write a research queue entry to `daily/research-queue.md`:
```markdown
- [DATE] [TIME]: [research_query]
  _queued from ambient_
```

Research-synthesis or the next morning briefing can pick this up.
**Do not trigger research immediately** — batch it for the next briefing cycle to avoid mid-conversation API calls.

### If "is_question_for_drew" is true:

This is the only case where you reply in Discord.

Use `gbrain_search(query=message)` to find relevant context.
Compose a brief, direct answer using the search results.
Post to the same channel using the `messaging` tool.
Keep response ≤3 sentences — this is voice-era brevity.

---

## Step 3 — Log Ambient Capture

Append to `daily/ambient-{{today_str}}.md`:
```markdown
---
timestamp: [ISO_TIMESTAMP]
channel: [CHANNEL]
intents: [LIST_OF_INTENTS]
summary: [SUMMARY_FROM_STEP_1]
---
```

This file becomes part of the GBrain dream cycle's conversation synthesis phase.
The dream cycle (3am) will cross-link the captures with existing entities and projects.

---

## Done Condition

- phi4-mini classified the message
- All applicable intents acted on silently
- Capture logged to `daily/ambient-{{date}}.md`
- **No Discord reply unless is_question_for_drew**

---

## Why This Skill Matters

Without this skill, Drew only knows what you explicitly tell it via `/commands`.
With this skill, Drew builds context from every conversation — the same way a real
colleague builds understanding by being present, not by only reading formal memos.

The morning briefing surfaces tasks queued here. The dream cycle cross-links people
mentioned here with existing brain entries. Corrections here feed into behavior.
Over weeks, Drew starts knowing things you never explicitly taught it.
