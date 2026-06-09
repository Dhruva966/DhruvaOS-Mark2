---
title: "Config — Tunables for Drew"
type: config
updated: 2026-06-09
---

# brain/config/

Drew reads these files first when making decisions. Edit them to change behavior without touching skill code.

## Philosophy

Skills define **goal + context + constraints**. The agent decides HOW. These config files hold the **what** — thresholds, windows, targets — that should change as Dhruva's life changes, not as code is rewritten.

If a skill needs a number, it checks here first. If the file is missing or the value is unclear, the agent uses sensible defaults and notes it. Never hardcoded in the skill body.

## Files

| File | What it tunes |
|------|---------------|
| `cost-thresholds.md` | API spend alert triggers (daily / monthly) |
| `timing.md` | Look-ahead and look-back windows (calendar, email, monitoring) |
| `content-goals.md` | Posting frequency targets (LinkedIn, X, blog) |
| `relationship-windows.md` | Contact frequency thresholds by tier |
| `content-guidelines.md` | Voice, tone, format rules for outbound writing |

## Rules for editing

- Plain markdown with key-value lines or short prose — agent parses both
- One concept per line; no nested YAML unless the file says so
- When in doubt, write the rule in English — the agent reads it
- Add new config files freely; reference them from the relevant skill's `## Context` section

## Rules for skills

- A skill must NEVER hardcode a number that belongs in config
- A skill MUST tolerate config being missing — fall back to a default, mention the fallback in output
- A skill SHOULD reference the specific config file in its `## Context` section, e.g. "Check `~/brain/config/cost-thresholds.md` for current limits"
