---
name: skill-proposal
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Draft and propose new Hermes skills from Discord command or novel task context; await 👍 approval before deploying"
schedule: null
gbrain:
  reads: ["skills/*", "brain/*"]
  writes: ["skills/proposed/{{skill_name}}.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [skills, meta, proposal, deployment]
---

# Skill Proposal

You are Drew, Dhruva's AI OS. This skill runs when:

- Dhruva issues a Discord command: `/propose-skill <description>`
- OR Hermes calls this skill automatically after handling a novel task

Your job is to check if a skill already exists, draft a stub if not, post it to
#tasks for Dhruva's approval, and deploy it on 👍 — or discard it on ❌ / timeout.

**requires_approval here means the DEPLOYMENT step requires a Discord 👍 reaction.**
The skill itself does NOT need agent-level approval to run — just to write files.

---

## Step 0 — Extract Input

Identify the trigger context from the input provided to this skill.

**Trigger A — Discord command:**
Parse the command argument:
```
input: "/propose-skill <description>"
task_description = everything after "/propose-skill "
trigger_source = "discord_command"
```

**Trigger B — Novel task context:**
If invoked after a novel task, the input will contain:
```
task_attempted: <what was tried>
tools_used: [list]
outcome: <result or error>
```
Synthesize a `task_description` from those fields.
Set `trigger_source = "novel_task"`.

If neither format matches, post to #tasks:
```
⚠️ skill-proposal: could not parse input. Provide `/propose-skill <description>`.
```
And exit.

---

## Step 1 — Search GBrain for Existing Coverage

Use `gbrain_search` with the task description to find any existing skill:

Query: `"skill that handles: {{task_description}}"`

Also search: `"hermes skill {{first_3_words_of_description}}"`

Examine the top 3 results. If any result describes a **deployed Hermes skill** that
already covers this capability:

Post to `DISCORD_TASKS_CHANNEL_ID`:
```
ℹ️ **Skill already exists**: `<existing-skill-name>`
Description matches: {{task_description}}
Run `/hermes skill run <existing-skill-name>` to use it.
```

Then exit — do not proceed to draft a new skill.

---

## Step 2 — Derive a Skill Name

If no existing skill found, derive a canonical skill name:

```python
import re

# Lowercase, words only, hyphens between words, max 32 chars
raw = task_description.strip().lower()
# Keep only letters, numbers, spaces
cleaned = re.sub(r"[^a-z0-9\s]", "", raw)
words = cleaned.split()[:5]  # take first 5 words
skill_name = "-".join(words)[:32]
```

Examples:
- "check my GitHub stars daily" → `check-github-stars-daily`
- "send weekly email digest" → `send-weekly-email-digest`

Store as `proposed_skill_name`.

---

## Step 3 — Draft the SKILL.md Stub

Use `code_execution` to generate the draft frontmatter and body:

```python
skill_name = "<PROPOSED_SKILL_NAME>"
description = "<TASK_DESCRIPTION>"

# Infer tier from description keywords
outbound_keywords = ["send", "post", "email", "tweet", "linkedin", "reply", "publish", "notify"]
shell_keywords = ["run", "execute", "deploy", "install", "restart", "cron"]

is_outbound = any(kw in description.lower() for kw in outbound_keywords)
uses_shell = any(kw in description.lower() for kw in shell_keywords)

tier = 2 if is_outbound else (1 if uses_shell else 0)
requires_approval_val = "true" if (is_outbound or uses_shell) else "false"
outbound_val = "true" if is_outbound else "false"

draft = f"""---
name: {skill_name}
version: 1.0.0
tier: {tier}
outbound: {outbound_val}
requires_approval: {requires_approval_val}
description: "{description[:80]}"
schedule: null
gbrain:
  reads: []
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars: []
metadata:
  hermes:
    tags: [{skill_name.split("-")[0]}]
---

# {skill_name.replace("-", " ").title()}

<!-- STUB: Fill in implementation steps before deploying -->

## Step 1 — TODO

Describe what this skill does in Step 1.

## Done Condition

Skill is complete when:
1. TODO
"""

print(draft)
```

Store as `skill_draft`.

---

## Step 4 — Post Draft to #tasks for Approval

Use `messaging` to post to `DISCORD_TASKS_CHANNEL_ID`:

```
🛠 **Proposed new skill: `{{proposed_skill_name}}`**

{{task_description}}

**Draft frontmatter:**
```yaml
{{first 15 lines of skill_draft}}
```

React 👍 to deploy to `~/.hermes/skills/dhruvaos/{{proposed_skill_name}}/SKILL.md`
React ❌ to discard
_(Expires in 5 minutes)_
```

Note the Discord message ID returned by the messaging tool — store as `proposal_message_id`.

---

## Step 5 — Wait for Dhruva's Reaction

Use the `clarify` tool to poll for a reaction on `proposal_message_id`:

```
clarify:
  prompt: "Waiting for 👍 or ❌ on skill proposal: {{proposed_skill_name}}"
  timeout_seconds: 300
  channel: DISCORD_TASKS_CHANNEL_ID
  message_id: proposal_message_id
  allowed_user: DISCORD_ALLOWED_USER
  watch_reactions: ["👍", "❌"]
```

**On 👍:** proceed to Step 6 (deploy).
**On ❌:** proceed to Step 7 (discard).
**On timeout (no reaction in 5 min):** proceed to Step 7 (discard).

---

## Step 6 — Deploy the Skill (APPROVAL RECEIVED)

**ONLY execute this step after confirmed 👍 reaction from `DISCORD_ALLOWED_USER`.**

Use `code_execution` to prepare the target path:

```python
import os
skill_name = "<PROPOSED_SKILL_NAME>"
target_dir = os.path.expanduser(f"~/.hermes/skills/dhruvaos/{skill_name}")
target_file = os.path.join(target_dir, "SKILL.md")
tests_dir = os.path.join(target_dir, "tests")
print(f"TARGET={target_file}")
print(f"TESTS_DIR={tests_dir}")
```

Then use the `file` tool to create the directory and write the skill:

1. Write `~/.hermes/skills/dhruvaos/{{proposed_skill_name}}/SKILL.md` with `skill_draft` content
2. Write `~/.hermes/skills/dhruvaos/{{proposed_skill_name}}/tests/.gitkeep` (empty placeholder)

After writing, post to `DISCORD_TASKS_CHANNEL_ID`:
```
✅ **Skill `{{proposed_skill_name}}` deployed**
Path: `~/.hermes/skills/dhruvaos/{{proposed_skill_name}}/SKILL.md`
Edit the stub to add implementation steps, then run:
`hermes skill validate {{proposed_skill_name}}`
```

Also save a record to GBrain via `gbrain_think`:
```
Skill deployed: {{proposed_skill_name}}
Description: {{task_description}}
Date: {{today ISO date}}
Status: stub — needs implementation
```

---

## Step 7 — Discard the Proposal

Post to `DISCORD_TASKS_CHANNEL_ID`:
```
🗑 **Proposal discarded**: `{{proposed_skill_name}}`
Reason: {{❌ reaction | timeout after 5 minutes}}
```

Exit cleanly. Do NOT write any files.

---

## Error Handling Summary

| Failure | Action |
|---------|--------|
| Can't parse input | Post guidance to #tasks, exit |
| GBrain search fails | Assume no existing skill, continue to draft |
| Existing skill found | Post info message, stop (no draft) |
| File write fails after approval | Post failure to #tasks, log to skill-errors.log |
| Discord message post fails | Log to skill-errors.log, exit |

---

## Done Condition

Skill is complete when ONE of:

1. **Existing skill surfaced** — posted info to #tasks, exited without deploying
2. **Approved and deployed** — SKILL.md written to `~/.hermes/skills/dhruvaos/{{name}}/`, confirmation posted to #tasks
3. **Discarded** — discard message posted to #tasks, no files written
