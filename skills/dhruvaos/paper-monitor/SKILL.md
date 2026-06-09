---
name: paper-monitor
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Daily: fetch arxiv + HN RSS (capped 40 entries), filter by relevance via phi4-mini, summarize keepers via GPT-4o-mini, save to brain/resources/papers/, post to #research."
schedule: "0 7 * * *"
daily_token_budget: 15000
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - EXA_API_KEY
    - OPENAI_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: []
  writes: ["resources/papers/YYYY-MM-DD-<slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Research, Papers, arxiv, HN, RSS, GBrain, Discord, Cron]
---

# Paper Monitor

## Purpose
Once a day, surface a small set of genuinely relevant new research and tech reading to Dhruva,
filtered locally to keep cost near zero and summarized for fast triage. Adds keepers to GBrain so
the rest of DhruvaOS (weekly synthesis, connection-detector) can build on them.

## Context
- Trigger: 7am Pacific cron, or on demand via `/papers`.
- Channels: `DISCORD_RESEARCH_CHANNEL_ID`.
- Data sources: arxiv RSS (cs.AI, cs.LG, cs.CL, cs.NE), Hacker News top RSS, Exa as a fallback for
  thin abstracts.
- Tunables: relevance interest areas, per-feed entry cap, and digest size live in
  `~/brain/config/content-goals.md`; daily token budget is declared in this skill's frontmatter.
- Tools: HTTP fetch, phi4-mini via Ollama (Tier 0 relevance scoring), GPT-4o-mini (Tier 1
  summarization), Exa contents, `gbrain` import/embed under flock, `messaging`.

## Goal
Each run ends with: relevant new entries from the last 24h summarized into structured brain files
under `~/brain/resources/papers/`, ingested into GBrain, and announced as a single tight digest
in #research. If nothing clears the relevance bar, stay silent.

## Constraints
- Stay within the declared daily token budget — use Tier 0 (phi4-mini) for relevance scoring and
  only escalate the keepers to Tier 1 summarization.
- Per-feed entry cap prevents arxiv from drowning the run; the cap is a tunable, not a fixed
  number baked into the skill.
- A single feed failure must not abort the run — log and continue with the other feeds.
- If zero entries clear the relevance filter, post nothing to Discord. Silent is the correct
  outcome, not an empty digest.
- Brain file writes must stay inside `~/brain/resources/papers/` (path-resolve and verify).
- GBrain ingest goes through `flock -n ~/.gbrain/gbrain-write.lock` to avoid colliding with the
  dream cycle; ingest failure is non-fatal because the file is durable.
- The Discord digest is a single message under Discord's size limit; trim entries before truncating
  mid-sentence.
- This skill chains into `connection-detector` for each new brain file so cross-domain links can be
  surfaced; treat that chain as best-effort and never block on it.

## Notes
- Interest areas, the score threshold for "keeper", and digest length are intentionally not
  hardcoded — they live in config so the bar can move without editing the skill.
- If phi4-mini is unreachable, fall back to a conservative keyword pass or escalate scoring to
  Tier 1; log the fallback rather than aborting.
