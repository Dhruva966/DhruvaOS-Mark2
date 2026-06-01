# OpenRouter — Credits Routing Finding

Researched: 2025-06-01. Source: OpenRouter API + documentation.

## Critical Finding

**OpenRouter uses its own billing system. OpenAI platform credits CANNOT be spent through OpenRouter.**

OpenRouter is a separate company with separate billing. It does not support BYOK (Bring Your
Own Key) for provider routing. When you use OpenRouter to call OpenAI models, those calls
bill to YOUR OpenRouter account, not to your platform.openai.com account.

Your ~$1,000 in OpenAI platform credits are STRANDED if you route through OpenRouter.

## Implication for DhruvaOS Model Routing

Tier 1 must use a direct `OPENAI_API_KEY` connection to `api.openai.com` to spend platform credits:

```yaml
providers:
  openai_direct:
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"    # direct — bills platform.openai.com
```

OpenRouter is used separately as a Tier 1 fallback **only after OpenAI credits are exhausted**:
```yaml
providers:
  openrouter:
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"          # separate OpenRouter account, own billing
```

## OpenRouter Model Pricing (as of 2025-06-01)

| Model | Input $/1M | Output $/1M |
|-------|-----------|------------|
| openai/gpt-4o-mini | $0.15 | $0.60 |
| deepseek/deepseek-v3 (V3.2) | $0.2288 | $0.3432 |
| deepseek/deepseek-v3 (V3.1) | $0.21 | $0.79 |
| openai/gpt-4o | $2.50 | $10.00 |

Total models available on OpenRouter: 343 (as of research date)

## OpenRouter Auth Format

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer <OPENROUTER_API_KEY>
```

## Recommendation

DhruvaOS MODEL_ROUTING.md implements:
1. Tier 1 PRIMARY: direct OpenAI API (`openai_direct`) — burns platform credits
2. Tier 1 FALLBACK: OpenRouter DeepSeek V3 (`openrouter`) — own billing when credits < $50
3. Tier 1 credit watchdog: monitors platform.openai.com balance, triggers fallback at $50

This is the correct architecture to not strand the ~$1,000 in platform credits.
