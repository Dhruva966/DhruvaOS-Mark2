# DhruvaOS Mark 2 — Model Routing

## Tier Definitions

| Tier | Model | Provider | Input $/1M | Output $/1M | Use Cases |
|------|-------|----------|-----------|------------|-----------|
| 0 | phi4-mini | Ollama (local) | $0 | $0 | Triage, formatting, parsing, classification — **internal only** |
| 1 | gpt-4o-mini-2024-07-18 | OpenAI direct (platform credits) | $0.15 | $0.60 | Research, task planning, data analysis, mid-complexity |
| 1 fallback | deepseek/deepseek-v3 | OpenRouter (own billing) | $0.23 | $0.34 | Same as Tier 1 after OpenAI credits < $50 |
| 2a | claude-haiku-4-5 | Anthropic | $0.80 | $4 | Fast cheap tasks: summaries, formatting, quick lookups, structured extraction |
| 2b | claude-sonnet-4-6 | Anthropic | $3 | $15 | **ALL outbound writing**, reasoning, code review, complex analysis. Also **scout** for Tier 4. |
| 2c | gpt-4o | OpenAI direct | $2.50 | $10 | Multimodal (image/chart analysis), long context, OpenAI-specific capabilities |
| 3 | claude-opus-4-8 | Anthropic | $15 | $75 | Orchestration, architecture decisions, high-stakes planning |
| 4 | claude-fable-5 | Anthropic | $10 | $50 | System improvement, idea generation, highest-stakes decisions. Scout-first always. |
| Gemini fallback | gemini-3.1-flash-lite | Google (GOOGLE_API_KEY) | $0.25 | $1.50 | **TEMPORARY default when Anthropic credits depleted.** Use `provider: google`. Verify current model ID at ai.google.dev — Gemini models deprecate frequently. Gemini 2.0 shut down June 1, 2026. |

---

## Discord Model Override — Full Palette

Prefix any Discord message with `@alias` to route to that model explicitly.
Works from any channel. Overrides all automatic tier routing.

| Alias | Model ID | Provider | Best for |
|-------|----------|----------|----------|
| `@fable` | claude-fable-5 | Anthropic | System improvement ideas, high-stakes decisions (scout runs first) |
| `@opus` | claude-opus-4-8 | Anthropic | Architecture, orchestration, complex multi-step planning |
| `@sonnet` | claude-sonnet-4-6 | Anthropic | Default workhorse — writing, reasoning, code review |
| `@haiku` | claude-haiku-4-5 | Anthropic | Fast cheap tasks — summaries, formatting, extraction |
| `@gpt4o` | gpt-4o | OpenAI | Image/chart analysis, long context, OpenAI-specific tasks |
| `@mini` | gpt-4o-mini-2024-07-18 | OpenAI | Research, analysis, task planning |
| `@gemini` | gemini-3.1-flash-lite | Google | Quick cheap fallback (verify model ID at ai.google.dev first) |
| `@deepseek` | deepseek/deepseek-v3 | OpenRouter | Cheap research + analysis when OpenAI credits low |
| `@local` | phi4-mini | Ollama | Local only, zero cost, triage + classification |

No prefix = Hermes auto-routes by task complexity as normal.

> **Fable 5 pricing note:** $10/$50 per 1M in/out — 2x Opus 4.8 ($5/$25). Prompt caching gives 90% input discount on cached tokens (same as other Anthropic tiers). Available on standard Anthropic API since June 9, 2026.

> **🚨 MODEL NAME RULE — enforced, no exceptions:**
> Before writing ANY model ID into config, .env, code, or docs — look it up live.
> - Gemini: https://ai.google.dev/gemini-api/docs/models (or `hermes model list --provider google`)
> - Claude: https://docs.anthropic.com/en/docs/about-claude/models
> - GPT: https://platform.openai.com/docs/models
>
> **Never use `gemini-2.0-*` — all variants shut down June 1, 2026. Broke production crons.**
> Current verified Gemini fallback (June 2026): `gemini-3.1-flash-lite`
> If you cannot verify the model ID in this session, do not write it. Look it up first.

---

## Tier 4 Rules — Claude Fable 5 (Minimal Use)

**Fable 5 is Dhruva's strategic thinking partner for making DhruvaOS better.**
Primary use: idea generation and system improvement — "how do we make this smarter?"
Secondary use: reasoning through high-stakes decisions before committing.
It never fires automatically. Always a deliberate invoke by Dhruva.

### Two ways to invoke Fable 5

**1. From any Discord channel — explicit model override (preferred for decisions):**
```
@fable should we migrate GBrain from PGLite to Qdrant?
@fable [question or decision to reason through]
```
Hermes routes the message to `claude-fable-5`. Scout runs automatically first (see below).
Works from #briefings, #research, #tasks, or any channel.

**2. From Claude Code — skill or direct model flag:**
```
/model fable [task description]
```
Or prefix any prompt with `USE FABLE:` to force Tier 4 routing.

### When to invoke Fable 5

**Primary — system improvement and idea generation:**
- "How should we evolve DhruvaOS over the next month?"
- "What's the smartest way to improve the skill loop?"
- "What capabilities is this system missing?"
- "How do we make GBrain/Hermes/Drew smarter based on how we actually operate?"
- Any session where Dhruva wants Fable to reason over the full system state and generate ideas

**Secondary — high-stakes decisions:**
- Irreversible architecture changes (new core subsystem, removing GBrain, replacing Hermes)
- Security model changes (quality firewall logic, approval gates, allowlist)
- Major provider or dependency switches (permanent LLM tier change, new vector DB)
- Decisions that would take >1 week to reverse if wrong

**Always qualifies:**
- Any time Dhruva explicitly invokes `@fable` — intent overrides all routing rules

**Not Fable (use Tier 3):**
- Implementation tasks, new skills, debugging, code review, refactoring
- Research that doesn't require strategic synthesis
- Day-to-day planning

### Scout → Decide pattern (mandatory before every Tier 4 call)

**Never call Fable 5 cold.** Every Tier 4 call is preceded by a Tier 2 (Sonnet 4.6) scout run.
This happens automatically when Dhruva invokes `@fable` or `/model fable`.

```
1. SCOUT (Tier 2 — Sonnet 4.6):
   Read the relevant system state and produce a CONTEXT BRIEF for Fable.
   For idea generation / system improvement sessions, include:
     - Current system architecture snapshot (what exists, what's working, what's weak)
     - Recent activity: last 7-14 days of commits, skill invocations, Discord patterns
     - Known gaps, friction points, and things Dhruva has flagged or complained about
     - Current BUILD_PLAN.md phases + what's in progress
     - GBrain learnings from recent sessions (search "improvement" "friction" "idea")
     - Any relevant external research (fetch if needed)
   For decision sessions, also include:
     - Options considered with tradeoffs
     - Prior ADRs relevant to this decision
     - Reversibility assessment

   Output: a structured CONTEXT BRIEF — dense, no filler, max 800 tokens.
   Never dump raw files. Synthesize.

2. THINK (Tier 4 — Fable 5):
   - Receives only the CONTEXT BRIEF
   - For idea generation: proposes improvements, new capabilities, smarter patterns
     based on how the system actually operates — not generic advice
   - For decisions: reasons through options, validates tradeoffs, makes the call
   - Output: specific, actionable ideas or decision + rationale

3. LOG (for decisions only):
   - Write an ADR to decisions/ capturing: decision, brief summary, Fable 5 rationale
   - Log Tier 4 invocation to GBrain with timestamp
```

### Hermes config for Tier 4

```yaml
  tier_4:
    model: "claude-fable-5"
    provider: "anthropic"
    max_tokens: 16384
    temperature: 0.3
    use_cases:
      - irreversible_architecture
      - security_model_changes
      - permanent_provider_switches
      - high_consequence_decisions
    outbound_allowed: false
    requires_approval: true
    approval_channel: "corrections"
    scout_required: true              # Tier 2 scout brief must precede every call
    min_scout_tokens: 500             # reject if brief is too thin
    auto_escalate: false              # NEVER auto-escalate to Tier 4 — manual only
```

---

## Quality Firewall (absolute — no exceptions, no cost override)

```
Rule: any text that a human other than Dhruva will read
      MUST use Tier 2+ AND requires explicit Dhruva approval before send.

if skill.metadata.outbound == true:
    1. Use claude-sonnet-4-6 (minimum)
    2. Generate text
    3. Send preview to Discord #corrections with context
    4. BLOCK until Dhruva reacts 👍 OR sends /approve <id>
    5. If /deny <id> or no response in 24h → discard, log reason
    6. Log: timestamp, skill name, model used, approval user, latency
```

**Outbound = any of these destinations:** email send, LinkedIn post, GitHub comment/PR,
personal website update, Twitter/X post, any message to a third party.

**Not outbound (no approval needed):** internal Discord channels, GBrain writes, task lists,
calendar creates, local file writes, research synthesis (internal), briefings to self.

Internal Discord is still third-party infrastructure. Internal posts should minimize retained
personal data: avoid full email bodies, redact unnecessary third-party personal details, and
verify private channel ACLs before posting sensitive summaries. Internal does not mean public-safe.

---

## Hermes config.yaml (complete routing section)

```yaml
# ~/.hermes/config.yaml

providers:
  ollama:
    base_url: "http://localhost:11434/v1"
    api_key: "dummy"           # Ollama ignores the key

  openai_direct:
    api_key: "${OPENAI_API_KEY}"            # from ~/.hermes/.env
    base_url: "https://api.openai.com/v1"  # direct — bills platform.openai.com

  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"         # from ~/.hermes/.env

  openrouter:                               # FALLBACK ONLY — own OpenRouter billing
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"

models:
  tier_0:
    model: "phi4-mini"
    provider: "ollama"
    max_tokens: 2048
    temperature: 0.1
    use_cases:
      - triage
      - formatting
      - parsing
      - classification
    outbound_allowed: false
    enabled: true

  tier_1:
    primary:
      model: "gpt-4o-mini-2024-07-18"
      provider: "openai_direct"
      max_tokens: 4096
      temperature: 0.3
    fallback:
      model: "deepseek/deepseek-v3"
      provider: "openrouter"
      max_tokens: 4096
      temperature: 0.3
    use_cases:
      - research
      - task_planning
      - data_analysis
      - mid_complexity
    outbound_allowed: false
    active_backend: "primary"    # change to "fallback" when credits < $50

  tier_2:
    model: "claude-sonnet-4-6"
    provider: "anthropic"
    max_tokens: 8192
    temperature: 0.7
    use_cases:
      - outbound_writing
      - code_review
      - complex_analysis
      - reasoning
    outbound_allowed: true
    requires_approval: true
    approval_channel: "corrections"

  tier_3:
    model: "claude-opus-4-8"
    provider: "anthropic"
    max_tokens: 16384
    temperature: 0.5
    use_cases:
      - orchestration
      - architecture
      - high_stakes_decisions
      - long_horizon_planning
    outbound_allowed: true
    requires_approval: true
    approval_channel: "corrections"

  tier_4:
    model: "claude-fable-5"
    provider: "anthropic"
    max_tokens: 16384
    temperature: 0.3
    use_cases:
      - irreversible_architecture
      - security_model_changes
      - permanent_provider_switches
      - high_consequence_decisions
    outbound_allowed: false
    requires_approval: true
    approval_channel: "corrections"
    scout_required: true              # Tier 2 scout brief must precede every call
    auto_escalate: false              # NEVER auto-escalate to Tier 4 — manual invoke only

routing:
  quality_firewall:
    outbound_min_tier: 2
    require_approval: true
    approval_timeout_hours: 24    # deny + log if no response in 24h
    approval_channel: "corrections"
    # Internal briefings are not outbound; they should stay outbound:false at the skill level.

  escalation:
    on_reasoning_failure: "bump_one_tier"
    on_tool_failure: "retry_same_once_then_bump"
    on_context_overflow: "summarize_then_retry"
    promote_permanently_after_days: 7
    promote_permanently_threshold: 0.30   # >30% escalation rate → permanent

  tier_1_watchdog:
    provider: "openai_direct"
    # NOTE: OpenAI has no programmatic balance API. check_balance_daily will no-op.
    # Use manual monthly dashboard check + OpenAI billing alert at $50 threshold.
    check_balance_daily: false
    switch_to_fallback_when_balance_below_usd: 50.0
    notify_channel: "alerts"

agent:
  yolo_mode: false
  require_approval_always: true    # dangerous commands always need approval
  allowed_discord_users:
    - "${DISCORD_ALLOWED_USER}"
  max_iterations: 90               # hard cap per run
  max_concurrent_tools: 8
  max_subagents: 3
  max_subagent_depth: 2

security:
  allowed_discord_users:
    - "${DISCORD_ALLOWED_USER}"
  require_approval_for_shell: true
  require_approval_for_outbound: true
  log_all_approvals: true
```

---

## Escalation Decision Tree

```
Hermes receives task
        │
        ▼
Assess complexity → assign initial tier
        │
        ▼
Run on assigned tier
        │
   ┌────┴──────────────┐
   │                   │
   ▼                   ▼
 Success            Failure
   │                   │
   ▼              ┌────┴──────────────┐
Return result     │                   │
                  ▼                   ▼
           Reasoning gap        Tool/API error
                  │                   │
                  ▼                   ▼
         Bump one tier up      Retry same tier once
                  │                   │
                  ▼              ┌────┴──────┐
               Run again         │           │
                  │           Success    Still fails
                  ▼              │           │
             Success/fail     Return      Bump tier
                              result      + run again
```

**Permanent promotion:** when a skill is escalated >30% of its runs over 7 days,
update its `tier` field in the skill YAML and log the change to GBrain.

---

## OpenAI Credit Burn Estimate

| Scenario | Requests/day | Avg tokens | Cost/day | Monthly | Credits last |
|----------|-------------|-----------|---------|--------|-------------|
| Conservative | 200 | 600 | $0.018 | $0.54 | 154 months |
| Moderate | 500 | 800 | $0.060 | $1.80 | 47 months |
| Heavy | 2000 | 1200 | $0.36 | $10.80 | 8 months |

At moderate usage, ~$1,000 in OpenAI platform credits lasts ~4 years.
Set a monthly dashboard check + $50 alert as Tier 1 fallback trigger.

**OpenAI dashboard:** https://platform.openai.com/usage

---

## Tier 1 Fallback Activation (when credits drop below $50)

1. Log in to OpenAI dashboard (https://platform.openai.com/usage) — confirm balance < $50
   Note: there is no programmatic API for this; check manually or via dashboard billing alert.
2. Edit `~/.hermes/config.yaml`:
   - Set `tier_1.active_backend: "fallback"`
   - Ensure `OPENROUTER_API_KEY` is set in `.env`
3. Restart Hermes: `systemctl --user restart hermes-gateway`
4. Verify: run a Tier 1 task, check logs for `deepseek/deepseek-v3` provider hit
5. Log the switch date in `decisions/` as an ADR

**Cost after switch:** DeepSeek V3 via OpenRouter = $0.23/$0.34 per 1M in/out.
At moderate usage: ~$3-8/month (vs ~$1.80/month on OpenAI).
Billed to your OpenRouter account (separate from Anthropic and OpenAI).

---

## Prompt Caching (Anthropic — reduces Tier 2/3 costs 40-60%)

Enable for system prompts that include Hermes context + GBrain brain content.
Cache threshold: system prompt >1024 tokens = eligible.

```yaml
# Add to Anthropic API calls in Hermes
anthropic:
  prompt_caching: true
  cache_system_prompt: true   # persistent across sessions
```

Cache hits = 90% discount on input tokens. Cache TTL = 5 minutes.
For briefings and recurring skills with stable system prompts, this is the primary cost lever.

---

## Provider Configuration for Each Tier

### Tier 0 — Ollama (local)
```bash
# Verify phi4-mini is serving
ollama list    # should show phi4-mini
ollama run phi4-mini "test"
# VRAM: ~2.5 GB (3.5 GB free on GTX 1660 Ti)
```

### Tier 1 — OpenAI direct
```bash
# Test direct connection (bills your platform account)
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini-2024-07-18","messages":[{"role":"user","content":"ping"}]}'
```

### Tier 1 fallback — OpenRouter (own account)
```bash
# Test OpenRouter connection
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-v3","messages":[{"role":"user","content":"ping"}]}'
```

### Tier 2/3 — Anthropic
```bash
# Test Anthropic connection
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'
```
