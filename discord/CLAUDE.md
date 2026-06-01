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

| Channel | Who writes | Who reads | Purpose |
|---------|-----------|----------|---------|
| `#briefings` | Hermes (auto) + Dhruva | Dhruva | Morning/evening briefings, proactive updates, conversational responses |
| `#tasks` | Hermes + Dhruva | Dhruva | Task list, prioritization, status, `/tasks` commands |
| `#research` | Hermes | Dhruva | Research synthesis outputs from research-synthesis skill |
| `#alerts` | Hermes (auto) | Dhruva | Urgent notifications: credit watchdog, skill errors, system alerts |
| `#charlie` | Hermes (future) | Dhruva | Charlie's Cleaners monitoring — stub, not yet active |
| `#corrections` | **Both** | Both | **Outbound approval gate** + behavioral corrections from Dhruva |

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
