---
name: config-update
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Update any DhruvaOS config value via Discord. Drew updates brain/config/ files and re-indexes. Changes take effect on next skill run. Trigger: 'change my X goal to', 'update config', 'set approval timeout to', etc."
trigger: "change my X goal, change my linkedin goal, update config, config update, set approval timeout, raise daily alert, lower cost threshold, change contact threshold, update tweet format, config set, change my posting goal"
tools:
  - gbrain
  - file
  - bash
  - discord_post
gbrain:
  reads: ["config/*"]
  writes: ["config/*"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [config, settings, brain, discord, command]
---

# Config Update

Triggered by natural-language config change requests in Discord #tasks.

Examples:
- "change my X goal to 5 threads per week"
- "raise approval timeout to 20 minutes"
- "lower my daily API cost alert to $1.50"
- "change contact threshold for friends to 21 days"
- "update my LinkedIn post word count to 200-350 words"
- "config update content goals: X=4, LinkedIn=3"

This skill updates values in `~/brain/config/` files and re-indexes them in GBrain.
No approval gate is needed — this is file writes only, no external services.

---

## Config File Map

Use this map to route the user's request to the right file:

| Keywords in request | File | Controls |
|---------------------|------|----------|
| X goal, Twitter goal, X threads, tweet frequency, LinkedIn goal, LinkedIn posts, blog goal, posting frequency, content goals | content-goals.md | X/Twitter goals, LinkedIn goals, Blog goals, posting frequency |
| approval timeout, wait time, approval window, how long Drew waits | approval-timeouts.md | approval wait durations |
| contact threshold, friends threshold, professional threshold, acquaintance threshold, reach out, check-in days | contact-thresholds.md | friend/professional/acquaintance day thresholds |
| tweet format, min tweets, max tweets, hashtag rules, thread format | tweet-format.md | min/max tweets, hashtag rules |
| blog word count, LinkedIn word count, post length, content format, word count | content-format.md | blog word count, LinkedIn word count |
| daily alert, monthly alert, cost alert, API cost threshold, spend threshold | cost-alerts.md | daily/monthly API cost alert thresholds |
| error rate, escalation, monitoring threshold, alert percentage | monitoring.md | error rate thresholds, escalation percentages |
| similarity threshold, context limit, gbrain settings, embed threshold | gbrain-settings.md | similarity thresholds, context limits |

---

## Step 1 — Parse the Config Change Request

Read the user's message carefully. Extract:
- **What setting** is being changed (map it to the config file using the table above)
- **What the new value is** (number, range like "200-350", or string)
- **Which config file** to update (from the map above)

If the request is ambiguous (matches multiple files or the setting cannot be identified), post to Discord and ask for clarification:
```
❓ I'm not sure which config file controls that. Could you clarify?
Options: content-goals.md, approval-timeouts.md, contact-thresholds.md, tweet-format.md, content-format.md, cost-alerts.md, monitoring.md, gbrain-settings.md
```
Then stop — do not guess and overwrite the wrong value.

---

## Step 2 — Read the Current Config File

Use `gbrain search` to find the current file content:

```bash
gbrain search "config/<filename>" --limit 1
```

If GBrain returns the file content, extract the current value of the setting being changed.
Note the current value so you can include it in the confirmation message.

If GBrain search returns nothing, fall back to reading the file directly:

```bash
cat ~/brain/config/<filename>.md
```

If the file does not exist at all, create it with sensible defaults and the new value.
Note that you are creating a new config file in the confirmation.

---

## Step 3 — Apply the Change

Use the `file` tool to:
1. Read `~/brain/config/<filename>.md`
2. Make the targeted change — update **only** the specific value the user requested. Do not
   rewrite the entire file or change anything else.
3. Write the full updated content back.

**Surgical edits only.** If the setting is on a line like:
```
X threads per week: 3
```
Change just the number. Preserve all other lines, formatting, and comments exactly.

If the value appears multiple times (e.g., in a comment and a live setting), update only the
live setting line, not the comment.

Do NOT use shell `sed` to make this change — use the file tool to read, modify in memory, and write back. This avoids shell escaping bugs with special characters.

---

## Step 4 — Re-ingest the Updated File

After writing the file, signal GBrain to re-index it so the change takes effect immediately:

```bash
GBRAIN_BIN="$(command -v gbrain || echo /home/dhruva/.bun/bin/gbrain)"
flock -n ~/.gbrain/gbrain-write.lock sh -lc \
  "$GBRAIN_BIN import ~/brain/config/<filename>.md 2>&1 | head -3 && \
   $GBRAIN_BIN embed --stale 2>&1 | head -3"
```

Replace `<filename>` with the actual file name (without `.md` extension in the path substitution — keep `.md` in the actual command).

If the lock is busy, log it and note it in the confirmation. The file write already succeeded;
the 2am stale embed cron will pick it up later.

If ingest fails, log and continue:
```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] config-update: ingest failed for <filename>" \
  >> ~/.hermes/logs/skill-errors.log
```

---

## Step 5 — Post Confirmation to Discord

Use the `messaging` tool to post to `DISCORD_TASKS_CHANNEL_ID` (#tasks):

```
✅ Config updated: [what was changed]
   [old value] → [new value]
   File: brain/config/<filename>.md
   Takes effect on next skill run.
```

If you created a new file rather than updating an existing one:
```
✅ Config created: brain/config/<filename>.md
   [setting]: [new value]
   Takes effect on next skill run.
```

If ingest was skipped due to a busy lock:
```
✅ Config updated: [what was changed]
   [old value] → [new value]
   File: brain/config/<filename>.md
   ⚠️ GBrain re-index skipped (lock busy) — change will take effect after 2am cron.
```

No outbound approval is needed — this stays inside #tasks and only modifies local config files.

---

## Error Handling

| Failure | Action |
|---------|--------|
| Cannot identify config file | Ask for clarification in Discord, do not guess |
| Config file does not exist | Create it with the new value, note this in confirmation |
| File read fails | Post error to #tasks: "Could not read <filename> — check ~/brain/config/" |
| File write fails | Post error to #tasks: "Failed to update <filename>" |
| GBrain ingest busy/fails | Note in confirmation, file write already succeeded |
| New value is invalid/unclear | Ask user to clarify before writing anything |

Never write a config value that is clearly nonsensical (e.g., negative timeout, zero posts per week) without confirming with the user first.

---

## Done Condition

Skill is complete when:
1. Target config file identified from the map
2. File updated with the new value (surgical edit only)
3. GBrain re-ingest attempted (success or gracefully logged)
4. Confirmation posted to #tasks with old → new value
