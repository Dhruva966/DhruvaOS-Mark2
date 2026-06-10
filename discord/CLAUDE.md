# discord/ — Discord Interface

Purpose: Discord channel definitions, routing rules, and message conventions for DhruvaOS.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Files

| What | Where |
|------|-------|
| Channel definitions | `discord/channels.md` |
| Bot config | `~/.hermes/config.yaml` (discord section) |

---

## Channel Definitions

→ See [channels.md](channels.md) for full channel definitions and setup instructions.

---

## Model Override — Explicit Model Selection from Discord

Dhruva can invoke any model explicitly from any Discord channel using the `@model` prefix.
Hermes routes the message to that model regardless of task type.

```
# Anthropic
@fable    → claude-fable-5          (idea generation, system improvement, high-stakes decisions)
@opus     → claude-opus-4-8         (orchestration, architecture, complex planning)
@sonnet   → claude-sonnet-4-6       (default, outbound writing, code review)
@haiku    → claude-haiku-4-5        (fast, cheap — summaries, formatting, quick lookups)

# OpenAI
@gpt4o    → gpt-4o                  (heavy OpenAI reasoning, multimodal, long context)
@mini     → gpt-4o-mini             (research, analysis, fast tasks)

# Google
@gemini   → gemini-3.1-flash-lite   (fallback when Anthropic credits low; verify ID at ai.google.dev)

# Other
@deepseek → deepseek/deepseek-v3    (cheap Tier 1 fallback via OpenRouter)
@local    → phi4-mini               (local Ollama, triage/classification, no API cost)
```

Examples:
```
@fable what's the smartest way to evolve the skill loop this month?
@fable should we switch from PGLite to Qdrant?
@opus plan out the next 3 phases of DhruvaOS build
@sonnet draft a reply to this email: [paste]
@haiku summarize this document in 5 bullets
@gpt4o analyze this chart image and extract the key numbers
@mini what's the current state of Hermes versioning?
@gemini quick — what's the cheapest way to do X?
@deepseek research alternatives to Tailscale for remote access
@local is this message spam?
```

**`@fable` behavior:**
- Scout (Sonnet 4.6) runs automatically first — gathers current system state + context
- Scout produces a CONTEXT BRIEF
- Fable 5 receives the brief + Dhruva's message, responds
- No raw context dump to Fable — always pre-digested

**No prefix = default routing** (Hermes assigns tier based on task complexity as normal).

---

## Allowed Patterns ✅

```
# ✅ Correct command format — slash prefix triggers skill dispatch
/research neural scaling laws
/tasks add "finish ENVIRONMENT.md setup"
/correct when drafting emails, always use formal tone
/email triage
```

```
# ✅ Correct outbound approval flow in #corrections
Hermes posts:
  📤 [APPROVAL REQUIRED] email-reply
  To: recruiter@company.com
  Model: claude-sonnet-4-6 (Tier 2)
  ---
  Subject: Re: Software Engineering Internship
  
  Hi Sarah,
  Thank you for reaching out...
  ---
  React 👍 to approve • Reply /deny to reject

Dhruva reacts 👍 → Hermes sends email
```

```
# ✅ Correct correction format in #corrections
/correct morning briefings should list calendar events before email summary
/correct when I say "todo", add it to tasks not research
```

---

## Forbidden Patterns ❌

```
# ❌ Hermes posts outbound content directly without showing preview
# (Any message to external recipients must go through #corrections first)
# There is NO exception to this rule
```

```
# ❌ Dhruva approves outbound from #briefings or any channel other than #corrections
# All approvals must come from #corrections (the audit log is there)
```

```
# ❌ Bot responds to users other than Dhruva
# The Discord allowlist must contain only Dhruva's user ID
# If an unauthorized user DMs the bot, it must not respond
```

---

## What NOT to Do

1. **Never route outbound approvals through any channel other than #corrections.**
   `#corrections` is the audit log for all outbound actions. Every approval, denial,
   and correction must be traceable there.

2. **Never let Hermes respond to unauthorized Discord users.** The allowlist in
   `~/.hermes/config.yaml` is the security boundary. An unsolicited response to
   an unauthorized user = potential prompt injection attack vector.

3. **Never post sensitive information (API keys, personal data beyond Dhruva's own)
   in Discord channels.** Discord's servers store message history. Brain content
   that contains personal details about third parties should not be posted verbatim.

4. **Never use #briefings as a task manager.** #briefings is for reading (briefings)
   and conversation. Action items and tasks belong in #tasks. Cross-posting creates
   a confusing two-source-of-truth situation.

5. **Never let #charlie carry active traffic until the CharlieWorker skill is implemented
   and scoped.** The channel exists to reserve the integration point, not to use it.
   Posting to an unimplemented channel creates false signal.
