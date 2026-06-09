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

## Purpose
Read Dhruva's recent unread Gmail, classify each message, surface action items, and auto-archive low-signal mail. Posts a concise digest to #tasks so Dhruva sees what actually needs his attention without opening the inbox. Strictly read-and-classify — never drafts, replies, or sends.

## Context
- Trigger: scheduled cron (or manual invocation)
- Channels: `DISCORD_TASKS_CHANNEL_ID` (#tasks) for the digest — internal channel, no outbound approval needed
- Data sources: Gmail via `~/.hermes/scripts/google_api_helper.py gmail` (returns JSON list of recent unread messages with `id`, `subject`, `from`, `date`, `snippet`); GBrain `people/*` for sender enrichment (optional)
- Tunables: check `~/brain/config/timing.md` for the unread look-back window (e.g., 48h) and digest size caps; use sensible defaults if missing
- Classification categories the agent should reason about: action required (Dhruva must do something), FYI (informational), newsletter/marketing, spam — but the agent decides the call per message from subject, sender, snippet

## Goal
Recent unread mail is fetched, each message classified, action items extracted with a short imperative summary and any stated deadline, and a single digest is posted to #tasks listing top action items plus counts for FYI and auto-archived buckets. All non-action mail (FYI, newsletter, spam) is marked as read in Gmail on a best-effort basis. Action-required messages remain unread. If the fetch fails or there is no unread mail, a single clear status line is posted.

## Constraints
- Never reply to email
- Never draft email
- Never send anything externally
- No outbound approval needed for the internal #tasks digest
- Data minimization: post sender label, subject, action, deadline only — never full bodies or long snippets; redact unnecessary personal details before posting to Discord
- Action-required mail must stay unread; only FYI/newsletter/spam are marked read
- Per-message mark-as-read failures are logged and skipped; do not abort the whole batch
- Respect Discord's per-message size limit by truncating the action list with an overflow pointer rather than chopping mid-message
- GBrain people lookup is enrichment only; its failure must not block the digest
