---
name: connection-detector
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Background enrichment: extract key concepts from a new brain file, search GBrain for related nodes, append top 3 connections, re-ingest. Silent — no Discord post."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - OPENAI_API_KEY
gbrain:
  reads: ["*"]
  writes: ["*"]
tests: tests/
metadata:
  hermes:
    tags: [GBrain, Connections, Enrichment, Background, Silent, Command]
---

# Connection Detector

## Purpose
Background knowledge-graph enrichment. After any brain file is imported, surface genuine semantic links to existing brain nodes and append a `## Connected concepts` section so future searches can traverse the graph more usefully. Exists to compound brain value over time without adding human noise.

## Context
- Trigger: Auto-invoked by ingest skills (youtube-ingest, podcast-ingest, paper-monitor, etc.) or directly via `/connect <brain-file-path>`.
- Channels: None — this skill is silent.
- Data sources: target brain file under `~/brain/`, GBrain semantic search, phi4-mini via Ollama (concept extraction), GPT-4o-mini (Tier 1 connection synthesis).
- Tunables: Check `~/brain/config/timing.md` for current values (guard window, similarity floor, connection count); use sensible defaults if missing.
- Tools: `hermes_log_read` for the gateway log guard; `gbrain search`, `gbrain import`, `gbrain embed --stale` via flock-guarded shell.

## Goal
Given a valid brain file path, the file ends up with a single `## Connected concepts` section listing the most meaningful links to other brain nodes, and GBrain has re-indexed the updated file. If no useful connections exist or any safety guard fires, the file is left untouched.

## Constraints
- Produces NO Discord messages under any circumstance. Successes silent. Failures logged only.
- Check gateway log before running — if stale-fact-rewrite completed within the last 20 minutes, defer silently (no file modification, no Discord message). stale-fact-rewrite rewrites brain files destructively and a concurrent append would corrupt content.
- Resolve the brain path and verify it stays within `~/brain/` before any read or write. Reject anything outside.
- Never append a second `## Connected concepts` section — if one already exists, exit silently.
- Prefer genuinely semantic connections over shared-keyword noise. Skip rather than fabricate weak links.
- All GBrain writes go through `flock -n ~/.gbrain/gbrain-write.lock`. If the lock is busy, the file append is already durable — log "re-ingest queued" and exit cleanly.
- File appends must preserve original content; never overwrite.

## Notes
- Fallback path if phi4-mini is offline: derive seed concepts from the filename slug.
- Fallback path if Tier 1 synthesis fails: use the top-scored candidates with a generic relationship note, but only if real candidates exist.
- "No related nodes found" is a normal outcome, not an error.
