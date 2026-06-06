---
name: x-thread-draft
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a 5-7 tweet thread with Sonnet, preview in #corrections, submit to XPosterOS queue only after explicit Dhruva 👍 approval."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
    - XPOSTEROS_API_URL
metadata:
  hermes:
    tags: [Twitter, X, Thread, Outbound, Phase13, Quality-Firewall, XPosterOS, Tier2]
---

# X Thread Draft (Phase 13)

**Quality firewall: Tier 2 mandatory. Approval required on EVERY run. No exceptions.**

Triggered by: `/thread "<topic>"` in Discord.
Example: `/thread "Why I stopped using feature flags and what I use instead"`

This skill NEVER submits to XPosterOS without explicit 👍 approval from Dhruva in #corrections.

---

## Step 0 — Prerequisites check

```python
import os

DISCORD_CORRECTIONS_CHANNEL_ID = os.environ.get("DISCORD_CORRECTIONS_CHANNEL_ID")
DISCORD_ALLOWED_USER = os.environ.get("DISCORD_ALLOWED_USER")
XPOSTEROS_API_URL = os.environ.get("XPOSTEROS_API_URL", "http://127.0.0.1:8081")

missing = [v for v in ["ANTHROPIC_API_KEY", "DISCORD_CORRECTIONS_CHANNEL_ID", "DISCORD_ALLOWED_USER"]
           if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")
```

---

## Step 1 — Parse topic from command

```python
import re, sys

raw_command = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else ""
topic_match = re.search(r'"(.+?)"', raw_command) or re.search(r"'(.+?)'", raw_command)
topic = topic_match.group(1) if topic_match else raw_command.strip()

if not topic:
    raise SystemExit('Usage: /thread "<topic>" — topic is required.')
```

---

## Step 2 — Load context from GBrain

Two searches to inform the thread:

```python
results_1 = gbrain_search(f"{topic} context details experience")
results_2 = gbrain_search(f"{topic} insights thoughts opinions lessons")

brain_context = "\n\n".join(filter(None, [
    results_1.get("answer", ""),
    results_2.get("answer", ""),
])).strip()
```

If both return nothing: draft from topic only, note "(no GBrain context)" in the preview footer.

---

## Step 3 — Draft thread with Sonnet (Tier 2, required)

Using Claude Sonnet 4.6 (Tier 2). Mandatory for outbound writing — never downgrade.

**Thread rules:**
- 5-7 tweets total
- Tweet 1: hook — surprising claim, counterintuitive insight, or bold question (≤280 chars, hard limit)
- Tweets 2-6: one supporting point per tweet — specific, concrete, no fluff
- Final tweet: clear takeaway or call to action — what should the reader do or think next?
- Max 2 hashtags total, in the last tweet only — no hashtag spam
- NO "🧵 Thread:" opener — that's a cliche
- NO "That's a wrap!" or "End of thread" closers
- NO "I'm excited to share" or hype framing
- Authentic builder voice — specific > vague, honest > polished
- Each tweet must stand alone (no "2/" numbering in the content — that's added in the preview)

Prompt to Sonnet:
```
Write a Twitter/X thread about: "{topic}"

Context from my notes:
{brain_context[:1200] if brain_context else "(no context available — draft from topic only)"}

Requirements:
- 5-7 tweets
- Tweet 1: hook — surprising claim or counterintuitive insight (≤280 chars, this is a hard limit)
- Middle tweets: one concrete supporting point each (≤280 chars each)
- Last tweet: clear takeaway or call to action (max 2 hashtags here only)
- NO "🧵 Thread:" opener, NO "That's a wrap!" closer
- Authentic builder voice: specific, honest, no hype
- Each tweet complete on its own (no "...continues in next tweet")

Return as JSON array of strings, one string per tweet:
["tweet 1 text", "tweet 2 text", ...]

Return ONLY the JSON array, no explanation.
```

Parse response into `tweets` list. Validate:
- Length: 5 ≤ len(tweets) ≤ 7
- Each tweet ≤ 280 characters
- If any tweet exceeds 280 chars, retry with explicit: "Tweet {i} is {len} chars — must be ≤280. Shorten it."

---

## Step 4 — Generate approval metadata

```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

full_thread_text = "\n".join(tweets)
approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(full_thread_text.encode()).hexdigest()[:16]
expires_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

---

## Step 5 — Post approval preview to #corrections

**APPROVAL REQUIRED BEFORE ANY XPosterOS SUBMISSION.**

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID`:

```
📤 [APPROVAL REQUIRED] x-thread-draft
Approval ID: {approval_id}
Topic: {topic}
Tweets: {len(tweets)}
Model: claude-sonnet-4-6 (Tier 2)
Content SHA-256: {content_hash}
Expires: {expires} (10 min)
---
1/ {tweets[0]}

2/ {tweets[1]}

3/ {tweets[2]}
...
---
React 👍 to submit to XPosterOS queue · Reply /deny {approval_id} to discard
```

Build the numbered preview programmatically:
```python
numbered = "\n\n".join(f"{i+1}/ {tweet}" for i, tweet in enumerate(tweets))
```

If brain_context was empty, add at the end:
```
⚠️ Note: drafted without GBrain context (no matching memories found).
```

**HARD STOP.** Use the `clarify` tool to wait for Dhruva's reaction. Timeout: 10 minutes.

Validate before proceeding:
- Reaction MUST be 👍 (not any other emoji)
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Current time MUST be before `expires`
- Preview message MUST NOT have been edited after posting

If any validation fails: post "❌ Approval rejected — [reason]. Re-run /thread to try again." Stop.
If timeout: post "⏱ Thread draft expired — re-run /thread if still needed." Stop.

---

## Step 6 — Submit to XPosterOS

After valid 👍 approval, POST to XPosterOS:

```python
import json, urllib.request, urllib.error

thread_content = "\n\n".join(f"{i+1}/ {tweet}" for i, tweet in enumerate(tweets))

payload = {
    "platform": "x",
    "content": thread_content,
    "type": "thread",
}

request = urllib.request.Request(
    f"{XPOSTEROS_API_URL}/drafts",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=10) as response:
        response_data = json.loads(response.read())
        draft_id = response_data.get("id", "unknown")
except urllib.error.URLError as e:
    post "❌ XPosterOS submission failed: {e}. Check if XPosterOS is running: systemctl --user status xposteros-api"
    stop
```

---

## Step 7 — Confirm

Post to `DISCORD_CORRECTIONS_CHANNEL_ID`:
```
✅ Thread queued in XPosterOS. Check #tasks for posting schedule.
Draft ID: {draft_id[:8] if draft_id != "unknown" else "see XPosterOS"}
Topic: {topic}
```

On deny/timeout (Step 5 exit):
```
Thread draft discarded.
Approval ID: {approval_id}
Topic: {topic}
```

---

## Error handling

| Failure | Action |
|---------|--------|
| Missing env vars | Stop before drafting, report which vars are missing |
| Topic not provided | Stop, show usage: `/thread "<topic>"` |
| GBrain returns nothing | Draft from topic only, note in preview footer |
| Sonnet call fails | Post "⚠️ x-thread-draft: Sonnet call failed. Check ANTHROPIC_API_KEY." to #corrections |
| Tweet exceeds 280 chars | Retry once with specific truncation instruction; if still fails, post error |
| Wrong number of tweets (< 5 or > 7) | Retry once; if still fails, post error to #corrections |
| Draft not approved in 10min | Discard, post "⏱ Thread draft expired" |
| XPosterOS connection refused | Post error + service check command; do NOT retry silently |
| XPosterOS returns error status | Post exact error body to #corrections |
| Wrong reactor (not DISCORD_ALLOWED_USER) | Reject with "❌ Approval must come from Dhruva's account." |

**Never submit to XPosterOS without approval. Never retry a failed submission silently.**

---

## XPosterOS integration notes

- Base URL: `http://127.0.0.1:8081` (default, override with XPOSTEROS_API_URL env var)
- Auth: none required for `/drafts` POST (internal localhost API)
- If XPosterOS is in dry_run mode, the draft will be created but not queued for posting
- Check XPosterOS service: `systemctl --user status xposteros-api`
- Check XPosterOS dry_run status: `curl -s http://127.0.0.1:8081/system/health | grep dry_run`
- After queuing, Dhruva reviews and schedules via the XPosterOS frontend or xposteros-control skill

---

## Prerequisites for first use

1. XPosterOS running on Omen: `systemctl --user status xposteros-api` → active
2. `XPOSTEROS_API_URL=http://127.0.0.1:8081` in `~/.hermes/.env` (or use default)
3. `DISCORD_ALLOWED_USER` set to Dhruva's Discord user ID in `~/.hermes/.env`
4. `ANTHROPIC_API_KEY` set in `~/.hermes/.env`
5. P3.3 quality firewall gate must have passed before this skill goes live
