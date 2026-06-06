---
name: blog-draft
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a 600-900 word blog post with Sonnet, preview in #corrections, publish via personal-site-update only after explicit Dhruva 👍 approval."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "weekly/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [Blog, Outbound, Phase13, Quality-Firewall, Writing, Tier2]
---

# Blog Draft (Phase 13)

**Quality firewall: Tier 2 mandatory. Approval required on EVERY run. No exceptions.**

Triggered by: `/blog "<title>"` in Discord #corrections or #tasks.
Example: `/blog "Building a personal AI OS on a budget"`

This skill NEVER publishes without explicit 👍 approval from Dhruva in #corrections.
After approval, delegates publishing to the personal-site-update skill.

---

## Step 0 — Prerequisites check

```python
import os

missing = [v for v in ["ANTHROPIC_API_KEY", "DISCORD_CORRECTIONS_CHANNEL_ID", "DISCORD_ALLOWED_USER"]
           if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")

DISCORD_CORRECTIONS_CHANNEL_ID = os.environ.get("DISCORD_CORRECTIONS_CHANNEL_ID")
DISCORD_ALLOWED_USER = os.environ.get("DISCORD_ALLOWED_USER")
```

---

## Step 1 — Parse title from command

```python
import re, sys

# Command format: /blog "Title of the Post"
# Title may be quoted or unquoted
raw_command = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else ""
title_match = re.search(r'"(.+?)"', raw_command) or re.search(r"'(.+?)'", raw_command)
title = title_match.group(1) if title_match else raw_command.strip()

if not title:
    raise SystemExit('Usage: /blog "<title>" — title is required.')
```

---

## Step 2 — Load context from GBrain

Three searches to inform the draft:

```python
results_1 = gbrain_search(f"{title} details context background")
results_2 = gbrain_search("recent projects work learning accomplishments")
results_3 = gbrain_search(f"{title} related thoughts ideas insights")

brain_context = "\n\n".join(filter(None, [
    results_1.get("answer", ""),
    results_2.get("answer", ""),
    results_3.get("answer", ""),
])).strip()
```

If all three return nothing: draft from title only, note "(no GBrain context)" in the preview footer.

---

## Step 3 — Draft with Sonnet (Tier 2, required)

Using Claude Sonnet 4.6 (Tier 2), write a blog post. This model is mandatory — never downgrade to Tier 1 for outbound writing.

**Rules for the draft:**
- 600-900 words (target: ~750)
- First-person, conversational but substantive
- Lead with a concrete insight, story, or surprising observation — NOT "today I'm going to talk about"
- Include code snippets or specific examples where relevant
- H2 headings only (no H1 — the title is separate in the site's front matter)
- End with a genuine question, next step, or open thread — not a summary
- Tone: technical builder talking to other builders — not self-promoter, not tutorial-bot
- No DhruvaOS, "Drew", or personal AI system names by name (these are private)
- Format: markdown

Prompt to Sonnet:
```
Write a blog post titled "{title}" for a personal developer blog.

Context from my notes:
{brain_context[:1500] if brain_context else "(no context available — draft from title only)"}

Requirements:
- 600-900 words
- First-person, conversational but substantive
- Lead with a concrete insight or story, NOT an announcement or "in this post I will"
- Include specific examples, code snippets, or data points where relevant
- H2 headings only (no H1)
- End with a genuine question or next step, not a summary
- Tone: builder talking to builders — no hype, no generic advice
- Format: markdown only

Return ONLY the post body (no front matter, no title H1). Start with the opening line directly.
```

Store the response as `draft_text`.

---

## Step 4 — Estimate read time

```python
word_count = len(draft_text.split())
read_time_min = max(1, round(word_count / 200))
```

---

## Step 5 — Generate approval metadata

```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(draft_text.encode()).hexdigest()[:16]
expires_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

---

## Step 6 — Post approval preview to #corrections

**APPROVAL REQUIRED BEFORE ANY PUBLISHING ACTION.**

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID`:

```
📤 [APPROVAL REQUIRED] blog-draft
Approval ID: {approval_id}
Title: {title}
Est. read time: ~{read_time_min} min ({word_count} words)
Model: claude-sonnet-4-6 (Tier 2)
Content SHA-256: {content_hash}
Expires: {expires} (10 min)
---
{draft_text}
---
React 👍 to publish via personal-site-update · Reply /deny {approval_id} to discard
```

If brain_context was empty, add at the end of the preview:
```
⚠️ Note: drafted without GBrain context (no matching memories found).
```

**HARD STOP.** Use the `clarify` tool to wait for Dhruva's reaction. Timeout: 10 minutes.

Validate before proceeding:
- Reaction MUST be 👍 (not any other emoji)
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Current time MUST be before `expires`
- Preview message MUST NOT have been edited after posting

If any validation fails: post "❌ Approval rejected — [reason]. Re-run /blog to try again." Stop.
If timeout: post "⏱ Blog draft expired — re-run /blog if still needed." Stop.

---

## Step 7 — Delegate publishing to personal-site-update

After valid 👍 approval, call the personal-site-update skill with the approved content.

Pass the following to personal-site-update:
```python
# Invoke personal-site-update as a sub-skill
# The approved title and content are passed as arguments
hermes_invoke_skill("personal-site-update", {
    "content_type": "blog",
    "title": title,
    "draft_content": draft_text,
})
```

If personal-site-update is not available as a direct sub-skill call, instruct Hermes to:
1. Write a temp file at `~/tmp/blog-draft-{approval_id}.md` with the approved content
2. Trigger `/site blog "{title}"` command with the pre-drafted content loaded

The personal-site-update skill handles all GitHub MCP operations and its own confirmation.

---

## Step 8 — Confirm or report

If publishing succeeded (personal-site-update confirmed):
Post to #corrections:
```
✅ Blog post handed off to personal-site-update for publishing.
Title: {title}
Approval ID: {approval_id}
```

If personal-site-update fails: report the error to #corrections. Do NOT retry automatically.

On deny/timeout (Step 6 exit):
```
Blog draft discarded.
Approval ID: {approval_id}
Title: {title}
```

---

## Error handling

| Failure | Action |
|---------|--------|
| Missing env vars | Stop before drafting, report which vars are missing |
| Title not provided | Stop, show usage: `/blog "<title>"` |
| GBrain returns nothing | Draft from title only, note in preview footer |
| Sonnet call fails | Post "⚠️ blog-draft: Sonnet call failed. Check ANTHROPIC_API_KEY." to #corrections |
| Draft not approved in 10min | Discard, post "⏱ Blog draft expired" |
| personal-site-update fails | Post error to #corrections, do NOT retry |
| Wrong reactor (not DISCORD_ALLOWED_USER) | Reject with "❌ Approval must come from Dhruva's account." |

**Never publish without approval. Never retry a failed publish silently.**

---

## Notes

- Tier 2 (Sonnet) is mandatory for this skill — blog posts are outbound human-readable content
- personal-site-update handles all GitHub commit logic — blog-draft focuses only on drafting + approval
- The 10-minute timeout is intentional — if Dhruva hasn't reviewed in 10 minutes, the draft should be regenerated fresh
- Draft is NOT saved to brain before approval — only commits on publish (personal-site-update writes the committed version)
