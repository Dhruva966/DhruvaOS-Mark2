# ADR-010: Three-layer browser stack — Lightpanda + AgentQL + Browserbase

**Date:** 2026-06-04
**Status:** accepted

## Context

DhruvaOS browser use cases span three distinct cost/complexity profiles:
1. Lightweight local scraping and monitoring (Charlie's Cleaners, health checks)
2. Web research extraction during research-synthesis skill runs
3. Auth-required, JavaScript-heavy automation (LinkedIn posting, Gmail web)

The naive approach — send raw page HTML to Sonnet for every browser interaction — costs
10k–50k tokens per page. On a research-synthesis run reading 5 sources that's 150k–250k
tokens of raw HTML to Tier 2. At $3/1M that's $0.45 per research run before any reasoning.

## Decision

Three-layer browser stack, each layer matched to cost and complexity:

| Layer | Tool | Status | Cost | Use cases |
|---|---|---|---|---|
| Local browser | Lightpanda | Beta (30.8k stars, AGPL-3.0) | $0 | Research scraping, monitoring, health checks |
| Structured extraction | AgentQL | Production | ~$0.02/call | Wraps all browser reads — JSON out, not raw HTML |
| Cloud browser | Browserbase | Production, YC W24 | $20/mo Developer | LinkedIn, auth-walled sites, CAPTCHA |

## Rationale

### Lightpanda (local browser)
- Built in Zig from scratch. Not Chromium-derived. No legacy overhead.
- 9x faster than Chrome (5s vs 46s per 100 pages), 16x less RAM (123MB vs 2GB).
- On the Omen (32GB RAM, GTX 1660 Ti already loaded with phi4-mini), Chrome adds ~2GB RAM
  pressure per browser instance. Lightpanda adds ~123MB. Real constraint on a laptop.
- **Natively integrated into Hermes Agent (Nous Research)** — no custom tooling needed.
  Set `browser.backend: lightpanda` in config.yaml, point at CDP port 9222.
- AGPL-3.0 is fine for personal use (no distribution concern).
- Beta caveat: can crash on some sites with unusual JS. Skills using Lightpanda must
  handle retry. Critical skills (Phase 5 outbound) always use Browserbase.

### AgentQL (structured extraction)
- Wraps all browser calls. Agent sends a natural language query; AgentQL returns
  structured JSON. Sonnet never reads raw HTML.
- Token math: 5 pages raw = $0.45 Sonnet cost. 5 AgentQL calls = $0.10 total.
  Break-even at ~3 research runs/week. Typical DhruvaOS usage: 1-2/day.
- Free tier: 50 calls/month. Overage: $0.02/call. At 20 calls/day = ~$12/month max.
  Compare: without AgentQL, 20 raw pages/day to Sonnet = ~$54/month in token cost.
- Python SDK wraps Playwright. Drop-in for existing Playwright calls.

### Browserbase (cloud browser)
- Already planned for Phase 5 (LinkedIn skill). No change.
- Handles CAPTCHA, stealth fingerprinting, session persistence across logins.
- Developer plan ($20/mo): 100 browser hours, 25 concurrent sessions. Sufficient for
  personal use — a LinkedIn post draft + approval cycle takes ~5 minutes.
- YC W24. Production stable. Stagehand SDK provides natural language selectors on top.

## Rejected alternatives

- **Steel.dev**: open source cloud browser, similar to Browserbase. No structured
  extraction layer. Redundant with Browserbase already in stack.
- **Browser-Use**: 97k GitHub stars, has a task-based browser harness and custom LLM
  ($0.20/1M tokens). Good framework but adds a fourth browser abstraction and another
  provider to manage. AgentQL + Lightpanda + Browserbase covers all cases already.
- **Raw Playwright + Chrome**: no token optimization. 10k-50k token pages to Sonnet.
  Chrome adds 2GB RAM pressure to a machine already running phi4-mini.
- **Firecrawl**: web content extraction tool. Mostly replaced by AgentQL for structured
  extraction. Keep API key in .env as fallback for PDF/complex extraction edge cases.

## Implementation

```yaml
# ~/.hermes/config.yaml — browser section
browser:
  backend: lightpanda
  endpoint: "ws://127.0.0.1:9222"
  fallback_backend: browserbase  # for critical tasks if lightpanda crashes

# PM2
pm2 start "lightpanda --host 127.0.0.1 --port 9222" --name lightpanda
```

```python
# In any Hermes skill that reads web content
import agentql
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("ws://127.0.0.1:9222")  # Lightpanda
    page = agentql.wrap(browser.new_page())
    result = page.query_data("""
    {
        article_title
        key_points[]
        author
        published_date
    }
    """)
    # result is structured dict — send this to Sonnet, not the full page
```

## New env vars required

| Variable | When | Source |
|---|---|---|
| `AGENTQL_API_KEY` | Phase 3 | https://agentql.com (free tier) |
| `BROWSERBASE_PROJECT_ID` | Phase 5 | Browserbase dashboard |

## Consequences

- research-synthesis skill (Phase 3): use AgentQL for all source extraction
- Charlie monitoring (Phase 5+): use Lightpanda, zero cloud cost
- LinkedIn skill (Phase 5): use Browserbase, Stagehand SDK
- All browser skills: never pass raw HTML to Tier 2. Always query first.
- Firecrawl stays as a fallback env var but is no longer primary extraction tool.
