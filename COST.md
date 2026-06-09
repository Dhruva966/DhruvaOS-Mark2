# DhruvaOS Mark 2 — Cost Model

## Bottom Line

Running DhruvaOS on the Omen costs **$12–30/month** (Phase 3+, API only).
Infrastructure is $0. Browserbase is permanently dropped. The only real cost is Anthropic API.

| Scenario | Monthly | Annual |
|---|---|---|
| Phase 3+ (Playwright, no Browserbase) | $12–30 | $144–360 |
| After OpenAI credits dry up (Year 2+) | +$3–8/mo | add $36–96/yr |
| Emergency Gemini fallback (free tier) | $0 Hermes / $15–30 Sonnet when you top up | temporary |

**Prompt caching is the single highest-leverage optimization.** Anthropic's prompt caching
still meaningfully reduces repeated system/context cost; keep it enabled before the first Sonnet call.

---

## API Costs

| Provider | Tier | Model | Cost/1M in | Cost/1M out | Monthly est. |
|---|---|---|---|---|---|
| Ollama (local) | 0 | phi4-mini | $0 | $0 | **$0** |
| OpenAI direct | 1 | gpt-4o-mini | $0.15 | $0.60 | **~$0** (burns platform credits) |
| OpenRouter (Year 2 fallback) | 1 | DeepSeek V3 | $0.23 | $0.34 | **$3–8** |
| Anthropic | 2 | claude-sonnet-4-6 | $3.00 | $15.00 | **$12–25** |
| Anthropic | 3 | claude-opus-4-8 | $15.00 | $75.00 | **$3–8** |
| **Gemini (temp fallback)** | 2 | gemini-3.1-flash-lite | **$0.025** | **$0.10** | **~$0** at Hermes cron volume (verify pricing at ai.google.dev) |
| Exa | — | search | $7/1k queries | — | **$0** (free 1k/mo tier) |
| Structured extractor | — | optional future | varies | — | **$0–6** if added |
| **API total (Anthropic on)** | | | | | **$12–30/mo** |
| **API total (Gemini fallback)** | | | | | **~$0/mo Hermes** |

### OpenAI credit burn rate

Credits: ~$1,000 on platform.openai.com (direct OPENAI_API_KEY, not OpenRouter).
At moderate usage (500 req/day, 800 avg tokens): ~$2.88/month → **credits last ~29 months**.

When balance drops below $50: switch `tier_1.active_backend: "fallback"` in config.yaml → DeepSeek V3 via OpenRouter.

Set a monthly calendar reminder to check: https://platform.openai.com/usage
Configure a dashboard alert at $50 (Settings → Billing → Usage limits).

---

## Real Incident: Credit Depletion — June 6 2026

**What happened:** All Hermes cron skills failed from 14:30 PDT June 6 onwards with 400 "credit balance too low" errors. Discord flooded with failure messages.

**Root cause 1 — ContentOS Claude Code build session (primary):**
The ContentOS build (3 PRs, parallel agents, 686 tests) ran Claude Code API calls that go directly to Anthropic. These calls do NOT appear in `~/.hermes/logs/gateway.log`. The watchdog showed "ok" at 9am because it only reads the Hermes log — blind to Claude Code usage. Credits drained between 9am–2:30pm during the build.

**Root cause 2 — meeting-prep-brief cadence:**
Was running every 30 minutes (`*/30 * * * *` = 48 calls/day). Each call invokes Claude Sonnet regardless of whether a meeting is found. At ~$0.003+/call, this alone burned ~$0.14/day — the highest-frequency cron by 10×.
**Fixed to `0 * * * *` (24/day).**

**Root cause 3 — watchdog blind spot:**
`api-cost-watchdog` estimates cost from gateway.log only. Cannot see Claude Code sessions, direct SDK calls, or anything outside Hermes runtime. The alert was calibrated for Hermes-only spend.
**Fixed:** added `~/.hermes/scripts/balance-check.sh` — a standalone script that reads gateway.log for credit errors and fires ntfy without needing any LLM. Runs every 2 hours via system crontab.

**Lesson:** Claude Code sessions building DhruvaOS are the largest cost driver, not Hermes skills. Keep them on a separate API key so you can see them separately in Anthropic billing.

---

## API Key Separation

Two separate Anthropic API keys:
- **Claude Code key** — used when you're actively building (this session). Tracks build-phase spend. Visible in Anthropic billing under the key name.
- **Hermes key** — `~/.hermes/.env` `ANTHROPIC_API_KEY`. Tracks runtime agent spend. Separate so credit depletion in one doesn't affect the other.
- **XPosterOS key** — `~/xposteros/.env` `ANTHROPIC_API_KEY`. Isolated so XPosterOS spend is separately tracked.

When Hermes key is depleted: switch to Gemini free tier (see below). When Claude Code key is depleted: top up before the next build session.

---

## Gemini Fallback

**When to use:** Anthropic Hermes credits depleted. Switch until credits replenished.

> **⚠️ ACTIVE ISSUE (as of 2026-06-08):** Config was set to `gemini-2.0-flash` on June 7.
> Gemini 2.0 shut down 2026-06-01. Hermes will fail all API calls until this is corrected.
> Run the fix below immediately.

**Fix live Omen config (run now if not done):**
```bash
ssh dhruva@100.119.229.11
export PATH="/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
# Verify model ID first — Gemini models change frequently:
# https://ai.google.dev/gemini-api/docs/models
sed -i "s/gemini-2.0-flash/gemini-3.1-flash-lite/g" ~/.hermes/config.yaml
systemctl --user restart hermes-gateway
hermes status | grep provider
```

**Current Gemini fallback model:** `gemini-3.1-flash-lite`
Key: `GOOGLE_API_KEY` in `~/.hermes/.env`.

> **⚠️ Model name rule:** Never set a Gemini model from memory. Gemini 2.0 shut down 2026-06-01.
> Always verify current model ID at https://ai.google.dev/gemini-api/docs/models before configuring.

**Config shape when on Gemini:**
```yaml
# ~/.hermes/config.yaml
model:
  default: gemini-3.1-flash-lite
  provider: google
```

**Quality note:** Gemini 3.1 Flash Lite differs from Sonnet in writing style and reasoning depth. For casual tasks (briefings, research, triage) — acceptable. For outbound writing and high-stakes decisions — top up Anthropic and switch back.

**Switching back to Anthropic:**
```bash
ssh dhruva@100.119.229.11
sed -i "s/gemini-3.1-flash-lite/claude-sonnet-4-6/" ~/.hermes/config.yaml
sed -i "s/provider: google/provider: anthropic/" ~/.hermes/config.yaml
systemctl --user restart hermes-gateway
hermes status | grep provider
```

---

## XPosterOS Auto-Deploy — GitHub Actions (Free)

**What it does:** When you push code to `Dhruva966/linkedIn-XPoster` on GitHub (via Codex or direct push), Omen automatically pulls the latest code and restarts workers. No manual SSH required.

**Cost:** $0. GitHub provides free minutes for self-hosted runners (you provide the compute — it's Omen, already running).

**Architecture:**
1. You push to GitHub from Codex/Mac
2. GitHub Actions triggers workflow (`.github/workflows/deploy.yml` in the repo)
3. Self-hosted runner on Omen picks up the job
4. Runner runs: `cd ~/xposteros && git pull origin main --ff-only && ./deploy/run-workers.sh restart`
5. Workers are live with new code within ~30 seconds of your push

**Runner location on Omen:** `~/actions-runner-xposteros/` (software downloaded June 7 2026; registration pending — see user todo below)

**Status:** Runner software installed. Pending: registration token from GitHub (requires `repo` + `workflow` PAT scope — user must generate from GitHub Settings UI).

---

## Browserbase — Permanently Dropped

**Decision (June 7 2026):** Never paying $20/month for Browserbase.

**Replacement:** Local Playwright on Omen. Open source, runs locally, no external billing.

**Why Playwright is sufficient:**
- Omen is always-on — cloud browser's main benefit (run when machine is off) doesn't apply
- LinkedIn at 1-2x/week posting volume is manageable risk with local browser
- If LinkedIn detects and blocks → evaluate alternatives then, don't pre-pay

**What was removed:** `browserbase` MCP server in `~/.hermes/config.yaml` set to `enabled: false`.

Install Playwright on Omen when needed:
```bash
pip install playwright && playwright install chromium
```

---

## Out-of-Pocket (Non-API) Costs

| Item | Monthly | Phase | Notes |
|---|---|---|---|
| Omen electricity | ~$10–17 | All | 90–150W × 24/7 × $0.16/kWh. Background cost — not tracked. |
| ~~Browserbase Developer~~ | ~~$20~~ | **Dropped** | **Replaced by local Playwright — never buying this** |
| Structured extractor overage | $0–6 | Future | Add only if Exa contents insufficient for structured pages |
| Cloudflare Tunnel | $0 | Future | Free tier — needed for Vercel→Omen API access |
| Discord bot | $0 | All | Free |
| Tailscale | $0 | All | Free for personal use |
| Playwright (local browser) | $0 | Phase 3+ | Open source, runs on Omen |
| ntfy.sh push | $0 | Phase 2+ | Free tier |
| GitHub Actions (self-hosted) | $0 | XPosterOS | Self-hosted runner = unlimited minutes |
| **Non-API total** | **$0** | | |

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

Treat actual cache hit rate as workload-dependent; verify it from Anthropic billing after the first week.

---

## Cost Minimization Levers

| Lever | Saves/mo | How | Risk |
|---|---|---|---|
| **Prompt caching** | **$16–32** | Enable in config.yaml | None |
| Gemini free fallback | $12–25 | Switch provider when credits depleted | Quality difference on complex tasks |
| Separate API keys | $0 (visibility) | Isolate Claude Code vs Hermes vs XPosterOS | None |
| meeting-prep-brief throttle | ~$2 | Now at 1h cadence (was 30min) | None — still catches meetings |
| balance-check.sh | $0 (safety) | Fires ntfy on credit error without LLM | None |
| Skip Firecrawl entirely | $0–10 | Exa contents handles research synthesis | None |
| Stay on Exa free tier | $7+ | 1k searches/month free | None for Phase 1–3 |
| Defer structured extractor | $6 | Add only for dashboards/forms/product pages | None |

**Applied together:** ~$10–20/month total.

---

## Phase-by-Phase Cost Ramp

| Phase | New costs added | Monthly at that phase |
|---|---|---|
| Phase 0 (infrastructure setup) | Nothing new | **$0** |
| Phase 1 (alive — GBrain + Discord) | Anthropic Tier 2/3 (minimal) | **$5–12** |
| Phase 2 (inbox — email/calendar) | Regular Tier 2 use | **$12–25** |
| Phase 3 (menial tasks + research) | Exa searches + native contents | **$12–30** |
| Phase 4 (self-improving loop) | Slightly more Tier 2 synthesis | **$15–35** |
| Phase 5 (network — LinkedIn via Playwright) | No new cost — Playwright is free | **$12–30** |
| Phase 6 (voice — future) | Negligible (local STT/TTS) | **$12–30** |

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
| Meeting prep brief | 2 | 24 | 1k in / 0.5k out | ~$0.015 |
| **Daily total** | | | | **~$0.20/day = ~$6/mo** |

These are with prompt caching applied. Without caching: ~$12/mo for same workload.

---

## Year 1 vs Year 2

| | Year 1 | Year 2 (post-OpenAI credits) |
|---|---|---|
| Anthropic (with caching) | $144–300 | $144–300 |
| OpenAI Tier 1 | ~$0 (credits) | — |
| OpenRouter Tier 1 | — | $36–96 |
| Exa | $0 | $0 |
| Structured extractor (if added) | $0–72 | $0–72 |
| Browserbase | **$0 — dropped** | **$0 — dropped** |
| **Annual total** | **$144–372** | **$180–468** |

---

## Cost Controls Checklist

Before first run:
- [ ] `anthropic.prompt_caching: true` in config.yaml — **do this first, biggest savings**
- [ ] OpenAI dashboard alert set at $50 threshold
- [x] `correction-handler` is Tier 2 in deployed `SKILL.md`
- [x] Browserbase permanently dropped — using local Playwright
- [x] meeting-prep-brief throttled to 1h cadence
- [x] balance-check.sh cron running every 2h on Omen
- [x] Separate API keys: Claude Code / Hermes / XPosterOS

Monthly:
- [ ] Check https://platform.openai.com/usage — verify credit burn rate
- [ ] Check Anthropic dashboard for cache hit rate
- [ ] If a structured extractor is added later, check its dashboard and cap usage
- [ ] Verify meeting-prep-brief schedule is still `0 * * * *` (not accidentally reset)

Emergency (credits depleted):
1. Switch Hermes to Gemini (already configured — just change provider back if needed)
2. Top up at platform.anthropic.com/billing
3. Switch Hermes back to Anthropic Sonnet
4. Restart Hermes: `systemctl --user restart hermes-gateway`
