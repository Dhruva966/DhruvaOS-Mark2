---
name: skill-proposal
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Draft and propose new Hermes skills from Discord command or novel task context; await 👍 approval before deploying"
schedule: null
gbrain:
  reads: ["skills/*", "brain/*"]
  writes: []
# Note: this skill writes to ~/.hermes/skills/dhruvaos/{{skill_name}}/SKILL.md (filesystem),
# not to GBrain/brain. The gbrain.writes field is intentionally empty — the file system
# write happens after explicit 👍 approval.
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [skills, meta, proposal, deployment]
---

# Skill Proposal

## Purpose
The "propose new capability" half of the self-improvement loop. Takes a Discord command or a
novel-task context, checks the brain for existing coverage, drafts a SKILL.md stub for
inspection, and only deploys it after Dhruva 👍s in `#tasks`. Pair to `error-detection` and
`failure-backlog`: those surface gaps; this turns gaps into proposed skills.

## Context
- Trigger: Discord command `/propose-skill <description>`, or Hermes invocation after a novel task with `task_attempted`, `tools_used`, and `outcome` fields
- Channels: `#tasks` (proposal draft, deploy confirmation, discard notice)
- Data sources: GBrain search over existing skills and brain notes; deploys to `~/.hermes/skills/dhruvaos/<name>/SKILL.md`
- Tunables: approval timeout window in `~/brain/config/timing.md`
- Tools: `gbrain_search`, messaging (with reaction watch), `clarify`, file write, `gbrain_think`

## Goal
Either the user is shown an existing skill that already covers the request, or a draft
SKILL.md stub is posted to `#tasks` and resolved in exactly one of three ways: deployed to
`~/.hermes/skills/dhruvaos/<name>/` after 👍, discarded after ❌, or discarded after the
approval window times out. No file write ever happens without confirmed 👍 from
`DISCORD_ALLOWED_USER`.

## Constraints
- The `requires_approval` here covers the deploy step, not the skill run itself. The Discord reaction is the gate.
- Search GBrain first for existing coverage; if a deployed skill already does this, surface it and stop — do not draft a duplicate.
- Derive a canonical kebab-case skill name from the description; keep it short and unambiguous.
- Draft tier and flags must match the security rules: outbound-capable description ⇒ tier ≥ 2 with `outbound: true`; shell-running description ⇒ `requires_approval: true`.
- Only `DISCORD_ALLOWED_USER`'s reaction counts. Ignore others.
- On timeout or ❌: discard cleanly, write nothing.
- On 👍: write `SKILL.md` plus a `tests/` placeholder, then confirm in `#tasks` and record the deployment in GBrain.
- Unparseable input gets a one-line guidance reply, then exit.

## Notes
- The deployed file is a stub — Dhruva is expected to fill in implementation before it runs in production. The confirmation message should remind him to validate with `hermes skill validate <name>`.
- GBrain search failure is non-fatal; treat as "no existing coverage" and continue to draft.
- Discord/file errors after approval should be reported back to `#tasks` and logged to `~/.hermes/logs/skill-errors.log`.
