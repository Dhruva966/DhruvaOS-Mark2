---
name: social-dispatch
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Router for social media posting requests. When Dhruva says 'post on socials', 'I want to post something', 'help me post', or similar — identify the platform and hand off to the right skill."
trigger: "post on socials, want to post, help me post, post something, social media, share on X, share on LinkedIn, create a post, I have an idea to post, post this, tweet this, post it"
tools:
  - discord_post
tests: tests/
platforms: [linux]
---

# Social Dispatch

Router skill. When Dhruva says anything about wanting to post on social media without specifying the exact command, this skill clarifies and routes to the right tool.

**DO NOT ask Dhruva to run any commands themselves. Drew handles everything.**

---

## When this fires

Any message like:
- "I want to post on socials"
- "help me post something"
- "can I post about X"
- "I have an idea for a post"
- "share this on X / Twitter / LinkedIn"

---

## Step 1 — Identify what Dhruva wants

Read the message to determine:
- **Platform:** X/Twitter, LinkedIn, or unspecified
- **Content:** A topic, idea, or raw text
- **Stage:** Does Dhruva have content ready, or needs a draft?

If platform unspecified, ask:
```
Where do you want to post — X/Twitter or LinkedIn?
(Or say both if you want both)
```

If content unspecified, ask:
```
What's the topic or idea you want to post about?
```

---

## Step 2 — Route to the right skill

### For X/Twitter thread:
Tell Dhruva:
```
Use: /thread "<topic>"
Drew will draft a 5-7 tweet thread and show you a preview in #corrections before anything goes live.
```
Or if Drew can invoke it directly, run the x-thread-draft skill.

### For LinkedIn:
Tell Dhruva:
```
Use: /linkedin <topic or context>
Drew will draft a post and show you a preview in #corrections before posting.
Note: LinkedIn posting requires Browserbase setup (Phase 5 — not yet active).
```

### For XPosterOS pipeline check:
```
Run: xposteros status
```
Drew checks if XPosterOS is running and lists any review-ready drafts.

### For brain dumps (raw ideas to feed into the X pipeline):
```
Run: xposteros create brain dump "<title>" "<content>"
```
XPosterOS workers will pick it up in the next 2-hour cycle and generate a draft.

---

## Step 3 — Context from GBrain

Before routing, optionally search GBrain for relevant context:

```python
if content_hint:
    results = gbrain_search(f"{content_hint} context insights")
    context = results.get("answer", "")
    if context:
        # Mention to Dhruva: "I found some relevant context in your notes: [summary]"
        # This helps Dhruva decide if the topic is worth posting about
        pass
```

---

## Key info

| Platform | Command | Approval | Status |
|---|---|---|---|
| X/Twitter thread | `/thread "<topic>"` | 👍 in #corrections | Active |
| X/Twitter (via pipeline) | `xposteros create brain dump` | 👍 in #corrections | Active |
| LinkedIn | `/linkedin <topic>` | 👍 in #corrections | Phase 5 (planned) |
| Blog | `/blog "<topic>"` | 👍 in #corrections | Active |

**XPosterOS dashboard:** https://content.dhruvavutukury.org
**XPosterOS API:** http://127.0.0.1:8081
**All posting requires Dhruva's explicit 👍 approval before anything goes live.**

---

## Error handling

| Situation | Action |
|---|---|
| XPosterOS API unreachable | Report: "XPosterOS is down. Check: `systemctl --user status xposteros-api`" |
| LinkedIn skill not active | Note Phase 5 status, offer blog or X as alternatives |
| No topic provided | Ask for the topic before doing anything else |
