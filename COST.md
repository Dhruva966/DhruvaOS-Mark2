# DhruvaOS Mark 2 — Cost Model

## Bottom Line

Running DhruvaOS on the Omen costs **$15–39/month** (Phase 3+, API only).
Infrastructure is $0. The only real cost is Anthropic API.

| Scenario | Monthly | Annual |
|---|---|---|
| Phase 3+ (no Browserbase) | $15–39 | $180–468 |
| Phase 5+ (with Browserbase, if needed) | $35–59 | $420–708 |
| After OpenAI credits dry up (Year 2+) | +$3–8/mo | add $36–96/yr |

**Prompt caching is the single highest-leverage optimization.** One config flag cuts
Anthropic spend ~40–50%. Enable before the first Sonnet call.

---

## API Costs

| Provider | Tier | Model | Cost/1M in | Cost/1M out | Monthly est. |
|---|---|---|---|---|---|
| Ollama (local) | 0 | phi4-mini | $0 | $0 | **$0** |
| OpenAI direct | 1 | gpt-4o-mini | $0.15 | $0.60 | **~$0** (burns platform credits) |
| OpenRouter (Year 2 fallback) | 1 | DeepSeek V3 | $0.23 | $0.34 | **$3–8** |
| Anthropic | 2 | claude-sonnet-4-6 | $3.00 ($0.30 cached) | $15.00 | **$12–25** |
| Anthropic | 3 | claude-opus-4-8 | $15.00 ($1.50 cached) | $75.00 | **$3–8** |
| Exa | — | search | $7/1k queries | — | **$0** (free 1k/mo tier) |
| AgentQL | — | structured extract | $0.02/call | — | **$0–6** (free 50/mo) |
| **API total** | | | | | **$15–39/mo** |

### OpenAI credit burn rate

Credits: ~$1,000 on platform.openai.com (direct OPENAI_API_KEY, not OpenRouter).
At moderate usage (500 req/day, 800 avg tokens): ~$2.88/month → **credits last ~29 months**.

When balance drops below $50: switch `tier_1.active_backend: "fallback"` in config.yaml → DeepSeek V3 via OpenRouter.

Set a monthly calendar reminder to check: https://platform.openai.com/usage
Configure a dashboard alert at $50 (Settings → Billing → Usage limits).

---

## Out-of-Pocket (Non-API) Costs

| Item | Monthly | Phase | Notes |
|---|---|---|---|
| Omen electricity | ~$10–17 | All | 90–150W × 24/7 × $0.16/kWh. Background cost — not tracked. |
| Browserbase Developer | $20 | Phase 5 only | **DEFER — see note below** |
| AgentQL overage | $0–6 | Phase 3+ | Free 50 calls/month; only pay if research runs go heavy |
| Cloudflare Tunnel | $0 | All | Free tier |
| Discord bot | $0 | All | Free |
| Tailscale | $0 | Phase 6 | Free for personal use |
| Lightpanda | $0 | Phase 3+ | Open source, local |
| ntfy.sh push | $0 | Phase 2+ | Self-hosted |
| **Non-API total** | **$0** | | Without Browserbase |

### On Browserbase ($20/mo) — defer it

Browserbase provides cloud browser sessions for LinkedIn and auth-heavy sites.
**Do not buy until Phase 5, and only if local Playwright fails.**

Why it's skippable initially:
- Omen is always-on — cloud browser's "run when machine is off" benefit doesn't apply
- Local Playwright + Lightpanda handles most sites including LinkedIn at low frequency
- LinkedIn bot detection is a real but manageable risk at personal (1-2x/week) posting volume
- If local Playwright gets blocked → add Browserbase then. Don't pre-pay for a problem you may not have.

---

## Prompt Caching — Highest-Leverage Optimization

Anthropic caches input tokens at 90% discount when the same prefix reuses within 5 minutes.
Hermes injects GBrain context + system prompts on every call — stable, >1024 tokens → high cache hit rate expected.

| Without caching | With caching (~60% hit rate) | Monthly savings |
|---|---|---|
| $25–50/mo Sonnet | $12–25/mo | $13–25/mo |
| $6–15/mo Opus | $3–8/mo | $3–7/mo |
| **$31–65/mo total** | **$15–33/mo total** | **$16–32/mo saved** |

Enable in `~/.hermes/config.yaml` before first Sonnet call:
```yaml
anthropic:
  prompt_caching: true
  cache_system_prompt: true
```

**Without this, the numbers above double. Always enable caching.**

---

## Cost Minimization Levers

| Lever | Saves/mo | How | Risk |
|---|---|---|---|
| **Prompt caching** | **$16–32** | Enable in config.yaml | None |
| Defer Browserbase | $20 | Don't buy until Phase 5 local Playwright fails | Minor |
| Correction-handler → Tier 2 | $2–5 | Change `tier: 3` → `tier: 2` in YAML | Marginal quality reduction |
| Skip Firecrawl entirely | $0–10 | AgentQL replaces it — never buy a key | None |
| Stay on Exa free tier | $7+ | 1k searches/month free — don't upgrade until proven insufficient | None for Phase 1–3 |
| Stay on AgentQL free tier | $6 | 50 calls/month free — measure actual Phase 3 usage first | None initially |

**Applied together (all levers, no Browserbase):** ~$12–22/month total.

---

## Phase-by-Phase Cost Ramp

| Phase | New costs added | Monthly at that phase |
|---|---|---|
| Phase 0 (infrastructure setup) | Nothing new | **$0** |
| Phase 1 (alive — GBrain + Discord) | Anthropic Tier 2/3 (minimal) | **$5–12** |
| Phase 2 (inbox — email/calendar) | Regular Tier 2 use | **$12–25** |
| Phase 3 (menial tasks + research) | AgentQL (likely free tier) | **$12–30** |
| Phase 4 (self-improving loop) | Slightly more Tier 2 synthesis | **$15–35** |
| Phase 5 (network — LinkedIn) | Browserbase $20/mo if needed | **$35–55** |
| Phase 6 (voice — future) | Negligible (local STT/TTS) | **$35–55** |

---

## Anthropic Call Volume Estimate (steady state)

| Skill | Tier | Calls/day | Avg tokens | Daily cost (cached) |
|---|---|---|---|---|
| Morning briefing | 2 | 1 | 3k in / 1k out | ~$0.012 |
| Evening briefing | 2 | 1 | 2.5k in / 0.8k out | ~$0.010 |
| Email triage | 2 | 5 | 1.5k in / 0.5k out | ~$0.030 |
| Research synthesis | 2 | 2 | 2k in / 1.5k out | ~$0.029 |
| Task prioritization | 1 | 10 | 800 in / 400 out | ~$0.002 |
| Correction handler | 2 | 2 | 1.5k in / 0.5k out | ~$0.012 |
| Ad-hoc commands | 2 | 5 | 1k in / 0.5k out | ~$0.019 |
| Dream cycle (nightly) | 2 | 1 | 5k in / 2k out | ~$0.023 |
| Orchestration | 3 | ~5 | 2k in / 0.5k out | ~$0.050 |
| **Daily total** | | | | **~$0.19/day = ~$6/mo** |

These are with prompt caching applied. Without caching: ~$12/mo for same workload.

---

## Year 1 vs Year 2

| | Year 1 | Year 2 (post-OpenAI credits) |
|---|---|---|
| Anthropic (with caching) | $180–396 | $180–396 |
| OpenAI Tier 1 | ~$0 (credits) | — |
| OpenRouter Tier 1 | — | $36–96 |
| Exa | $0 | $0 |
| AgentQL | $0–72 | $0–72 |
| Browserbase (if added) | $0–160 | $0–240 |
| **Annual total (no Browserbase)** | **$180–468** | **$216–564** |
| **Annual total (with Browserbase)** | **$340–628** | **$456–804** |

---

## Cost Controls Checklist

Before first run:
- [ ] `anthropic.prompt_caching: true` in config.yaml — **do this first, biggest savings**
- [ ] OpenAI dashboard alert set at $50 threshold
- [ ] `correction-handler.yaml`: change `tier: 3` → `tier: 2`
- [ ] No Firecrawl key — AgentQL handles extraction
- [ ] Browserbase: do not buy until Phase 5 and only if local Playwright fails on LinkedIn

Monthly:
- [ ] Check https://platform.openai.com/usage — verify credit burn rate
- [ ] Check Anthropic dashboard for cache hit rate
- [ ] Check AgentQL dashboard — ensure staying within free 50 calls/month
