---
title: "DhruvaOS Skills Inventory"
date: "2026-06-08"
tags: ["dhruvaos", "skills", "hermes", "commands"]
source: "dhruvaos-bootstrap"
---

# DhruvaOS Skills Inventory

All skills deployed to `~/.hermes/skills/dhruvaos/`. Last updated 2026-06-08.

---

## Social Media & Content

### xposteros-control
**Commands:** `xposteros status`, `xposteros list drafts`, `xposteros run workers`, `xposteros create brain dump "<title>" "<content>"`, `xposteros check queue`, `xposteros post now <id>`
**What it does:** Full control surface for XPosterOS — the X/Twitter posting pipeline. Health checks, draft review, worker pipeline, brain dump creation, queue management. Dashboard: content.dhruvavutukury.org
**Tier:** 2 (Claude Sonnet 4.6)
**Outbound:** Yes (posts require approval in #corrections)
**Service:** xposteros-api (API at http://127.0.0.1:8081)
**Use when:** "post on X", "check my X drafts", "run the posting pipeline", "create a brain dump for X"

### x-thread-draft
**Command:** `/thread "<topic>"` in Discord
**What it does:** Drafts a 5-7 tweet thread with Sonnet, previews in #corrections, submits to XPosterOS queue after explicit approval
**Tier:** 2
**Outbound:** Yes (requires approval)
**Use when:** Dhruva wants to draft or post an X/Twitter thread

### content-calendar
**Schedule:** Monday 8:50am cron
**Command:** `/calendar` on-demand
**What it does:** Counts posts by platform vs weekly goals (LinkedIn: 2/wk, X: 3/wk, Blog: 1/mo), posts summary to #tasks, alerts if targets missed

### content-idea-engine
**Schedule:** Monday 9am cron
**What it does:** Generates 3-5 content ideas for LinkedIn/Blog/X from GBrain context, posts to #tasks. Does NOT post anything — ideas only.

### blog-draft
**Command:** `/blog "<topic>"` in Discord
**What it does:** Drafts a blog post, previews in #corrections, requires approval before publishing

### linkedin-post
**Command:** `/linkedin <context or topic>` in Discord
**What it does:** Drafts LinkedIn post using GBrain context, previews in #corrections, posts via Browserbase after approval
**Status:** Phase 5 (planned — requires Browserbase setup first)

---

## Daily Briefings

### morning-briefing
**Schedule:** 8am PST daily (cron)
**What it does:** Calendar + email digest + tasks + research → 4 messages to #briefings

### evening-briefing
**Schedule:** 9pm PST daily (cron)
**What it does:** End-of-day summary — tasks completed/remaining, agenda tomorrow → #briefings

---

## Tasks & Calendar

### add-task
**Command:** `/task <description>` in any Discord channel
**What it does:** Creates task in Notion Tasks DB + writes to brain + GBrain ingest

### task-prioritization
**Schedule:** Monday 8am cron
**What it does:** Fetches Notion tasks, scores by urgency/impact, posts ranked list to #tasks

### calendar-read
**Command:** `/calendar` or triggered by morning-briefing
**What it does:** Fetches 7-day Google Calendar agenda

---

## Research & Learning

### research-synthesis
**Command:** `/research "<topic>"` in Discord
**What it does:** Exa search + GBrain synthesis, posts summary to #research

### paper-monitor
**Schedule:** Daily cron
**What it does:** Monitors arXiv for papers matching Dhruva's interests, posts finds to #research

### podcast-ingest / youtube-ingest
**What they do:** Transcribe episodes/videos, extract insights, store in GBrain

### weekly-learning-synthesis
**Schedule:** Sunday 8pm cron
**What it does:** Synthesizes week's learnings from GBrain into weekly digest

---

## Communications & Outbound

### email-triage
**When:** Via morning-briefing or standalone
**What it does:** Fetches unread Gmail, classifies by urgency, summarizes

### github-update
**Command:** `/github <action>` in Discord
**What it does:** GitHub MCP reads (auto) and writes (require approval in #corrections)

### correction-handler
**Command:** `/correct <text>` in #corrections
**What it does:** Classifies correction, appends to brain, GBrain ingest, acknowledgment

---

## System & Health

### error-detection
**What it does:** Monitors Hermes logs for skill failures, alerts to #alerts

### api-cost-watchdog
**What it does:** Monitors API spending vs budget, alerts if approaching limits

### tier-watchdog
**What it does:** Monitors model tier usage, flags misrouted tasks

### connection-detector
**What it does:** Detects network changes, updates available tools

### expense-monitor / subscription-audit
**What they do:** Track spending and active subscriptions

---

## Personal & Wellness

### birthday-reminder
**What it does:** Alerts 3 days before contacts' birthdays from brain/people/

### contact-health-check
**What it does:** Flags contacts not interacted with in 30+ days

### daily-checkin
**Command:** `/checkin` in Discord
**What it does:** Quick daily mood/energy check, stores in brain

### wellness-trend
**Schedule:** Sunday 8pm cron
**What it does:** Weekly wellness trend from health data

### meeting-prep-brief
**When:** Before calendar events
**What it does:** GBrain context about meeting attendees/topic

### personal-site-update
**Command:** After blog-draft approval
**What it does:** Publishes approved blog post to personal site

### health-ingest
**What it does:** Ingests Apple Health or manual health data

---

## Self-Improvement

### stale-fact-rewrite
**Schedule:** Weekly cron
**What it does:** Finds outdated brain facts, rewrites with current info

### skill-proposal
**Command:** `/propose-skill "<description>"` in Discord
**What it does:** Drafts new SKILL.md from Dhruva's description, previews for approval

### post-interaction-log
**What it does:** Logs all Discord interactions to brain for learning

### skill-analytics
**What it does:** Tracks skill run frequency and success rates
