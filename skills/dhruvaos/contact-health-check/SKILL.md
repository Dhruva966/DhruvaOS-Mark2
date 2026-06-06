---
name: contact-health-check
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Daily: scan GBrain + Notion People DB for overdue contact intervals; post alerts to #alerts if any contact window is exceeded."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
    - NOTION_API_KEY
    - NOTION_PEOPLE_DB_ID
gbrain:
  reads: ["people/*"]
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, CRM, Alerts, Daily]
---

# Contact Health Check

You are Drew, Dhruva's personal AI OS agent. This skill runs daily at 8:30am Pacific.
Scan all known contacts and alert Dhruva when he is overdue reaching out to someone.

This is an INTERNAL alert to Discord only. No outbound message to any contact.
No approval gate needed. Auto-post directly.

---

## Tier Windows (absolute, no override)

| Relationship tier | Alert threshold |
|-------------------|----------------|
| friend            | > 30 days since last contact |
| professional      | > 60 days since last contact |
| acquaintance      | > 90 days since last contact |

The tier comes from the GBrain people entry `relationship_tier` field
or the Notion People DB `Relationship` / `Role` field — mapped as:
- "Friend" / "Close Friend" → friend
- "Colleague" / "Mentor" / "Professional" / "Network" → professional
- "Acquaintance" / anything else → acquaintance

---

## Step 0 — Determine Today's Date

Use `code_execution` to get today's date:

```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
today_str = now.strftime("%Y-%m-%d")
print(f"TODAY={today_str}")
```

Store `today_str` as the reference date throughout.

---

## Step 1 — Search GBrain for People Entities

Call `gbrain search` with query: `"people relationship last_contact_date tier"`

Collect all results. For each person entry, extract:
- `name` — display name
- `last_contact_date` — ISO date string (YYYY-MM-DD) or null
- `relationship_tier` — "friend" / "professional" / "acquaintance" (default to acquaintance if missing)
- `slug` — entity slug for deduplication

If GBrain returns no results, continue to Step 2 (Notion is the fallback).

---

## Step 2 — Query Notion People DB

Use `code_execution` to build the Notion API request, then `terminal` to run it:

```python
import json, base64, os

query_body = {
    "page_size": 100,
    "filter": {
        "property": "Last Contact",
        "date": {"is_not_empty": True}
    }
}
encoded = base64.b64encode(json.dumps(query_body).encode()).decode()
print(f"NOTION_PAYLOAD_B64={encoded}")
```

```bash
PAYLOAD_B64="[BASE64 FROM code_execution]"
source ~/.hermes/hermes-agent/venv/bin/activate && \
  PAYLOAD_B64="$PAYLOAD_B64" python3 - <<'PYEOF'
import base64, json, os, urllib.request, urllib.error

body = base64.b64decode(os.environ["PAYLOAD_B64"])
req = urllib.request.Request(
    f"https://api.notion.com/v1/databases/{os.environ['NOTION_PEOPLE_DB_ID']}/query",
    data=body,
    headers={
        "Authorization": f"Bearer {os.environ['NOTION_API_KEY']}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    for page in data.get("results", []):
        props = page.get("properties", {})
        name_prop = props.get("Name", {})
        name = ""
        title = name_prop.get("title", [])
        if title:
            name = title[0].get("plain_text", "")
        last_contact_prop = props.get("Last Contact", {})
        last_contact = (last_contact_prop.get("date") or {}).get("start", "")
        rel_prop = props.get("Relationship", props.get("Role", {}))
        rel = ""
        if "select" in rel_prop and rel_prop["select"]:
            rel = rel_prop["select"].get("name", "")
        print(json.dumps({"name": name, "last_contact": last_contact, "relationship": rel}))
except urllib.error.HTTPError as e:
    print(f"NOTION_ERROR: {e.code} {e.read().decode()[:200]}", flush=True)
PYEOF
```

If output contains `NOTION_ERROR`, note it and continue with GBrain data only.

Parse each JSON line into a contact record. Merge with GBrain results — deduplicate by name
(prefer GBrain entry if slug matches).

---

## Step 3 — Classify and Score Each Contact

Use `code_execution` to compute overdue contacts:

```python
from datetime import datetime, timezone

THRESHOLDS = {"friend": 30, "professional": 60, "acquaintance": 90}

REL_MAP = {
    "Friend": "friend", "Close Friend": "friend",
    "Colleague": "professional", "Mentor": "professional",
    "Professional": "professional", "Network": "professional",
    "Acquaintance": "acquaintance",
}

today = datetime.fromisoformat("[TODAY_STR]").replace(tzinfo=timezone.utc)
contacts = [...]  # list of {"name": ..., "last_contact": "YYYY-MM-DD", "tier": ...}

overdue = []
for c in contacts:
    last_raw = c.get("last_contact") or c.get("last_contact_date")
    if not last_raw:
        continue  # no date on file — skip silently
    try:
        last_dt = datetime.fromisoformat(last_raw).replace(tzinfo=timezone.utc)
    except ValueError:
        continue
    days_ago = (today - last_dt).days
    tier = c.get("tier") or REL_MAP.get(c.get("relationship", ""), "acquaintance")
    threshold = THRESHOLDS.get(tier, 90)
    if days_ago > threshold:
        overdue.append({
            "name": c["name"],
            "tier": tier,
            "days_ago": days_ago,
        })

overdue.sort(key=lambda x: x["days_ago"], reverse=True)
print(f"OVERDUE_COUNT={len(overdue)}")
for o in overdue:
    print(f"OVERDUE: {o['name']} ({o['tier']}): {o['days_ago']} days ago")
```

Replace `[TODAY_STR]` with the actual date from Step 0.

---

## Step 4 — Post Alert (Only If Overdue Contacts Exist)

**If `OVERDUE_COUNT` is 0: stop here. Do NOT post anything to Discord. Skill completes silently.**

If any contacts are overdue, build the alert message (max 1800 characters):

```
👥 Relationship check-in needed:
• <Name> (friend): last contact 45 days ago
• <Name> (professional): last contact 72 days ago
```

Cap at 15 contacts per message. If more than 15 are overdue, append:
`_(+ N more — check ~/brain/people/ for full list)_`

Use the `messaging` tool to post to `DISCORD_ALERTS_CHANNEL_ID` (#alerts).
Do NOT post to any other channel.

---

## Step 5 — Log Completion

Use `terminal` to append a log line:

```bash
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] contact-health-check: checked N contacts, M overdue" \
  >> ~/.hermes/logs/skill-errors.log
```

Replace N with total contacts checked, M with overdue count.

---

## Error Handling

| Failure | Action |
|---------|--------|
| GBrain returns no results | Continue with Notion data only |
| Notion API returns error | Continue with GBrain data only |
| Both sources fail | Post to #alerts: "⚠️ contact-health-check: could not reach GBrain or Notion — check manually" |
| A contact has no last_contact_date | Skip that contact silently |
| Discord post fails | Log to ~/.hermes/logs/skill-errors.log |

Never abort early. If any source yields data, classify and post.

---

## Done Condition

Skill is complete when:
1. All contacts from GBrain + Notion have been checked against their tier window
2. Either: overdue alert posted to #alerts, OR skill exits silently (no overdue contacts)
3. Completion logged to skill-errors.log
