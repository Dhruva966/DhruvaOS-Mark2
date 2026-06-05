---
name: linkedin-post
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a LinkedIn post, preview in #corrections, post only after explicit Dhruva approval via Browserbase cloud browser."
schedule: null
gbrain:
  reads: ["people/*", "projects/*", "goals/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - BROWSERBASE_API_KEY
    - BROWSERBASE_PROJECT_ID
metadata:
  hermes:
    tags: [LinkedIn, Outbound, Phase5, Quality-Firewall, Browserbase]
---

# LinkedIn Post (Phase 5)

**Quality firewall: Tier 2 mandatory. Approval required on EVERY run. No exceptions.**

Triggered by: `/linkedin <context or topic>` in Discord.
Example: `/linkedin Write about what I learned building DhruvaOS this summer`

This skill NEVER posts without explicit 👍 approval in #corrections.

---

## Step 0 — Prerequisites check

Verify required env vars are set before doing anything:
```python
import os
missing = [v for v in ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID",
                        "DISCORD_CORRECTIONS_CHANNEL_ID"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

## Step 1 — Load Context from GBrain

Search GBrain for relevant context before drafting:

```python
topic = "<topic from /linkedin command>"

# Three GBrain queries — combine results
results_1 = gbrain_search(topic)
results_2 = gbrain_search("recent projects accomplishments this month")
results_3 = gbrain_think("What has Dhruva been building or learning lately worth sharing publicly?")

brain_context = "\n\n".join([
    f"On topic:\n{results_1.get('answer', '')}",
    f"Recent work:\n{results_2.get('answer', '')}",
    f"Trajectory:\n{results_3.get('answer', '')}",
])
```

If GBrain returns nothing: draft from command context only, note in preview footer.

---

## Step 2 — Draft with Sonnet (Tier 2)

Using Sonnet quality reasoning, write a LinkedIn post:

**Rules for the draft:**
- 150-300 words (LinkedIn sweet spot for engagement)
- First-person voice, authentic — not corporate or promotional
- Lead with insight, story, or lesson — not announcement ("I'm excited to share...")
- No hashtag spam (max 3 relevant hashtags, at the end only)
- No emoji overdose (0-2 max, only if they fit naturally)
- End with a genuine question or insight that invites conversation
- Tone: thoughtful builder talking to builders — not self-promoter seeking validation
- Do NOT mention DhruvaOS, Drew, or personal AI systems by name (these are private)

```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

draft_text = "<generated LinkedIn post>"
approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(draft_text.encode()).hexdigest()[:16]
expires_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

---

## Step 3 — Post Preview for Approval

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID` (#corrections):

```
📤 [APPROVAL REQUIRED] linkedin-post
Approval ID: {approval_id}
Platform: LinkedIn (Dhruva's personal account)
Model: claude-sonnet-4-6 (Tier 2)
Topic: {topic}
Content SHA-256: {content_hash}
Expires: {expires} (10 min)
---
{draft_text}
---
React 👍 to post · Reply /deny {approval_id} to discard
```

**HARD STOP:** Use the `clarify` tool to wait. Timeout: 10 minutes.

Validate before proceeding:
- Reaction MUST be 👍 (not any other emoji)
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Current time MUST be before `expires`
- Preview message MUST NOT have been edited

If any validation fails: post "❌ Approval rejected — [reason]. Re-run /linkedin to try again." Stop.
If timeout: post "⏱ LinkedIn draft expired — re-run /linkedin if still needed." Stop.

---

## Step 4 — Post to LinkedIn via Browserbase

After valid 👍 approval, open a cloud browser session and post to LinkedIn.

**4a — Create Browserbase session**

Use the `browserbase_create_session` MCP tool:
```json
{
  "projectId": "${BROWSERBASE_PROJECT_ID}",
  "browserSettings": {
    "viewport": {"width": 1280, "height": 800}
  }
}
```
Store the returned `sessionId`.

**4b — Navigate to LinkedIn and verify login**

Use `browserbase_navigate`:
```json
{"url": "https://www.linkedin.com/feed/"}
```

Use `browserbase_screenshot` to capture state. Check the page:
- If login form visible → stop, post to #corrections:
  "❌ LinkedIn session not authenticated. Open Browserbase dashboard, navigate to linkedin.com in a live session, and log in manually. Then retry."
  Close session and stop.
- If feed visible → proceed.

**4c — Open post composer**

Use `browserbase_click` to click the "Start a post" / "Create a post" button:
```json
{"selector": "[data-test-id='share-box-trigger'], .share-box-feed-entry__trigger, button[aria-label*='Start a post'], button[aria-label*='Create a post']"}
```

Wait 1 second for composer to open. Take screenshot to confirm.

If composer did not open: try alternate selectors:
```json
{"selector": "button[class*='share-box'], [aria-label='Add a photo'], div[data-test-id='share-box']"}
```

**4d — Type post content**

Use `browserbase_click` on the post text area:
```json
{"selector": "[data-test-id='share-creation-state__editor'], div[role='textbox'][aria-label*='text'], .ql-editor"}
```

Use `browserbase_type` to enter the approved draft:
```json
{"text": "{draft_text}"}
```

Take screenshot. Verify text appeared in composer.

**4e — Submit post**

Use `browserbase_click` on the "Post" button:
```json
{"selector": "button[aria-label='Post'], button.share-actions__primary-action, button[data-test-id='share-form-update__submit-btn']"}
```

Wait 2 seconds. Take final screenshot to confirm post succeeded.
Check for: success toast ("Post successful"), post appearing in feed, or composer closed.

**4f — Close session**

Always close the session regardless of outcome:
Use `browserbase_close_session` with the stored `sessionId`.

---

## Step 5 — Confirm

Post success to Discord #corrections:
```
✅ LinkedIn post published
Topic: {topic}
Preview: {first 80 chars of draft_text}...
```

If Step 4 failed at any point: report exact failure step + screenshot description to #corrections.
Do NOT retry automatically. Let Dhruva decide.

---

## Error handling

| Failure | Action |
|---------|--------|
| Missing env vars | Stop before drafting, report which vars are missing |
| GBrain returns nothing | Draft from command context only, note "(no GBrain context)" in preview footer |
| Draft not approved in 10min | Discard, post "Approval expired" |
| LinkedIn not logged in | Stop, post authentication instructions, close browser |
| Composer not found | Try alternate selectors (see 4c); if still fails, post error + screenshot |
| Post button not found | Post error to #corrections with screenshot, do NOT guess-click |
| Browserbase session error | Post error with sessionId to #corrections |

**Never retry a failed post silently.** Always report to #corrections.

---

## Selector maintenance note

LinkedIn regularly updates its DOM. If selectors in Steps 4c-4e start failing,
check the current LinkedIn DOM via `browserbase_navigate` + `browserbase_screenshot`
and update the selectors in this SKILL.md. The `data-test-id` attributes are most
stable; `aria-label` attributes are second-most stable; class names drift frequently.

---

## Prerequisites for first use

1. Browserbase account at browserbase.com → get `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`
2. Add both to `~/.hermes/.env` on Omen
3. Add Browserbase MCP to `~/.hermes/config.yaml`:
   ```yaml
   mcp_servers:
     browserbase:
       command: npx
       args: ["-y", "@browserbase/mcp-server-browserbase"]
       env:
         BROWSERBASE_API_KEY: "${BROWSERBASE_API_KEY}"
         BROWSERBASE_PROJECT_ID: "${BROWSERBASE_PROJECT_ID}"
   ```
4. Restart Hermes: `systemctl --user restart hermes-gateway`
5. Authenticate LinkedIn in Browserbase: open a live session in Browserbase dashboard →
   navigate to linkedin.com → log in → session context is now persisted for future runs
6. P3.3 quality firewall gate must have passed before this skill goes live
