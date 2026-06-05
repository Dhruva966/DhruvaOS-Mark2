---
name: research-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Deep-dive a topic using GBrain + Exa web search, synthesize findings, write to brain/resources/, post summary to Discord #research."
schedule: null
gbrain:
  reads: ["concepts/*", "resources/*"]
  writes: ["resources/research-[topic-slug]-[date].md"]
tests: tests/research-synthesis/
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

Triggered by `/research <topic>` in Discord #research.
Example: `/research transformer attention mechanisms` or `/research UCLA CS transfer requirements 2026`

Brain-first: always check GBrain before going to the web.
Uses Exa for current sources + content extraction (no AgentQL needed — Exa returns full page text natively).

## Step 0 — Extract Topic

Parse everything after `/research` as the topic string.
If empty: post to #research: "Usage: /research <topic to research>"

Normalize the topic to a slug for filename: lowercase, replace spaces with hyphens.
Example: "transformer attention mechanisms" → "transformer-attention-mechanisms"

## Step 1 — Search GBrain First

Use GBrain MCP tools to check existing knowledge:

- `gbrain search "[topic]"` — semantic search
- `gbrain search "[topic] notes resources references"` — find related resources

Review the top results:
- **High confidence (>0.8)** — GBrain has solid coverage. Use as foundation, supplement with 2-3 web sources for freshness.
- **Partial coverage** — use GBrain results as context, do full web search for gaps.
- **No results or low confidence** — full web search needed.

## Step 2 — Exa Search

Use the `web` tool (Exa) to search for current sources.

Run 2 searches:
1. Main topic: `[topic]`
2. Recent angle: `[topic] 2025 2026` (for freshness)

Request up to 10 results per search. Exa returns: title, URL, published date, snippet.

Deduplicate by URL. Keep top 8 unique results by relevance + recency.

## Step 3 — Exa Content Extraction

For the top 5 URLs from Step 2, use the `web` tool to fetch full content.
Exa's `contents` parameter returns the article text (no raw HTML — clean text only).

For each URL, extract:
- Title
- Author (if present)
- Published date
- Key content (full text, trimmed to **1500 chars per article**)

**Context cap:** total content fed into Step 4 must not exceed 8000 chars. If 5 articles × 1500 = 7500 chars + GBrain context + synthesis prompt would overflow, drop the lowest-ranked articles first.

If Exa content fetch fails for a URL, use the snippet from Step 2 as fallback.

## Step 4 — Synthesize with Sonnet (Tier 2 Reasoning)

Using your reasoning, synthesize all gathered data (GBrain context + web content) into a research note.

**Structure:**
```
## [Topic] — Research Note
*Synthesized [today's date] by Drew*

### What's Known (from GBrain)
[Summary of what was already in the brain. If nothing: "No prior coverage in brain."]

### Key Findings (from web)
[3-5 bullet points of the most important new information. Prioritize recent and authoritative sources.]

### Deep Dive
[1-3 paragraphs of synthesized understanding. Connect GBrain knowledge with web findings. Note contradictions or evolving understanding.]

### Open Questions
[What wasn't answered? What needs more research?]

### Sources
- [Title] — [URL] ([date if available])
- ...
```

Keep total synthesis under 1500 words. Prioritize insight over raw summarization.

## Step 5 — Write to Brain

Use the `file` tool to write the synthesis to:
```
~/brain/resources/research-[topic-slug]-[YYYY-MM-DD].md
```

Create directory if needed:
```bash
mkdir -p ~/brain/resources/
```

## Step 6 — Ingest into GBrain (BEFORE Discord post — ingest is durable, Discord is notification)

Signal GBrain to index the new research note immediately after file write:

```bash
gbrain import ~/brain/resources/research-[slug]-[date].md 2>&1
gbrain embed --stale 2>&1
```

If gbrain binary not in PATH: try `/home/dhruva/.bun/bin/gbrain` as fallback.

Future searches for this topic will now find this synthesis.

## Step 7 — Post Discord Summary

Use the `messaging` tool to post a condensed summary to channel ID `1507031106350874764` (#research).
Keep under 1800 characters. Structure:

```
🔬 **Research: [Topic]** — [today's date]

**Key findings:**
- [finding 1]
- [finding 2]
- [finding 3]

**GBrain coverage:** [Good/Partial/None]
**Sources:** [N] web + [M] brain references
**Full note:** ~/brain/resources/research-[slug]-[date].md
```

No approval needed — internal research summary.

## Error Handling

| Failure | Action |
|---------|--------|
| Exa search fails | Use GBrain only. Note "web search unavailable" in synthesis. |
| GBrain has no results | Skip brain section. Full web research. |
| Brain file write fails | Post Discord summary anyway. Log error. |
| GBrain ingest fails | File write is the durable record. Continue. |
| All sources fail | Post to #research: "Research failed — no sources reachable. Try again." |
