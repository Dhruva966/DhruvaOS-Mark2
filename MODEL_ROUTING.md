# DhruvaOS Mark 2 — Model Routing

## Tier Definitions

| Tier | Model | Provider | Input $/1M | Output $/1M | Use Cases |
|------|-------|----------|-----------|------------|-----------|
| 0 | phi4-mini | Ollama (local) | $0 | $0 | Triage, formatting, parsing, classification — **internal only** |
| 1 | gpt-4o-mini-2024-07-18 | OpenAI direct (platform credits) | $0.15 | $0.60 | Research, task planning, data analysis, mid-complexity |
| 1 fallback | deepseek/deepseek-v3 | OpenRouter (own billing) | $0.23 | $0.34 | Same as Tier 1 after OpenAI credits < $50 |
| 2 | claude-sonnet-4-6 | Anthropic | $3 | $15 | **ALL outbound writing**, reasoning, code review, complex analysis |
| 3 | claude-opus-4-8 | Anthropic | $15 | $75 | Orchestration, architecture decisions, high-stakes planning |

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

---

## Hermes config.yaml (complete routing section)

```yaml
# ~/.hermes/config.yaml

providers:
  ollama:
    base_url: "http://localhost:11434/v1"
    api_key: "dummy"           # Ollama ignores the key

  openai_direct:
    api_key: "${OPENAI_API_KEY}"            # from ~/.config/dhruvaos/.env
    base_url: "https://api.openai.com/v1"  # direct — bills platform.openai.com

  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"         # from ~/.config/dhruvaos/.env

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

routing:
  quality_firewall:
    outbound_min_tier: 2
    require_approval: true
    approval_timeout_hours: 24    # deny + log if no response in 24h
    approval_channel: "corrections"
    # Briefing channels auto-approve — Dhruva is the only reader, no third-party risk
    auto_approve_channels:
      - "briefings"              # morning-briefing, evening-briefing post here

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
3. Restart Hermes: `pm2 restart hermes`
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
