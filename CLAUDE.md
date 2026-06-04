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
| Tier 0 model | phi4-mini via Ollama (local, GTX 1660 Ti, 2.5 GB VRAM) |
| Tier 1 model | GPT-4o-mini (direct OpenAI API — burns platform.openai.com credits) |
| Tier 2 model | Claude Sonnet 4.6 (Anthropic — ALL outbound writing) |
| Tier 3 model | Claude Opus 4.8 (Anthropic — orchestration + high-stakes) |
| Process management | PM2 (initial) → systemd (production) |
| Remote access | Cloudflare Tunnel (dorm CGNAT bypass) |
| Host | HP Omen 15 — 32 GB RAM, GTX 1660 Ti 6 GB, Ubuntu |

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
├── BUILD_PLAN.md          # Phased rollout, parallel task decomposition
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
│   ├── morning-briefing.yaml
│   ├── evening-briefing.yaml
│   ├── email-triage.yaml
│   ├── task-prioritization.yaml
│   ├── research-synthesis.yaml
│   ├── correction-handler.yaml
│   └── charlie-monitoring.yaml  # STUB
├── brain/                 # Symlink → ~/brain/ (markdown knowledge base)
│   └── CLAUDE.md          # Brain content structure + writing conventions
├── discord/
│   ├── CLAUDE.md          # Channel purposes + message routing
│   └── channels.md        # Channel definitions
├── references/            # Fetched official docs (Hermes, GBrain, OpenRouter)
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

## Key Entry Points

| What | Where |
|------|-------|
| Hermes runtime config | `~/.hermes/config.yaml` |
| GBrain config | `~/.gbrain/config.json` |
| Starting skills | `skills/*.yaml` (seeded to `~/.hermes/skills/`) |
| Brain repo | `~/brain/` |
| GBrain MCP server | `gbrain serve` (stdio) or `gbrain serve --http --port 3131` |
| All API keys | `~/.config/dhruvaos/.env` (chmod 600, never committed) |
| Discord channel map | `discord/channels.md` |
| Process list | `pm2 list` or `~/.pm2/` |
| GBrain health | `gbrain onboard --check --json` |
| Dream cycle | `gbrain dream` (cron at 3am) |

## Database Schema

GBrain owns the schema via PGLite (embedded Postgres + pgvector). Do not interact with it
directly. All reads/writes go through `gbrain search`, `gbrain think`, or MCP tool calls.

Brain content lives in `~/brain/` as markdown. GBrain ingests it via `gbrain import`.

Schema migrations are handled automatically by `gbrain upgrade` + `gbrain apply-migrations --yes`.

## Security Non-Negotiables

1. Hermes runs as `dhruvaos` non-root user — never root
2. All API keys in `~/.config/dhruvaos/.env` (chmod 600, never committed to git)
3. Discord allowlist: only Dhruva's Discord user ID can issue commands
4. YOLO mode disabled — `require_approval_always: true` in config.yaml, always
5. Outbound text ALWAYS Tier 2+ AND requires explicit Discord approval — no cost override, ever

## Testing Standard

- Skill tests: `pytest ~/.hermes/skills/<skill>/tests/ --mock-tools`
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

## Common Task Patterns

### Adding a new Hermes skill
1. Copy skill YAML template from `skills/` into `~/.hermes/skills/<name>.yaml`
2. Set frontmatter: `tier`, `outbound`, `requires_approval`, `gbrain.reads`, `gbrain.writes`
3. Write implementation steps in YAML body
4. Write tests in `~/.hermes/skills/<name>/tests/test_basic.py` (mock all tools)
5. Run `pytest ~/.hermes/skills/<name>/tests/ --mock-tools` — must pass
6. If `outbound: true` — verify quality firewall fires before approval
7. Seed into Hermes: restart or `hermes skill reload`

### Ingesting new content into GBrain
```bash
gbrain import ~/path/to/content --no-embed
gbrain embed --stale
gbrain onboard --check --json    # verify health
```

### Debugging model routing
1. Check `tier` and `outbound` fields in skill YAML
2. Check `~/.hermes/config.yaml` — verify provider + model for that tier
3. Check Hermes logs for escalation events
4. If escalation rate >30%/week → promote skill to next tier permanently

### Running the dream cycle manually
```bash
gbrain dream
# Check output for consolidation summary
```

### Reviewing an agent-authored skill
1. Hermes writes skill to `~/.hermes/skills/<name>.yaml`
2. Quality gate runs automatically (tests must pass)
3. For write/shell skills: Discord DM arrives with code preview
4. Review: check tier assignment, outbound flag, shell commands
5. Approve via `/approve <skill>` in Discord DM or deny via `/deny <skill>`

## gstack + Superpowers Workflow

| Phase | Tools |
|-------|-------|
| 1 IDEATION | /office-hours |
| 2 PLANNING | /autoplan → writing-plans → blueprint |
| 3 IMPLEMENT | subagent-driven-development + using-git-worktrees |
| 4 REVIEW | /review → /qa → /cso → /health |
| 5 RELEASE | /ship → /land-and-deploy → /canary |
| 6 REFLECT | /retro → /learn → context-save |

## Environment Setup

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | Tier 1 — burns platform.openai.com credits directly |
| `ANTHROPIC_API_KEY` | Yes | Tier 2 (Sonnet 4.6) + Tier 3 (Opus 4.8) |
| `OPENROUTER_API_KEY` | No (post-credits fallback) | Tier 1 when OpenAI credits < $50 |
| `DISCORD_BOT_TOKEN` | Yes | Hermes Discord gateway |
| `DISCORD_ALLOWED_USER` | Yes | Dhruva's Discord user ID (allowlist — only user who can command) |
| `BROWSERBASE_API_KEY` | Phase 5 | Cloud browser — LinkedIn, auth-walled sites (Developer plan $20/mo) |
| `BROWSERBASE_PROJECT_ID` | Phase 5 | Browserbase project ID (pair with API key) |
| `AGENTQL_API_KEY` | Phase 3 | Structured extraction — prevents raw HTML reaching Sonnet ($0.02/call) |
| `EXA_API_KEY` | No | Web search tool |
| `FIRECRAWL_API_KEY` | No | Web content extraction (may be replaced by AgentQL) |
