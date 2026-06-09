---
name: dev-error-log
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Manual: when a dev/debug session ends, record the bug, failed fixes, the fix that worked, and root cause to ~/brain/dev/error-log.md for future reference."
author: dhruvaos
platforms: [linux, darwin]
prerequisites:
  env_vars: []
gbrain:
  reads: []
  writes: ["dev/error-log.md"]
tests: tests/
metadata:
  hermes:
    tags: [dev, debugging, errors, learning, documentation]
    trigger: manual
---

# Dev Error Log

You are Drew. This skill is called manually (not on cron) at the end of a debugging
or development session where something broke and was fixed — or where something broke
and wasn't fixed yet.

**Purpose:** Build a searchable, timestamped log of development errors so future
debugging sessions can skip the dead ends and go straight to what works.

This is the "what went wrong and what actually fixed it" log — not a task list.

---

## Input

When invoked, you'll receive a description of what happened. It may be:
- A freeform Discord message like "log that error where the cron was failing with openai provider"
- A structured description of bug + fix
- A reference to recent Hermes logs or errors

If the user provides minimal info, fill in what you know from context.

---

## Step 0 — Read Existing Log

Use `read_file` to read `~/brain/dev/error-log.md` (create if missing).

Note the structure of existing entries so you can prepend in the same format.

---

## Step 1 — Classify the Error

Use `code_execution` to determine the tags:

```python
# Classify based on error description
ERROR_TAGS = {
    "model-deprecation": ["model", "404", "deprecated", "shut down", "not found", "model shutdown", "openai provider"],
    "auth": ["auth", "provider", "credentials", "api key", "unknown provider", "unauthorized"],
    "security": ["sql injection", "xss", "timing attack", "auth bypass", "unauthorized"],
    "config": ["config", "yaml", "env", "environment variable", "missing key"],
    "json-parse": ["json", "parse", "fence", "markdown", "```", "serialization"],
    "cron": ["cron", "scheduled", "scheduler", "job failed"],
    "gbrain": ["gbrain", "pglite", "mcp", "brain", "memory"],
    "hermes": ["hermes", "gateway", "skill", "tier", "routing"],
    "deploy": ["deploy", "scp", "systemd", "pm2", "restart"],
    "network": ["timeout", "connection", "refused", "unreachable", "dns"],
    "discord": ["discord", "bot", "channel", "message", "webhook"],
}

description = """[FULL_ERROR_DESCRIPTION_FROM_USER]"""
tags = []
desc_lower = description.lower()
for tag, keywords in ERROR_TAGS.items():
    if any(kw in desc_lower for kw in keywords):
        tags.append(tag)
if not tags:
    tags = ["misc"]
print("TAGS=" + ",".join(tags))
```

---

## Step 2 — Structure the Entry

Use `code_execution` to format the log entry:

```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
timestamp = now.strftime("%Y-%m-%d %H:%M UTC")
date = now.strftime("%Y-%m-%d")

tags_str = " ".join(f"[{t}]" for t in tags)  # from Step 1

# Fill from user input / context
error_description = """[WHAT BROKE — be specific: what service, what error message, what time]"""
failed_fixes = """[WHAT DIDN'T WORK — each attempt that failed, and why]"""
working_fix = """[WHAT ACTUALLY FIXED IT — exact commands or config changes]"""
root_cause = """[WHY IT HAPPENED — underlying cause, not just the symptom]"""
notes = """[ANYTHING USEFUL FOR NEXT TIME — edge cases, watch-outs, related issues]"""

entry = f"""
---

## [{date}] {tags_str}

**Error:** {error_description}

**Failed fixes:**
{failed_fixes}

**Fix that worked:**
{working_fix}

**Root cause:** {root_cause}

**Notes:** {notes}

_Logged: {timestamp}_
"""
print(entry)
```

---

## Step 3 — Prepend to Error Log

Use `read_file` to re-read `~/brain/dev/error-log.md`.

Then use `write_file` to write the new file with the new entry prepended to the existing content.

File header (if file is empty or missing):

```markdown
# Dev Error Log

Reverse-chronological log of bugs, debugging dead ends, and fixes.
Searchable by tag: [model-deprecation] [auth] [security] [config] [json-parse] [cron] [gbrain] [hermes] [deploy] [network] [discord] [misc]

<!-- entries below this line -->
```

Prepend the new entry AFTER the header, BEFORE existing entries.

---

## Step 4 — GBrain Ingest (optional, if significant error)

If the error is tagged with [model-deprecation], [auth], [security], or [hermes], also
write a brief note to GBrain using `gbrain_ingest`:

```markdown
---
title: "Dev error: [SHORT_TITLE]"
tags: ["dev-error", "[TAG1]", "[TAG2]"]
date: "[DATE]"
---
**Error:** [ONE LINE]
**Fix:** [ONE LINE]
**Root cause:** [ONE LINE]
```

Write to `dev/error-log.md` in GBrain (same path).

---

## Step 5 — Confirm

Post a brief confirmation to Discord (only if called from Discord):

```
📝 Error logged: [SHORT_TITLE]
Tags: [model-deprecation] [cron]
File: ~/brain/dev/error-log.md
```

---

## Done Condition

1. Entry added to `~/brain/dev/error-log.md` in reverse-chronological order
2. Tags assigned based on error type
3. Working fix and failed fixes both documented
4. GBrain entry added for high-severity errors

---

## Example Entry

```markdown
## [2026-06-08] [model-deprecation] [cron] [hermes]

**Error:** 3 cron jobs (morning-briefing, contact-health-check, birthday-reminder) failing
with "Unknown provider 'openai'" at 8am. Other skills worked fine.

**Failed fixes:**
- Checked SKILL.md prerequisites — no OPENAI_API_KEY declarations found
- Checked config.yaml auxiliary entries — all google, no openai
- Checked cron job model overrides — morning-briefing had a deprecated model override

**Fix that worked:**
1. Updated global default to `gemini-3.1-flash-lite` in config.yaml (previous value was a deprecated model shut down June 2026)
2. Cleared deprecated model override from morning-briefing cron (null = use global)
Jobs will self-heal on next run.

**Root cause:** Hermes model catalog routes certain deprecated models through `provider: openai`
(OpenAI-compatible Gemini endpoint). No openai provider was configured in `providers: {}`.
Also: global default was a model shut down June 2026, causing 9am batch failures with HTTP 404.

**Notes:** Always verify Gemini model IDs at https://ai.google.dev/gemini-api/docs/models — never trust training data.
Current default: gemini-3.1-flash-lite. Verify current valid IDs before any config change.

_Logged: 2026-06-08 23:00 UTC_
```
