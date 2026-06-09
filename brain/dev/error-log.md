---
title: "Dev Error Log"
tags: ["dev", "errors", "debugging", "learning"]
source: "dev-error-log skill"
---

# Dev Error Log

Reverse-chronological log of bugs, debugging dead ends, and fixes.
Searchable by tag: [model-deprecation] [auth] [security] [config] [json-parse] [cron] [gbrain] [hermes] [deploy] [network] [discord] [misc]

<!-- entries below this line -->

---

## [2026-06-08] [model-deprecation] [cron] [hermes]

**Error:** 3 cron jobs (morning-briefing, contact-health-check, birthday-reminder) failing with "Unknown provider 'openai'" at 8am. Secondary batch: api-cost-watchdog, content-calendar, content-idea-engine failing with HTTP 404 (deprecated model shut down June 2026) at 9am.

**Failed fixes:**
- Checked SKILL.md bodies for `openai` refs → none found (tier: 0/2, no OPENAI prereqs)
- Checked `config.yaml` auxiliary entries → all `provider: google`
- Ran `hermes model list` → subcommand does not exist
- Checked `providers: {}` → empty, no openai entry defined

**Fix that worked:**
1. Updated `model.default` to `gemini-3.1-flash-lite` in `~/.hermes/config.yaml` (fixes 9am batch — previous value was a deprecated model shut down June 2026).
2. Cleared model override in `~/.hermes/cron/jobs.json` for morning-briefing (was a deprecated model that Hermes catalog routes through OpenAI-compat Gemini endpoint → needs `provider: openai` in `providers: {}` → not configured → error).

**Root cause:** Config referenced a deprecated Gemini model (shut down June 2026). Additionally, a cron model override in Hermes catalog uses the OpenAI-compatible Gemini endpoint as its provider internally, which is not the same as the native `provider: google` path.

**Notes:**
- Current valid Gemini models: verify at https://ai.google.dev/gemini-api/docs/models — never use model names from memory.
- Current default in use: `gemini-3.1-flash-lite`.
- `hermes model` is interactive-only TUI. No `--list` flag. Catalog lives at `~/.hermes/models_dev_cache.json`.
- `hermes cron edit` has NO `--model` flag. Model overrides live directly in `~/.hermes/cron/jobs.json`.
- Error "Unknown provider 'openai'" with `provider: google` in config = the specific model routes through OpenAI-compat endpoint. Fix: clear the model override from jobs.json; use global default.
- `fallback_providers: []` being empty means ANY model failure goes straight to "Unknown provider" error with no fallback. Keep it empty (don't add openai) — just use valid models.

_Logged: 2026-06-08 23:00 UTC_

---

## [2026-06-08] [security] [auth]

**Error:** All `drew-ui` API routes (`/api/voice/*`, `/api/drew/*`) were completely unauthenticated. Anyone knowing the URL could call Anthropic/OpenAI APIs on Dhruva's keys, trigger Hermes skills, or read memory.

**Fix that worked:**
1. Created `drew-ui/lib/auth.ts` with `requireAuth(request)` using `timingSafeEqual` from Node `crypto`.
2. Added `const unauth = requireAuth(request); if (unauth) return unauth;` at top of every handler.
3. Extended Next.js middleware `matcher` to include `/api/voice/:path*` and `/api/drew/:path*`.

**Root cause:** Next.js `middleware.ts` with a path `matcher` only gates the matched paths. `/api/*` routes are separate and need in-handler auth unless explicitly in the matcher. The original middleware only covered page routes.

**Notes:**
- Use `timingSafeEqual` (never `===`) for password/token comparison. Prevents timing side-channel.
- Cookie name is `site-auth`, same as set by `/api/auth/route.ts` login handler.
- Defense-in-depth: middleware blocks at edge, `requireAuth()` blocks at handler. Both needed.

_Logged: 2026-06-08 23:00 UTC_

---

## [2026-06-08] [json-parse] [hermes]

**Error:** `paper-monitor` was silently keeping all papers when phi4-mini returned JSON wrapped in markdown fences (` ```json ... ``` `). `json.loads()` fails on fenced JSON; skill caught the error and defaulted to score=5 (keep all), so no filtering happened.

**Fix that worked:** Added fence-stripping before `json.loads()` in `score_batch()`:
```python
raw = result.get("response", "[]").strip()
if raw.startswith("```"):
    raw = raw.split("```", 2)[1]
    if raw.startswith("json"):
        raw = raw[4:]
    raw = raw.rsplit("```", 1)[0].strip()
scores = json.loads(raw)
```

**Root cause:** phi4-mini (and most LLMs) habitually wrap JSON output in markdown fences even when instructed not to. Any skill calling a local model and parsing JSON output must fence-strip defensively.

**Notes:**
- Apply this pattern to ANY skill that calls `llm_call(tier=0)` and parses the response as JSON.
- The morning-briefing and other skills likely have the same issue if they parse phi4-mini JSON.

_Logged: 2026-06-08 23:00 UTC_
