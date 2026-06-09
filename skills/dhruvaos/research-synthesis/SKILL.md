---
name: research-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Deep-dive a topic using GBrain + Exa web search, synthesize findings, write to brain/resources/, post summary to Discord #research."
daily_token_budget: 25000
schedule: null
gbrain:
  reads: ["concepts/*", "resources/*"]
  writes: ["resources/research-[topic-slug]-[date].md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - EXA_API_KEY
    - ANTHROPIC_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
metadata:
  hermes:
    tags: [Research, Exa, GBrain, Discord, Synthesis, Command]
---

# Research Synthesis

## Purpose
On demand, deep-dive a topic by reconciling what's already in the brain with what's current on the web, then write a durable synthesis back into the brain so the next question on the topic starts from a stronger base. Brain-first by design — GBrain is consulted before any external search.

## Context
- Trigger: `/research <topic>` posted in Discord #research.
- Channels: `DISCORD_RESEARCH_CHANNEL_ID` (#research) for the condensed summary.
- Data sources: GBrain semantic search (existing brain coverage); Exa `web` tool for current sources and full-text content extraction.
- Tunables: Check `~/brain/config/content-goals.md` for topic priors and depth expectations; check `~/brain/config/content-guidelines.md` for synthesis tone and structure; use sensible defaults if missing.
- Tools: GBrain MCP, Exa `web`, `file` write, Discord `messaging`, `gbrain import` + `gbrain embed --stale` via flock.

## Goal
A synthesis note exists at `~/brain/resources/research-<slug>-<date>.md` covering what was already known, current key findings, a deep-dive paragraph, open questions, and sources. GBrain has ingested the new note, and a condensed summary is posted to #research.

## Constraints
- Sanitize topic to filename-safe slug (alphanumeric + hyphens only). Verify output path stays within `~/brain/resources/` before writing — never write outside the resources directory.
- Brain-first: consult GBrain before any web call. If GBrain has solid coverage, use it as the foundation and only supplement with web sources for freshness.
- Internal research note — no outbound approval gate.
- All GBrain writes go through `flock -n ~/.gbrain/gbrain-write.lock`; if busy, the markdown file is the durable record and the next stale-embed cycle indexes it. Note this in the Discord summary.
- Discord summary stays within Discord's per-message limit; the full note lives in the file, not in chat.
- Synthesis prioritizes insight over raw summarization; cite sources inline.

## Notes
- Tier 2 (Sonnet) reasoning powers the synthesis itself.
- Empty `/research` invocations get a usage hint in #research, no file write.
- Total context fed to the synthesis step should be bounded; trim or drop the lowest-ranked sources first when over budget.
