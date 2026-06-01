# DhruvaOS Mark 2 — Cost Model

## Summary

DhruvaOS runs at **$0/month infrastructure** on the Omen (local hosting). The primary cost
is API usage — Anthropic for Tier 2/3, OpenAI platform credits for Tier 1, nothing for Tier 0.

Year 1 estimate: **$30-65/month** (mostly Anthropic Sonnet for briefings + research).
Year 2 estimate: **$35-70/month** (same, plus OpenRouter replaces burned OpenAI credits).

---

## Year 1: With OpenAI Platform Credits (~$1,000)

| Provider | Tier | Model | Usage estimate | Cost/month | Notes |
|----------|------|-------|---------------|-----------|-------|
| Ollama (local) | 0 | phi4-mini | Unlimited | **$0** | RTX 2060, free forever |
| OpenAI direct | 1 | gpt-4o-mini | ~500 req/day × 800 tok avg | **$1-3** | Burns platform.openai.com credits |
| Anthropic | 2 | claude-sonnet-4-6 | ~200 req/day × 1,500 tok avg | **$25-50** | Briefings, research, reasoning |
| Anthropic | 3 | claude-opus-4-8 | ~20 req/day × 2,000 tok avg | **$6-15** | Orchestration, corrections |
| GBrain | — | PGLite | Unlimited | **$0** | Embedded, self-hosted |
| Infrastructure | — | Omen local | — | **$0** | No cloud hosting |
| **Year 1 total** | | | | **$32-68/mo** | |

**Year 1 annual: ~$385-820**

---

## OpenAI Credit Burn Rate

Credits: ~$1,000 on platform.openai.com
Model: gpt-4o-mini-2024-07-18 at $0.15/$0.60 per 1M in/out tokens

| Usage scenario | Req/day | Avg tokens | Cost/day | Cost/month | Credits last |
|---------------|---------|-----------|---------|-----------|-------------|
| Conservative | 200 | 600 in / 400 out | ~$0.048 | ~$1.44 | **58 months** |
| Moderate (expected) | 500 | 800 in / 600 out | ~$0.096 | ~$2.88 | **29 months** |
| Heavy (initial burst) | 2,000 | 1,000 in / 800 out | ~$0.48 | ~$14.40 | **6 months** |

**Expected scenario:** moderate usage after initial setup = ~2-3 years of Tier 1 coverage.

**Action items:**
1. Check OpenAI dashboard monthly: https://platform.openai.com/usage
2. Set Hermes credit watchdog: notify #alerts when balance < $100, switch providers when < $50
3. When switching: set `tier_1.active_backend: "fallback"` in `~/.hermes/config.yaml`

---

## Year 2: Post-OpenAI Credits (OpenRouter Fallback)

| Provider | Tier | Model | Cost/month | Delta vs Year 1 |
|----------|------|-------|-----------|----------------|
| Ollama | 0 | phi4-mini | $0 | same |
| OpenRouter | 1 fallback | deepseek/deepseek-v3 | ~$3-8 | +$1-5 |
| Anthropic | 2 | claude-sonnet-4-6 | $25-50 | same |
| Anthropic | 3 | claude-opus-4-8 | $6-15 | same |
| **Year 2 total** | | | **$34-73/mo** | **+$2-5/mo** |

**Year 2 annual: ~$410-875**

DeepSeek V3 via OpenRouter: $0.228/$0.343 per 1M in/out (slightly more than GPT-4o-mini).
Net impact: minimal. The real cost is Anthropic for Tier 2/3.

---

## Prompt Caching Impact (Tier 2/3 Anthropic savings)

Anthropic's prompt caching discounts input tokens 90% on cache hits.
Cache TTL: 5 minutes. Cache threshold: >1024 tokens in system prompt.

Hermes injects GBrain context + system prompts on every call. These are >1024 tokens
and largely stable across a session → high cache hit rate expected.

| Without caching | With caching (est. 60% hit rate) | Savings |
|----------------|----------------------------------|---------|
| $25-50/mo Sonnet | $12-25/mo | 40-50% |
| $6-15/mo Opus | $3-8/mo | 40-50% |
| **Total Anthropic** | **~$15-33/mo** | **~$18-30/mo saved** |

**Enable prompt caching in Hermes config — it's the single highest-leverage cost optimization.**
Configure in `~/.hermes/config.yaml`:
```yaml
anthropic:
  prompt_caching: true
  cache_system_prompt: true
```

---

## Quality Firewall Cost Premium

The quality firewall routes all outbound text through Tier 2 (Sonnet) instead of cheaper
alternatives. This is intentional.

| Approach | Cost per 1K-token outbound message | Risk |
|----------|----------------------------------|------|
| Tier 1 (no firewall) | ~$0.00015 | Bad emails, reputation damage |
| Tier 2 (firewall) | ~$0.0045 | Near zero |
| **Premium** | **30x per message** | |

At <10 outbound messages/day × 1K tokens avg:
- Tier 2: ~$0.045/day = ~$1.35/month
- Tier 1 would be: ~$0.0015/day = ~$0.045/month
- **Actual cost difference: ~$1.30/month**

One bad LinkedIn post or email to a recruiter costs more than 1,000 months of this premium.
The quality firewall is free money.

---

## GBrain Costs

| Component | Cost | Notes |
|-----------|------|-------|
| PGLite engine | **$0** | Embedded WASM Postgres, self-hosted |
| ZeroEntropy embeddings | **$0** | Default embedding provider |
| GBrain software | **$0** | Open source, installed locally |
| Postgres + pgvector migration (future) | ~$25/mo | Only if/when brain exceeds ~1000 files and needs Supabase |

PGLite is free indefinitely for a solo personal brain. No migration needed until brain
scales beyond what PGLite can handle (likely 12-24 months minimum).

---

## Infrastructure Costs

| Service | Current (Omen local) | VPS migration (if/when) |
|---------|---------------------|------------------------|
| Compute (Hermes + GBrain) | $0 | ~$24-48/mo (DigitalOcean basic) |
| GPU (phi4-mini Tier 0) | $0 (RTX 2060) | $100-300/mo cloud GPU (not recommended) |
| Database | $0 (PGLite) | $0-25/mo (Supabase free/pro) |
| Networking | $0 (Cloudflare Tunnel free) | $0 (Cloudflare Tunnel free) |
| **Total infrastructure** | **$0** | **~$24-72/mo** |

**VPS recommendation:** keep Omen local until reliability becomes a real problem.
If migrating: move Hermes + GBrain to VPS, keep Ollama local (or drop Tier 0 entirely).

---

## Annual Summary

| Year | Infrastructure | Anthropic | OpenAI / OR | Total/year |
|------|--------------|-----------|------------|-----------|
| Year 1 | $0 | $372-780 | ~$0 (credits) | **$372-780** |
| Year 2 | $0 | $372-780 | ~$36-96 | **$408-876** |
| VPS year (if migrated) | $288-864 | $372-780 | $36-96 | **$696-1,740** |

**Bottom line:** DhruvaOS costs ~$400-800/year to run on the Omen. The main variable
is how aggressively Tier 2/3 gets used. Prompt caching halves that cost.

---

## Cost Controls

| Control | Implementation | Expected savings |
|---------|--------------|-----------------|
| Prompt caching | `anthropic.prompt_caching: true` in config.yaml | 40-50% on Anthropic |
| Tier 0 for all internal work | phi4-mini handles triage/formatting | ~$5-10/mo saved |
| Quality firewall | Outbound via Tier 2 (not Tier 3) unless needed | Tier 3 used sparingly |
| Credit watchdog | Alert at $100, switch at $50 | Prevents surprise depletion |
| GBrain search mode | "balanced" not "tokenmax" | Avoids LLM expansion cost |
