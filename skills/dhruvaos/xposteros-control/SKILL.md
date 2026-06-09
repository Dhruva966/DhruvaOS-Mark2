---
name: xposteros-control
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Control surface for XPosterOS — Dhruva's X/Twitter posting system at content.dhruvavutukury.org. Health checks, run workers, list/approve drafts, create brain dumps, trigger posts. All X posts require explicit 👍 approval in #corrections."
schedule: null
author: dhruvaos
platforms: [linux]
gbrain:
  reads: []
  writes: []
trigger: "xposteros health, xposteros status, xposteros run workers, xposteros list drafts, xposteros approve draft, xposteros create brain dump, xposteros check queue, xposteros post now, post on X, post on Twitter, want to post on socials, check X pipeline, social media posting, xposteros dashboard, content.dhruvavutukury.org"
tools:
  - http_get
  - http_post
  - discord_post
  - bash
tests: tests/
prerequisites:
  env_vars:
    - XPOSTEROS_API_TOKEN
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [XPosterOS, X, Twitter, Outbound, Quality-Firewall, Discord]
---

# xposteros-control

## Purpose
Hermes-side control plane for XPosterOS on Omen: report health and queue state, run the worker pipeline, surface drafts for review, push brain dumps in, and gate every X post behind a Discord approval. Notion remains the canonical store; this skill is a controller, not a writer.

## Context
- Trigger: natural-language phrases like "xposteros health", "list drafts", "approve draft <id>", "create brain dump", "check queue", "post now <id>"
- Channels: previews + approvals + confirmations land in #corrections
- Data sources: XPosterOS HTTP API on `http://127.0.0.1:8081` (Bearer `XPOSTEROS_API_TOKEN`); systemd user service `xposteros-api`
- Tunables: posting window, voice, and queue cadence are managed inside XPosterOS / Notion; review cadence guidance in `~/brain/config/timing.md` and `~/brain/config/content-guidelines.md`
- Tools: `http_get`, `http_post`, `discord_post`, `bash` (for service ops and the worker runner script)

## Goal
Read and pipeline operations execute directly and report results to Discord. Any operation that approves a draft or triggers a live post happens only after Dhruva reacts 👍 in #corrections; everything else is discarded or reported.

## Constraints
- Reactor identity check enforced on approval step.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- Never call `/approvals/draft` or `/queue/post-now` without an explicit 👍 from DISCORD_ALLOWED_USER in #corrections.
- Always show the full draft text in #corrections before requesting approval.
- Report XPosterOS `dry_run` state clearly — in dry-run, Notion writes and X posts are blocked.
- Never enable live mode (`XPOSTER_DRY_RUN=false`) without Dhruva's explicit instruction.
- Do not print or echo the contents of `/home/dhruva/xposteros/.env`.
- Surface XPosterOS API errors verbatim; do not retry silently.

## Notes
- Worker pipeline order: NotionSync → DraftGenerator → Reviewer → RandomScheduler → XPoster → MetricsSnapshot.
- XPosterOS frontend (Next.js on Vercel) is the human review surface; this skill only complements it.
- Service ops: `systemctl --user status|restart xposteros-api`, logs via `journalctl --user -u xposteros-api`.
