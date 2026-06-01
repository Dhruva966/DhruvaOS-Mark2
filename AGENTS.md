# DhruvaOS Mark 2 — Agent Entry Point

**Read [`CLAUDE.md`](CLAUDE.md) first. It is the canonical source of truth for this project.**

This file is a thin adapter for Codex, OpenCode, Google Antigravity, and other coding agents
that load `AGENTS.md` natively. Everything substantive lives in `CLAUDE.md` and the
module-level docs below. Nothing here duplicates it.

## Module Docs — Load Lazily

Only load a module doc when your task touches that subsystem.

| When working on… | Load |
|------------------|------|
| Hermes runtime / skills | [`hermes/CLAUDE.md`](hermes/CLAUDE.md) |
| GBrain memory / ingest | [`gbrain/CLAUDE.md`](gbrain/CLAUDE.md) |
| Skill YAML authoring | [`skills/CLAUDE.md`](skills/CLAUDE.md) |
| Brain content / writing | [`brain/CLAUDE.md`](brain/CLAUDE.md) |
| Discord channels / routing | [`discord/CLAUDE.md`](discord/CLAUDE.md) |

## Security Non-Negotiables (all agents, no override)

1. Never commit API keys, `.env` files, or `brain.db`
2. All runtime ops run as `dhruvaos` non-root user — never root
3. Never bypass the Discord approval gate for any outbound text
4. Quality firewall: any text sent to a third party (email, LinkedIn, GitHub, personal site) → Tier 2+ model → explicit Dhruva approval before send

## Codex / OpenCode Agent Definitions

```toml
[agents.implementer]
description = "Implement a single skill or task from the build plan"
model = "codex-1"
context = ["CLAUDE.md", "SKILLS.md", "MODEL_ROUTING.md"]

[agents.spec-reviewer]
description = "Verify implementation matches spec — read code, do not trust self-report"
model = "codex-1"
context = ["CLAUDE.md", "BUILD_PLAN.md"]

[agents.quality-reviewer]
description = "Verify implementation is clean, tested, maintainable"
model = "codex-1"
context = ["SKILLS.md", "CLAUDE.md"]

[agents.gbrain-ops]
description = "Run GBrain ingest, embed, or dream — sequential only, never parallel"
model = "codex-1"
context = ["MEMORY.md"]
sequential = true
```
