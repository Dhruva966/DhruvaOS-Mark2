---
name: stale-fact-rewrite
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Nightly: detect stale GBrain facts using phi4-mini, expire old versions, insert updated facts. Automated at 3:30am via Hermes cron --no-agent. Can also be invoked manually by Drew."
schedule: "30 3 * * *"
author: dhruvaos
platforms: [linux]
gbrain:
  reads: ["*"]
  writes: ["*"]
tests: tests/
metadata:
  hermes:
    tags: [gbrain, dream, maintenance, facts, nightly]
---

# Stale-Fact-Rewrite

## Purpose
Nightly internal maintenance pass that detects active GBrain facts which have become outdated
or contradicted by recent context, and rewrites them. Keeps the brain's "current truth" surface
clean without human review.

## Context
- Trigger: cron at 03:30 daily (`--no-agent --script stale-fact-rewrite.py`), or manual invocation by Drew
- Channels: `#logs` (rewrite summary), `#alerts` (errors only); silent on a clean run
- Data sources: GBrain active facts, `~/.gbrain/stale-fact-rewrites.jsonl` for audit trail
- Tunables: runtime cap, per-fact timeout, and batch size in `~/brain/config/timing.md`
- Tools: `~/.hermes/scripts/stale-fact-rewrite.py` (supports `--dry-run`), Ollama (phi4-mini), `gbrain forget_fact` + `gbrain extract_facts`, messaging

## Goal
Stale facts identified and superseded with current versions in GBrain; the audit log reflects
the rewrites; Discord stays quiet unless something material happened (rewrites occurred) or an
error needs Dhruva's attention.

## Constraints
- Never set `is_dream_generated=true` on `extract_facts` — that flag skips extraction, defeating the rewrite.
- All updates flow through `gbrain forget_fact` + `gbrain extract_facts`. Never write directly to `~/.gbrain/brain.pglite/`.
- Always acquire `flock` on `~/.gbrain/gbrain-write.lock` before any write — single-writer rule.
- If the lock is busy, exit cleanly and wait for the next nightly run. Do not retry.
- Silent exit when 0 rewrites and 0 errors. No noise on healthy nights.
- API keys come from `~/.hermes/.env`. Do not inline credentials.
- This skill is internal: no outbound messages, no approval gate.

## Notes
- Capture both stdout and stderr from the script for the audit log.
- When posting to `#logs`, summarize old→new per fact; cap the visible list to keep the message readable.
- Errors go to `#alerts` with a pointer to `~/.gbrain/stale-fact-rewrites.jsonl`.
