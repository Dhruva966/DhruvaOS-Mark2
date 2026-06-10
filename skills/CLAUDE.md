# skills/ — Hermes Skill Library

Purpose: Starting skill definitions for DhruvaOS. Deployed to `~/.hermes/skills/dhruvaos/<name>/SKILL.md`.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Intelligence-Guided Skill Format (June 2026 rewrite)

Skills are **goal + context + constraints — NOT scripts.** The agent decides HOW.
Hardcoding steps, code blocks, or thresholds in a skill body removes the intelligence
layer that makes Drew useful. If a number could change as Dhruva's life changes, it
lives in `~/brain/config/*.md`, not in the skill.

### Required structure

```
---
[frontmatter — name + description required; tier/outbound/requires_approval are DhruvaOS conventions]
---

# Skill Name

## Purpose
2–3 sentences. What this achieves, when it runs, why it exists. NO steps.

## Context
- Trigger: how invoked (cron, /command, sub-skill call)
- Channels: env var → channel name mapping
- Data sources: APIs, brain paths, helper scripts
- Tunables: "Check `~/brain/config/<file>.md` for current values; sensible defaults if missing."
- Tools: non-obvious available tools

## Goal
Plain English done condition. What success looks like. Artifacts produced.

## Constraints
- Security / approval rules
- Data integrity (GBrain single-writer / `flock`, canonical writers)
- Quality rules (tier requirements, outbound approval)
- Safety rules (no email reply, no external sends without approval)

## Notes  [optional, only for non-obvious gotchas]
```

### Removed (now forbidden)

- ❌ `## Step N` numbered procedures — agent decides ordering
- ❌ Embedded ` ```python ` or ` ```bash ` code blocks — agent writes its own
- ❌ Hardcoded thresholds ($2.00, 30 days, 750 words, etc.) — config file
- ❌ Rigid `| Failure | Action |` error tables — agent uses judgment
- ❌ Explicit tool-call sequences — agent composes from context
- ❌ Keyword classification lists (ACTION_KEYWORDS, NEWSLETTER_KEYWORDS) — agent classifies

### Kept (essential infrastructure)

- ✅ API field names and schemas (agent can't guess Notion property names)
- ✅ System paths and env var names
- ✅ Security constraints (approval gates, flock contract, tier requirements)
- ✅ Non-obvious gotchas as `## Notes` bullets

### Config externalization

Tunables live in `~/brain/config/`. See `~/brain/config/README.md` for the index:

| File | Tunes |
|------|-------|
| `cost-thresholds.md` | API spend alert triggers |
| `timing.md` | Look-ahead / look-back windows |
| `content-goals.md` | Posting frequency targets |
| `relationship-windows.md` | Contact frequency thresholds |
| `content-guidelines.md` | Voice, tone, format for outbound writing |

A skill MUST tolerate config being missing (use sensible default + note fallback). A skill
MUST NEVER hardcode a value that belongs in config.

### Contract enforcement

- `scripts/check-skill-contracts.py` — static rules (no Step headings, no code blocks, security
  constraints present, GBrain flock contract mentioned when writes declared)
- `skills/dhruvaos/*/tests/test_<skill>_contract.py` — structural pytest (delegates to
  `conftest.py::assert_skill_structure`). Verifies frontmatter + four canonical sections + no
  forbidden patterns. Does NOT assert on specific wording.

Both run on every commit and in `scripts/health-check.sh`.

---

## Hermes Skill Format (verified June 2026)

Hermes uses **SKILL.md markdown files** with YAML frontmatter. The old `.yaml` extension stubs
in `skills/*.yaml` are kept as project-level stubs. Deployed skills go to:
- `skills/dhruvaos/<name>/SKILL.md` → scp to → `~/.hermes/skills/dhruvaos/<name>/SKILL.md`

**Fields Hermes enforces** (only 2 are required):
- `name:` (required) — skill identifier
- `description:` (required) — displayed in hermes skills list

**DhruvaOS documentation conventions** (Hermes IGNORES these — for human reference only):
- `tier:` — intended model tier (enforce manually via cron `--model` flag or config)
- `outbound:` — flags skills that send to external services (check during review)
- `requires_approval:` — implement via `clarify` tool calls in the skill BODY
- `gbrain.reads/writes:` — parallel safety check; GBrain doesn't enforce this
- `schedule:` — does NOT belong in skill YAML; set via `hermes cron create`
- `tests:` — documentation only; `--mock-tools` doesn't exist in Hermes

**Cron setup** (correct method):
```bash
hermes cron create "0 8 * * *" "Morning briefing" --skill morning-briefing --deliver discord
```

## Key Files

| What | Where |
|------|-------|
| Old stubs (reference) | `skills/*.yaml` |
| Phase 2-5 skills (deployed) | `skills/dhruvaos/*/SKILL.md` |
| Live skills (runtime) | `~/.hermes/skills/dhruvaos/` |
| Runtime config (all tunables) | `~/brain/config/` on Omen — read by skills via `gbrain_search("config <area>")` |
| Charlie stub | `skills/charlie-monitoring.yaml` (NOT IMPLEMENTED) |

---

## Dynamic Config Pattern (June 2026)

All tunables (counts, thresholds, formats, model names) live in `~/brain/config/` — never hardcoded in skill files.

**Reading config in a skill:**
```python
config = gbrain_search("config content-goals")   # returns ~/brain/config/content-goals.md
# parse the returned text; fall back to a safe default if empty
```

**Updating config from Discord** — use the `config-update` skill:
> Drew, change my X posting goal to 4 threads per week

The `config-update` skill (`~/.hermes/skills/dhruvaos/config-update/SKILL.md`) locates the correct `~/brain/config/` file, rewrites the value, and re-ingests it into GBrain. No code change required.

**Judgment over mechanics** — as of June 2026, ~25 skills were rewritten to use agent judgment instead of rigid mechanical counts:
- `morning-briefing` / `evening-briefing`: surfaces what matters, not a fixed-N form
- `x-thread-draft`, `linkedin-post`: judgment-based structure, no rigid tweet/word counts
- `paper-monitor`: genuine relevance reasoning, not 0–10 scoring
- `content-idea-engine`: zero ideas if nothing qualifies — quality over quantity

These skills have version bumps: v2.0 (first judgment rewrite) or v3.0 (config-aware + judgment).

---

## Allowed Patterns ✅

→ See [hermes/CLAUDE.md](../hermes/CLAUDE.md) for the canonical SKILL.md frontmatter example and outbound skill pattern.

---

## Forbidden Patterns ❌

```yaml
# ❌ Tier mismatch with outbound=true
name: linkedin-update
tier: 1          # WRONG: outbound requires tier >= 2
outbound: true
```

```yaml
# ❌ Skill without tests field — quality gate will reject
name: my-skill
tier: 1
outbound: false
# tests: missing — WRONG, quality gate fails without this
```

```yaml
# ❌ Shell commands without requires_approval
name: cleanup-files
tier: 1
requires_approval: false    # WRONG: shell = requires_approval must be true
---
run_shell("find /tmp -name '*.old' -delete")
```

```yaml
# ❌ Hardcoded credentials in skill body
---
# WRONG: never put API keys in skill files
headers = {"Authorization": "Bearer sk-proj-abc123..."}
```

---

## What NOT to Do

1. **Never ship a skill without tests.** If the skill has no test directory, the quality
   gate rejects it. Write a minimum happy-path test and one edge case.

2. **Never modify the charlie-monitoring stub to run real logic** until the Charlie's
   Cleaners monitoring requirements are defined. The stub is an intentional placeholder.

3. **Never write a skill that writes to `projects/tasks.md` except task-prioritization.**
   That file has one canonical writer. Two skills writing the same brain file creates
   inconsistent task lists.

4. **Never author a skill without declaring `gbrain.writes`** if it creates brain files.
   Undeclared brain writes bypass the parallel safety check in BUILD_PLAN.md and can
   cause DB collisions during parallel builds.

5. **Never promote a runtime-authored skill without reviewing the trust gate decision.**
   For any skill with `outbound: true` or shell commands, verify the Discord approval DM
   actually arrived and was reviewed before the skill runs in production.

6. **Never hardcode tunables (counts, thresholds, timeouts, model names) in a skill body.**
   All config belongs in `~/brain/config/`. Read it at runtime via `gbrain_search("config <area>")`.
   Use a safe in-code default only as a fallback when the brain returns nothing.

---

## Skill Trust Gate Quick Reference

| Skill type | Trust gate | Who approves |
|-----------|-----------|-------------|
| Read-only (search, calendar read, triage) | Auto after 1 review | Nobody — automatic |
| GBrain writes | Auto | Nobody — writes are reversible |
| File writes outside brain/ | Dhruva approval | Discord DM |
| Calendar creates / email drafts | Dhruva approval | Discord DM |
| Shell commands | Dhruva approval every time | Discord DM |
| Outbound send (email, LinkedIn, GitHub) | Dhruva approval every instance | #corrections channel |
