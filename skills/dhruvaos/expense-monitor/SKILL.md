---
name: expense-monitor
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Command: /expenses import <csv-path> to categorize + save; /expenses for last 3-month comparison. MANUAL CSV UPLOAD ONLY — no bank API connection."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["finance/*"]
  writes: ["finance/expenses-*.md"]
tests: tests/
metadata:
  hermes:
    tags: [Finance, Expenses, CSV, Research, Command]
---

# Expense Monitor

## Purpose
Categorize a manually-uploaded bank/card CSV and persist a monthly expense summary to the brain
plus GBrain, or summarize the last few months of spend on demand. No bank APIs, no stored
credentials — Dhruva exports CSVs himself and provides the local path.

## Context
- **Triggers:**
  - `/expenses import <csv-path>` — import + categorize a single statement.
  - `/expenses` (or `/expenses summary`) — multi-month comparison from existing brain files
    and GBrain.
- **Channels:** posts to `DISCORD_RESEARCH_CHANNEL_ID` (#research).
- **Data sources:** local CSV at the path Dhruva provides; existing
  `~/brain/finance/expenses-*.md`; GBrain finance namespace.
- **Tunables:** comparison window length, category list, top-N-categories displayed, and
  spend thresholds for highlighting/flagging live in `~/brain/config/cost-thresholds.md`.
  The fixed expense category taxonomy also lives there — do not invent new categories inline.
- **Tools:** phi4-mini via local Ollama for batched categorization (Tier 0); GBrain search +
  ingest; `messaging`; local filesystem read/write only.

## Goal
- **Import mode:** every transaction in the CSV is assigned to one configured category, totals
  per category are computed, a markdown summary is written to
  `~/brain/finance/expenses-<YYYY-MM>.md` and ingested into GBrain, and a concise breakdown is
  posted to #research.
- **Summary mode:** a multi-month comparison (window per config) is posted to #research, with a
  graceful "no data — use /expenses import" path if no files exist.

## Constraints
- Absolutely no outbound calls to banks, card issuers, OAuth providers, or third-party finance
  APIs. CSVs come from the local filesystem only.
- Never persist raw account/card numbers or credentials to the brain or GBrain. Brain files hold
  category totals plus transaction descriptions/amounts/dates — nothing else.
- Categories must come from `~/brain/config/cost-thresholds.md`; if Ollama is unreachable, fall
  back to the configured default category and surface that failure in the post.
- Thresholds for "high spend month", flagged categories, and the comparison window length are
  read from config — never hardcoded.
- Transaction tables in the brain file are capped per config; truncation is noted explicitly.
- GBrain writes are sequential; one ingest per import.
- Summary-mode output must degrade gracefully when only 1–2 months of history exist.
- Posts include only aggregate categories, totals, and a transaction count — never full
  per-line dumps.
- All required env vars must be present before any work begins.
- Brain writes use the GBrain single-writer contract — wrap any `gbrain import` / `embed` / `dream` invocation in `flock -n ~/.gbrain/gbrain-write.lock` to prevent concurrent corruption. If the lock is busy, defer to the next stale embed cycle (the file write itself is durable).
