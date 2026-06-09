# DhruvaOS Mark 2

## What This Is

A 24/7 autonomous personal AI OS — "Jarvis for Dhruva." Hermes Agent handles the runtime,
self-improving skill loop, and Discord interface. GBrain handles compounding memory that gets
smarter every day. Together they handle menial work, surface what matters, and ask before
acting on anything high-stakes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Hermes Agent (verify installed version with `hermes --version`; Python 3.11+ host, 3.12 on Omen, systemd user service) |
| Memory | GBrain v0.42.36.0 (Bun 1.3.14, PGLite at ~/.gbrain/brain.pglite/) |
| Interface | Discord (6 channels) — bot name: drew#4878 |
| Tier 0 model | phi4-mini via Ollama (local, GTX 1660 Ti 6GB, nomic-embed-text for embeddings) |
| Tier 1 model | GPT-4o-mini (direct OpenAI API — burns platform.openai.com credits) |
| Tier 2 model | Claude Sonnet 4.6 (Anthropic — ALL outbound writing) |
| Tier 3 model | Claude Opus 4.8 (Anthropic — orchestration + high-stakes) |
| Gemini fallback | `gemini-3.1-flash-lite` via `provider: google` — used when Anthropic credits depleted. **Always verify current model ID at ai.google.dev before configuring.** Gemini 2.0 shut down 2026-06-01. |
| Process management | Hermes: systemd user service. GBrain: PM2 daemon (`gbrain-mcp`, HTTP mode port 3131). Ollama: systemd system service. |
| Remote access | Tailscale SSH primary; Cloudflare Tunnel only for future authenticated HTTP surfaces |
| Host | HP Omen 15 — 32 GB RAM, GTX 1660 Ti 6 GB, Ubuntu 24.04, user: dhruva |
| Optional future | MiniMax API (image-01, Hailuo video, TTS) — credits available; safe for non-sensitive/generic use only |
| Future scaling | Qdrant: evaluate only if memory entries exceed ~500K or multi-service vector reads needed |

## Directory Structure

```
DhruvaOS Mark 2/
├── CLAUDE.md              # This file — root context for all agents
├── AGENTS.md              # Thin adapter for Codex / OpenCode / Antigravity
├── ARCHITECTURE.md        # System design, layer diagram, component mapping
├── ENVIRONMENT.md         # Omen setup, runtimes, security hardening
├── MODEL_ROUTING.md       # 4-tier routing spec, quality firewall, config
├── SKILLS.md              # Starting skills, trust model, authoring pattern
├── MEMORY.md              # GBrain setup, Obsidian ingest, braindump guide
├── BUILD_PLAN.md          # Active phases only — what's pending and in-progress
├── BUILD_PLAN_PART1.md    # Historical archive — completed phases, runbooks, install commands
├── COST.md                # Year 1/2 cost model, credit burn, VPS migration
├── VISION.md              # Jarvis north star
├── HANDOFF.md             # Hermes↔GBrain contracts, integration checklist
├── DEPLOYMENT.md          # Omen setup runbook, VPS migration path
├── README.md              # Project overview, flow diagram, scripts
├── hermes/
│   └── CLAUDE.md          # Hermes skill development patterns
├── gbrain/
│   └── CLAUDE.md          # GBrain ingest, search, memory patterns
├── skills/
│   ├── CLAUDE.md          # Skill authoring rules + trust gate
│   ├── *.yaml                   # legacy/reference stubs only
│   └── dhruvaos/<skill>/SKILL.md # deployed skill source
├── brain/                 # Symlink → ~/brain/ (markdown knowledge base)
│   └── CLAUDE.md          # Brain content structure + writing conventions
├── discord/
│   ├── CLAUDE.md          # Channel purposes + message routing
│   └── channels.md        # Channel definitions
├── references/            # Fetched official docs and dated research notes
├── wiki/                  # Long-form context docs
├── decisions/             # Architecture decision records
└── docs/superpowers/plans/
```

## Agent Model Routing

| Task Type | Model | Tier |
|-----------|-------|------|
| Internal triage, formatting, parsing, classification | phi4-mini (Ollama) | 0 |
| Research, task planning, data analysis, mid-complexity | GPT-4o-mini (OpenAI direct) | 1 |
| ALL outbound writing, reasoning, code review | Claude Sonnet 4.6 | 2 |
| Orchestration, architecture, high-stakes decisions | Claude Opus 4.8 | 3 |

**QUALITY FIREWALL (absolute, no override):** Any text that another human will read goes through
Tier 2+ AND requires Dhruva's explicit Discord approval before send. Cost never overrides this.

Escalate only when lower tier fails with a clear reasoning gap. Promote permanently when a skill
escalates >30% of runs in a week.

## Omen SSH Access (every new chat needs this)

```bash
ssh dhruva@100.119.229.11
```

**PATH fix — always run this in non-login SSH sessions** (uv, bun, hermes, gbrain all missing otherwise):
```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
```

Tailscale must be active on both devices. If SSH hangs, check: `tailscale status` on Mac.

## Key Entry Points

| What | Where |
|------|-------|
| Hermes runtime config | `~/.hermes/config.yaml` |
| GBrain config | `~/.gbrain/config.json` |
| Starting skills | `skills/dhruvaos/<skill>/SKILL.md` (deployed to `~/.hermes/skills/dhruvaos/<skill>/SKILL.md`) |
| Brain repo | `~/brain/` |
| GBrain MCP server | Production: `gbrain serve --http --port 3131 --host 127.0.0.1`; stdio only for ad-hoc local tests |
| All API keys | `~/.hermes/.env` (chmod 600, never committed) — canonical secrets file |
| Discord channel map | `discord/channels.md` |
| Hermes status | `systemctl --user status hermes-gateway` |
| GBrain status | `pm2 list` (gbrain-mcp process) |
| Hermes logs | `~/.hermes/logs/gateway.log` |
| GBrain health | `gbrain onboard --check --json` |
| GBrain database | `~/.gbrain/brain.pglite/` |
| Dream cycle | `gbrain dream` (cron at 3am) |
| Restart Hermes | `systemctl --user restart hermes-gateway` (never ask Drew to restart itself) |

## Database Schema

GBrain owns the schema via PGLite (embedded Postgres + pgvector). Do not interact with it
directly. All reads/writes go through `gbrain search`, `gbrain think`, or MCP tool calls.

Brain content lives in `~/brain/` as markdown. GBrain ingests it via `gbrain import`.

Schema migrations are handled automatically by `gbrain upgrade` + `gbrain apply-migrations --yes`.

## Security Non-Negotiables

1. Hermes runs as `dhruva` user (main user, no separate dhruvaos account needed)
2. All API keys in `~/.hermes/.env` (chmod 600, never committed to git)
3. Discord allowlist: only Dhruva's Discord user ID can issue commands
4. YOLO mode disabled — `require_approval_always: true` in config.yaml, always
5. Outbound text ALWAYS Tier 2+ AND requires explicit Discord approval — no cost override, ever

## Agent Behavior Rules (from /insights — enforce always)

1. **CLI: --help first, never trial-and-error.** Before running any CLI tool (gbrain, hermes,
   ntfy, codex, etc.) you're unsure about, run `<tool> --help`, read the output, then show the
   exact command you plan to use. No guessing flags or subcommands.

2. **Tests: update then run after any signature change.** After making integration or signature
   changes, update ALL affected tests to match the new shape and run the full test suite
   (`pytest skills/dhruvaos/<skill>/tests/`) before committing. Never commit with known failing tests.

3. **Specs: confirm before writing to docs.** Never write hardware specs, config keys, or
   product/project names into docs without verifying them. 'Forge', 'Drew', 'Hermes', HP Omen
   specs — confirm against live system or ask. Don't infer from context.

4. **Context: save before long autonomous tasks.** Before starting any multi-skill build, phase
   deployment, or task that may hit token/credit limits, run context-save and write a HANDOFF.md
   checkpoint. Mid-task loss ≠ clean stopping point.

5. **Models/APIs: search before using. Never trust training data for current model names, versions,
   or pricing.** AI training data is stale. Before referencing any model (Gemini, Claude, GPT, etc.),
   package version, or external API in config or code: fetch the official docs page directly
   (ai.google.dev, docs.anthropic.com, etc.) and confirm the model ID exists and is not deprecated.
   Gemini 2.0 models shut down June 1, 2026. Any model released or deprecated after August 2025
   requires a live lookup — no exceptions.

## Testing Standard

- Skill contract tests: repo-local `pytest skills/dhruvaos/<skill>/tests/`; Hermes `--mock-tools` is not available
- Brain health after any import: `gbrain onboard --check --json`
- Model routing: verify tier escalation in Hermes logs after each skill run
- Quality firewall: end-to-end test before enabling any outbound skill (verify approval gate fires)
- Integration: test Hermes→GBrain MCP call returns valid results before declaring Phase 1 complete

## Agent-Driven Development Workflow

Every non-trivial task:
1. Decompose into 15-minute units (single dominant risk, verifiable done condition)
2. Dispatch to fresh implementer subagent with full task text + context
3. Spec review: verify code matches requirements (do not trust implementer's self-report)
4. Quality review: verify clean, tested, maintainable
5. Commit per task, not per feature

Parallel dispatch: independent tasks only (different skill files, no shared GBrain DB writes).
Sequential: GBrain DB operations, Hermes config.yaml changes, process restarts.

## Claude Code Skills

Active skills live in `~/.claude/skills/` and appear in the system reminder automatically.
Inactive skills (pruned for context efficiency) live in `~/.claude/inactive_skills/`.

**If a requested skill isn't in the active list:** check inactive before saying it doesn't exist:
```bash
ls ~/.claude/inactive_skills/ | grep <name>
# if found:
mv ~/.claude/inactive_skills/<name> ~/.claude/skills/
```
Restore takes effect immediately. Re-inactive after use if it was a one-off.

## Subsystem Docs

For task-specific patterns, see the module docs — loaded lazily per task:

| When working on… | Load |
|------------------|------|
| Hermes skills, cron, MCP, restarts | [`hermes/CLAUDE.md`](hermes/CLAUDE.md) |
| GBrain ingest, embed, jobs, CLI gotchas | [`gbrain/CLAUDE.md`](gbrain/CLAUDE.md) |
| Skill YAML authoring, trust gate | [`skills/CLAUDE.md`](skills/CLAUDE.md) |
| Discord channels, routing | [`discord/CLAUDE.md`](discord/CLAUDE.md) |
| Environment variables, API keys | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
