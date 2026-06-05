---
name: linkedin-post
version: 0.1.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a LinkedIn post, preview in #corrections, post only after explicit Dhruva approval. Phase 5 skill."
schedule: null
gbrain:
  reads: ["people/*", "projects/*", "goals/*"]
  writes: []
tests: tests/linkedin-post/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - BROWSERBASE_API_KEY
metadata:
  hermes:
    tags: [LinkedIn, Outbound, Phase5, Quality-Firewall]
---

# LinkedIn Post (Phase 5)

**STATUS: Phase 5 skill — not active until quality firewall test (P3.3) passes.**

Triggered by: `/linkedin <context or topic>` in Discord.
Example: `/linkedin Write about what I learned from building DhruvaOS this summer`

This skill NEVER posts without explicit 👍 approval in #corrections.
Quality firewall: Tier 2 minimum, approval required, every single run.

## Step 1 — Load Context from GBrain

Search GBrain for relevant context:
- `gbrain search "[topic from command]"`
- `gbrain search "recent projects accomplishments"`
- `gbrain think "What has Dhruva been working on lately that's worth sharing?"`

## Step 2 — Draft with Sonnet (Tier 2)

Using your reasoning (Sonnet quality), write a LinkedIn post:

**Rules for the draft:**
- 150-300 words (LinkedIn sweet spot)
- First-person voice, authentic — not corporate
- Lead with insight or story, not announcement
- No hashtag spam (max 3 relevant hashtags)
- No emoji overdose (0-2 max, only if natural)
- End with a question or insight, not a call-to-action
- Tone: thoughtful builder, not self-promoter

## Step 3 — Post Preview for Approval

Use the `messaging` tool to post to Discord #corrections (channel `1507031153209638953`):

```
📤 [APPROVAL REQUIRED] linkedin-post
Platform: LinkedIn (Dhruva's personal account)
Model: claude-sonnet-4-6 (Tier 2)
Topic: [topic from command]
---
[FULL DRAFT TEXT — exactly as it will appear on LinkedIn]
---
React 👍 to post · Reply /deny to discard
```

**HARD STOP:** Do not proceed until 👍 approval received. Wait up to 10 minutes (clarify_timeout).
If no response in 10 minutes: discard draft and notify Dhruva: "LinkedIn post draft expired — re-run /linkedin to try again."

## Step 4 — Post to LinkedIn (only after approval)

Use browser automation (Browserbase) to post to LinkedIn:

```python
# Pseudocode — implement with Browserbase SDK when Phase 5 is active
# 1. Open LinkedIn in cloud browser
# 2. Navigate to post composer
# 3. Type/paste the approved draft
# 4. Submit post
```

**PREREQUISITES for Phase 5:**
1. Browserbase account + API key (`BROWSERBASE_API_KEY` in .env)
2. LinkedIn session authenticated via Browserbase
3. Quality firewall test (P3.3) passed end-to-end

## Step 5 — Confirm

Post success confirmation to Discord #corrections:
```
✅ LinkedIn post published: [first 50 chars of post...]
```

## Error Handling

| Failure | Action |
|---------|--------|
| GBrain returns nothing | Draft from command context only, note in preview |
| Draft not approved in 10min | Discard, notify user |
| LinkedIn post fails | Retry once; if fails again, notify in #corrections with screenshot |
| Browser automation fails | Post error with instructions to post manually |

## Important

This skill requires BROWSERBASE_API_KEY. Until Phase 5 is active, this skill is a STUB.
Running it will show the draft preview but CANNOT actually post without Browserbase configured.
