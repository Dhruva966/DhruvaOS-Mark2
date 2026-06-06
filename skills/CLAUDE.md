# skills/ — Hermes Skill Library

Purpose: Starting skill definitions for DhruvaOS. Deployed to `~/.hermes/skills/dhruvaos/<name>/SKILL.md`.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

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
| Phase 2-3 skills (deployed) | `skills/dhruvaos/*/SKILL.md` |
| Phase 5 stubs (not active) | `skills/dhruvaos/linkedin-post/`, `skills/dhruvaos/github-update/` |
| Live skills (runtime) | `~/.hermes/skills/dhruvaos/` |
| Charlie stub | `skills/charlie-monitoring.yaml` (NOT IMPLEMENTED) |

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
