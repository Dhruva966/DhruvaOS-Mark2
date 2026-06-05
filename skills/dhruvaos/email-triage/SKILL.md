---
name: email-triage
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Read unread Gmail (last 48h), classify by type, extract action items, post digest to Discord #tasks. Read-only — never drafts or sends replies."
schedule: null
gbrain:
  reads: ["people/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - GMAIL_CLIENT_ID
    - GMAIL_CLIENT_SECRET
    - GMAIL_REFRESH_TOKEN
    - DISCORD_TASKS_CHANNEL_ID
metadata:
  hermes:
    tags: [Email, Triage, Discord, Daily]
---

# Email Triage

You are reading Dhruva's Gmail inbox, classifying emails, and surfacing action items to Discord.
You NEVER reply to emails. You NEVER draft emails. You NEVER send anything externally.

## Step 1 — Fetch Emails

Use the `terminal` tool to run:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py gmail 2>&1
```

This returns a JSON array of up to 20 unread emails. Each item has: `id`, `subject`, `from`, `date`, `snippet`.

If the command fails or returns an empty array, post to Discord: "📬 **Email Triage** — No unread emails or fetch failed. Check Google credentials." and stop.

## Step 2 — Classify Each Email

For each email, reason through the classification using only the subject, sender, and snippet:

- **ACTION_REQUIRED** — Dhruva must do something (reply, fill a form, make a decision, attend something, pay, sign)
- **FYI** — Informational, no action needed (receipts, confirmations, status updates worth knowing)
- **NEWSLETTER** — Marketing, subscriptions, mailing lists, promotional content
- **SPAM** — Unsolicited, irrelevant, or suspicious

For every ACTION_REQUIRED email also extract:
- What action is needed (one sentence, imperative)
- Deadline if mentioned (or "No deadline stated")

Data minimization: Discord is internal but still hosted by a third party. Do not post full
email bodies or long snippets. Redact unnecessary personal details and include only the sender
label, subject, action, and deadline needed for Dhruva to decide what to do.

## Step 3 — Build the Digest

Construct a Discord message with this structure:

```
📬 **Email Triage** — [N] action items · [M] FYI · [K] auto-archived

**Action Required**
1. From: [sender name] | [subject]
   → [what action is needed] | Due: [deadline or "—"]
2. ...
(show up to 5; if more than 5, say "…and [X] more — check inbox")

**FYI** (marked as read)
**Auto-archived** — newsletters and spam marked as read
```

If there are zero ACTION_REQUIRED items:
```
📬 **Email Triage** — Inbox clear. 0 action items · [M] FYI · [K] auto-archived
```

## Step 4 — Post to Discord

Use the `messaging` tool to post the formatted digest to `DISCORD_TASKS_CHANNEL_ID` (#tasks).
No approval needed — this is an internal briefing.
Keep the message under 1800 characters to stay within Discord's 2000-character limit. If the digest would be longer, truncate the ACTION_REQUIRED list to the top 3 and append '…(full list in Gmail inbox)'

## Step 5 — Mark FYI / NEWSLETTER / SPAM as Read

Collect the `id` values for all non-ACTION_REQUIRED emails, then use `terminal` to run:

```bash
source ~/.hermes/hermes-agent/venv/bin/activate
python3 - <<'PYEOF'
import os, sys, json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

creds = Credentials(
    token=None,
    refresh_token=os.environ["GMAIL_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["GMAIL_CLIENT_ID"],
    client_secret=os.environ["GMAIL_CLIENT_SECRET"],
    scopes=["https://www.googleapis.com/auth/gmail.modify"],
)
service = build("gmail", "v1", credentials=creds)

# Replace with actual IDs from Step 2 (strings, comma-separated in list)
ids_to_mark_read = []  # AGENT: populate with actual IDs

for msg_id in ids_to_mark_read:
    try:
        service.users().messages().modify(
            userId="me", id=msg_id, body={"removeLabelIds": ["UNREAD"]}
        ).execute()
        print(f"Marked read: {msg_id}")
    except Exception as e:
        print(f"Failed to mark {msg_id}: {e}")
print("Done.")
PYEOF
```

Populate `ids_to_mark_read` with the actual IDs from Step 2. Do NOT include ACTION_REQUIRED email IDs.

## Step 6 — Done

Log completion. Do not take any further action. Do not reply to any email.
If any step fails, note the error in the Discord post rather than silently dropping it.
