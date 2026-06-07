---
name: post-interaction-log
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Command: /met <person> <notes> — log an in-person or remote interaction to brain, update GBrain facts, update Notion People DB Last Contact date."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - NOTION_API_KEY
    - NOTION_PEOPLE_DB_ID
gbrain:
  reads: ["people/*"]
  writes: ["people/*/interactions/YYYY-MM-DD.md"]
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, CRM, Logging, Command]
---

# Post Interaction Log

Triggered by `/met <person-name> <notes>` in any Discord channel.

Examples:
- `/met Alex Chen caught up over coffee, he's moving to SF next month for a new PM role at Stripe`
- `/met "Sarah Kim" quick call, she's launching her startup in August, needs intro to investors`

Parse the person name and notes, write an interaction log file to brain,
update GBrain facts, update Notion, and confirm in Discord.

This is INTERNAL only. Nothing is sent to the contact. No approval gate needed.

---

## Step 0 — Parse Command Input

Extract from the Discord message:
- **person_name** — everything between `/met ` and the first sentence break, OR a quoted string
  - Examples: `/met Alex Chen ...` → "Alex Chen"
  - Examples: `/met "Sarah Kim" ...` → "Sarah Kim"
- **notes** — the rest of the message after the name
- **today_str** — current date as YYYY-MM-DD

Use `code_execution`:

```python
import re
from datetime import datetime, timezone

msg = "[FULL DISCORD MESSAGE CONTENT]"
msg = msg.strip()

# Strip the /met prefix
if msg.lower().startswith("/met "):
    msg = msg[5:].strip()

# Try quoted name first
m = re.match(r'^"([^"]+)"\s*(.*)', msg, re.DOTALL)
if not m:
    # Unquoted: name is up to 3 words that look like a proper name
    m = re.match(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(.*)', msg, re.DOTALL)
if not m:
    # Fallback: first word is name, rest is notes
    parts = msg.split(None, 1)
    person_name = parts[0] if parts else ""
    notes = parts[1] if len(parts) > 1 else ""
else:
    person_name, notes = m.group(1), m.group(2)

today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

print(f"PERSON={person_name}")
print(f"TODAY={today_str}")
print(f"NOTES_LEN={len(notes)}")
```

If `person_name` is empty, post to #tasks:
`❌ Usage: /met <person name> <notes about the interaction>`
and stop.

---

## Step 1 — Find Person in GBrain

Call `gbrain search` with query: `"<person_name> person contact people"`

Extract:
- `slug` — entity slug (e.g., "alex-chen") for the file path
- Confirmation the person exists in GBrain
- Any existing facts about the person (will be used in Step 5)

If no match found in GBrain, derive slug from name:
```python
slug = person_name.lower().replace(" ", "-").replace("'", "")
```
Note that this is a new contact not yet in GBrain — new facts will create their entry.

---

## Step 2 — Write Interaction Log File

Use `terminal` to ensure the directory exists:

```bash
mkdir -p ~/brain/people/[SLUG]/interactions/
```

Use the `file` tool to write `~/brain/people/[SLUG]/interactions/[TODAY_STR].md`:

```markdown
---
date: [TODAY_STR]
person: [PERSON_NAME]
---

[NOTES]
```

Replace `[SLUG]`, `[TODAY_STR]`, `[PERSON_NAME]`, and `[NOTES]` with actual values.

Do NOT overwrite if a file for today already exists — append instead:

```bash
test -f ~/brain/people/[SLUG]/interactions/[TODAY_STR].md && echo "EXISTS" || echo "NEW"
```

If file EXISTS: use `file` tool to read existing content, then write back with the new notes
appended after a blank line separator `---`.

---

## Step 3 — Update GBrain: Last Contact Fact

Call `gbrain call extract_facts` with the fact:
`"Last interacted with [PERSON_NAME] on [TODAY_STR]"`

This updates the `last_contact_date` field in GBrain for that person.
Use `entity_slug: [SLUG]` if known from Step 1.

---

## Step 4 — Extract New Facts with phi4-mini

Use `code_execution` to build an Ollama prompt, then `terminal` to call it:

```bash
export PATH=/home/dhruva/.bun/bin:/home/dhruva/.hermes/bin:/home/dhruva/.local/bin:$PATH
NOTES_B64="[BASE64_ENCODED_NOTES]"
python3 - <<'PYEOF'
import base64, json, os, urllib.request

notes = base64.b64decode(os.environ.get("NOTES_B64", "")).decode("utf-8")
person = "[PERSON_NAME]"

prompt = f"""Extract factual updates about {person} from these interaction notes.
Return a JSON array of strings. Each string is a new fact about {person}.
Focus on: job changes, location moves, new projects, life events, relationship status, goals.
Ignore small talk. Return [] if no new facts found.

Notes: {notes}

Return ONLY valid JSON array, no explanation."""

payload = json.dumps({"model": "phi4-mini", "prompt": prompt, "stream": False})
req = urllib.request.Request(
    "http://localhost:11434/api/generate",
    data=payload.encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
    print(result.get("response", "[]"))
except Exception as e:
    print("[]")
    import sys; print(f"OLLAMA_ERROR: {e}", file=sys.stderr)
PYEOF
```

Parse the JSON array. For each fact string:
- Call `gbrain call extract_facts` with the fact and `entity_slug: [SLUG]`
- Count successful insertions

Store `new_facts_count` = number of successfully inserted facts.

If Ollama is unavailable (connection refused), set `new_facts_count = 0` and continue —
the interaction log file was already written, which is the durable artifact.

---

## Step 5 — Update Notion People DB

Use `code_execution` to build Notion API payload, then `terminal` to run:

```python
import json, base64

# First: search Notion People DB for the person by name
search_body = {
    "filter": {
        "property": "Name",
        "title": {"contains": "[PERSON_NAME]"}
    }
}
encoded = base64.b64encode(json.dumps(search_body).encode()).decode()
print(f"SEARCH_B64={encoded}")
```

```bash
SEARCH_B64="[BASE64 FROM code_execution]"
TODAY_STR="[TODAY_STR]"
source ~/.hermes/hermes-agent/venv/bin/activate && \
  SEARCH_B64="$SEARCH_B64" TODAY_STR="$TODAY_STR" python3 - <<'PYEOF'
import base64, json, os, urllib.request, urllib.error

notion_key = os.environ["NOTION_API_KEY"]
db_id = os.environ["NOTION_PEOPLE_DB_ID"]
today = os.environ["TODAY_STR"]
headers = {
    "Authorization": f"Bearer {notion_key}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}

search_body = base64.b64decode(os.environ["SEARCH_B64"])
req = urllib.request.Request(
    f"https://api.notion.com/v1/databases/{db_id}/query",
    data=search_body, headers=headers, method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        results = json.loads(resp.read()).get("results", [])
    if not results:
        print("NOTION_NOT_FOUND")
    else:
        page_id = results[0]["id"]
        update_body = json.dumps({
            "properties": {"Last Contact": {"date": {"start": today}}}
        }).encode()
        req2 = urllib.request.Request(
            f"https://api.notion.com/v1/pages/{page_id}",
            data=update_body, headers=headers, method="PATCH",
        )
        with urllib.request.urlopen(req2) as resp2:
            print(f"NOTION_OK: {json.loads(resp2.read())['id']}")
except urllib.error.HTTPError as e:
    print(f"NOTION_ERROR: {e.code} {e.read().decode()[:200]}")
PYEOF
```

If `NOTION_NOT_FOUND`: note this in confirmation but do NOT abort — GBrain is the source of truth.
If `NOTION_ERROR`: note in confirmation but continue.

---

## Step 6 — GBrain Ingest Interaction File

Signal GBrain to index the new interaction log:

```bash
export PATH=/home/dhruva/.bun/bin:/home/dhruva/.hermes/bin:/home/dhruva/.local/bin:$PATH
GBRAIN_BIN="$(command -v gbrain || echo /home/dhruva/.bun/bin/gbrain)"
flock -n ~/.gbrain/gbrain-write.lock sh -lc \
  "$GBRAIN_BIN import ~/brain/people/[SLUG]/interactions/[TODAY_STR].md 2>&1 | head -3"
```

If the lock is busy, skip — the nightly embed cron will index it.

---

## Step 7 — Post Confirmation to Discord

Use the `messaging` tool to post to `DISCORD_TASKS_CHANNEL_ID` (#tasks):

```
✅ Logged interaction with <person_name>. <N> new fact(s) extracted.
📅 Last contact updated: <TODAY_STR>
📂 ~/brain/people/<slug>/interactions/<today_str>.md
```

If Notion was updated: append `📋 Notion updated.`
If Notion person not found: append `⚠️ Not found in Notion People DB — add manually if needed.`

---

## Error Handling

| Failure | Action |
|---------|--------|
| Person name not parseable | Post usage hint to #tasks and stop |
| Brain file write fails | Post error to #tasks; GBrain fact still created |
| Ollama unavailable | Set new_facts_count=0, continue — log file is the durable artifact |
| GBrain extract_facts fails | Note in confirmation; interaction file still written |
| Notion person not found | Note in confirmation; not an error |
| Notion API error | Note in confirmation; not fatal |
| Discord confirmation fails | Log to ~/.hermes/logs/skill-errors.log |

---

## Done Condition

Skill is complete when:
1. Interaction log written to `~/brain/people/<slug>/interactions/<today_str>.md`
2. GBrain last_contact fact updated
3. phi4-mini fact extraction attempted (0+ new facts OK)
4. Notion Last Contact date updated (or not-found noted)
5. Confirmation posted to #tasks
