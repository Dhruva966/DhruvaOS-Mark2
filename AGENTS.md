# DhruvaOS Mark 2

## What This Is

A 24/7 autonomous personal AI OS — "Jarvis for Dhruva." Hermes Agent handles the runtime,
self-improving skill loop, and Discord interface. GBrain handles compounding memory that gets
smarter every day. Together they handle menial work, surface what matters, and ask before
acting on anything high-stakes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Hermes Agent v1.0.0 (Python 3.11+) |
| Memory | GBrain v0.42.1.0 (Bun ≥1.3.10, PGLite embedded Postgres) |
| Interface | Discord (6 channels) |
| Tier 0 model | phi4-mini via Ollama (local, RTX 2060, 2.5 GB VRAM) |
| Tier 1 model | GPT-4o-mini (direct OpenAI API — burns platform.openai.com credits) |
| Tier 2 model | Claude Sonnet 4.6 (Anthropic — ALL outbound writing) |
| Tier 3 model | Claude Opus 4.8 (Anthropic — orchestration + high-stakes) |
| Process management | PM2 (initial) → systemd (production) |
| Remote access | Cloudflare Tunnel (dorm CGNAT bypass) |
| Host | HP Omen 15 — 32 GB RAM, RTX 2060 6 GB, Ubuntu |

## Directory Structure

```
DhruvaOS Mark 2/
├── CLAUDE.md              # Root context for Claude Code agents
├── AGENTS.md              # This file — Codex mirror + skill catalog
├── ARCHITECTURE.md        # System design, layer diagram, component mapping
├── ENVIRONMENT.md         # Omen setup, runtimes, security hardening
├── MODEL_ROUTING.md       # 4-tier routing spec, quality firewall, config
├── SKILLS.md              # Starting skills, trust model, authoring pattern
├── MEMORY.md              # GBrain setup, Obsidian ingest, braindump guide
├── BUILD_PLAN.md          # Phased rollout, parallel task decomposition
├── COST.md                # Year 1/2 cost model, credit burn, VPS migration
├── VISION.md              # Jarvis north star
├── hermes/CLAUDE.md       # Hermes skill development patterns
├── gbrain/CLAUDE.md       # GBrain ingest, search, memory patterns
├── skills/CLAUDE.md       # Skill authoring rules + trust gate
├── brain/CLAUDE.md        # Brain content structure + writing conventions
└── discord/CLAUDE.md      # Channel purposes + message routing
```

## Agent Model Routing

| Task Type | Model | Tier |
|-----------|-------|------|
| Internal triage, formatting, parsing, classification | phi4-mini (Ollama) | 0 |
| Research, task planning, data analysis, mid-complexity | GPT-4o-mini (OpenAI direct) | 1 |
| ALL outbound writing, reasoning, code review | Claude Sonnet 4.6 | 2 |
| Orchestration, architecture decisions, high-stakes planning | Claude Opus 4.8 | 3 |

**QUALITY FIREWALL:** Any text another human reads → Tier 2+ → explicit approval always.

## Key Entry Points

| What | Where |
|------|-------|
| Hermes runtime config | `~/.hermes/config.yaml` |
| GBrain config | `~/.gbrain/config.json` |
| Starting skills | `skills/*.yaml` |
| Brain repo | `~/brain/` |
| GBrain MCP server | `gbrain serve` |
| All API keys | `~/.config/dhruvaos/.env` (chmod 600) |
| Discord channel map | `discord/channels.md` |

## Security Non-Negotiables

1. Hermes runs as `dhruvaos` non-root user
2. All API keys in `~/.config/dhruvaos/.env` (chmod 600, never committed)
3. Discord allowlist: only Dhruva's Discord user ID
4. YOLO mode disabled
5. Outbound text ALWAYS Tier 2+ AND explicit approval — no override

## Testing Standard

- Skill tests: `pytest ~/.hermes/skills/<skill>/tests/ --mock-tools`
- Brain health: `gbrain onboard --check --json`
- Quality firewall: end-to-end test before any outbound skill enabled

## Agent-Driven Development Workflow

1. Decompose into 15-minute units
2. Dispatch to fresh implementer subagent
3. Spec review: verify code matches requirements
4. Quality review: verify clean, tested, maintainable
5. Commit per task

Parallel: independent skill files only. Sequential: GBrain DB, Hermes config.yaml.

## Common Task Patterns

### Adding a new Hermes skill
1. Copy YAML template from `skills/`
2. Set frontmatter: tier, outbound, requires_approval, gbrain fields
3. Write implementation + tests
4. Run `pytest --mock-tools` → must pass
5. If outbound: verify quality firewall fires

### Ingesting content into GBrain
```bash
gbrain import <path> --no-embed && gbrain embed --stale
gbrain onboard --check --json
```

## gstack + Superpowers Workflow

| Phase | Tools |
|-------|-------|
| IDEATION | /office-hours |
| PLANNING | /autoplan → writing-plans |
| IMPLEMENT | subagent-driven-development + using-git-worktrees |
| REVIEW | /review → /qa → /cso |
| RELEASE | /ship → /land-and-deploy → /canary |
| REFLECT | /retro → /learn → context-save |

## Environment Setup

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | Tier 1 — direct OpenAI credits |
| `ANTHROPIC_API_KEY` | Yes | Tier 2 + Tier 3 |
| `OPENROUTER_API_KEY` | No | Tier 1 fallback post-credits |
| `DISCORD_BOT_TOKEN` | Yes | Hermes Discord gateway |
| `DISCORD_ALLOWED_USER` | Yes | Dhruva's Discord user ID |
| `BROWSERBASE_API_KEY` | No | Cloud browser |
| `EXA_API_KEY` | No | Web search |
| `FIRECRAWL_API_KEY` | No | Web extraction |

---

## Codex Agent Stubs

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
description = "Verify implementation is clean, tested, maintainable — check skill YAML + tests"
model = "codex-1"
context = ["SKILLS.md", "CLAUDE.md"]

[agents.gbrain-ops]
description = "Run GBrain ingest, embed, or dream operations — sequential only"
model = "codex-1"
context = ["MEMORY.md"]
sequential = true  # never run in parallel with other gbrain-ops agents
```

---

## Skill Catalog

| Trigger | Skill | Phase |
|---------|-------|-------|
| New feature idea | /office-hours | Ideation |
| Starting feature | /autoplan + writing-plans | Planning |
| Multi-file work | subagent-driven-development | Implement |
| Parallel skill builds | using-git-worktrees | Implement |
| Pre-commit | /review + /qa | Review |
| Security check | /cso | Review |
| Shipping | /ship → /land-and-deploy | Release |
| Post-deploy | /canary | Release |
| Weekly | /retro + /learn | Reflect |
| Novel task (Hermes) | self-authored skill | Runtime |
| Behavioral correction | correction-handler skill | Runtime |
| Morning brief | morning-briefing skill (8am) | Runtime |
| Evening brief | evening-briefing skill (9pm) | Runtime |
| Inbox | email-triage skill | Runtime |
| Research | research-synthesis skill | Runtime |
| Tasks | task-prioritization skill | Runtime |
