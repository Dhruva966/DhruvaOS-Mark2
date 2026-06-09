# DhruvaOS Mark 2 — Architecture

## System Layer Diagram

```
╔══════════════════════════════════════════════════════════════════╗
║  DISCORD (interface layer)                                       ║
║  #briefings  #tasks  #research  #alerts  #charlie  #corrections ║
╚══════════════════╦═══════════════════════════════════════════════╝
                   ║ inbound messages / commands
                   ▼
╔══════════════════════════════════════════════════════════════════╗
║  HERMES AGENT  (Python 3.12, Ubuntu 24.04, ~/.hermes/)                        ║
║                                                                  ║
║  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  ║
║  │  Skill Router   │  │  4-Tier Model    │  │  APScheduler   │  ║
║  │  YAML dispatch  │  │  Router +        │  │  morning 8am   │  ║
║  │  ~40 built-ins  │  │  Quality         │  │  evening 9pm   │  ║
║  │  + custom skills│  │  Firewall        │  │  cron skills   │  ║
║  └────────┬────────┘  └──────────────────┘  └────────────────┘  ║
║           │                                                      ║
║  ┌────────▼────────┐  ┌──────────────────┐                       ║
║  │  Subagent Pool  │  │  MCP Client      │──────────────────┐   ║
║  │  max 3 / depth 2│  │  (stdio or HTTP) │                  │   ║
║  └─────────────────┘  └──────────────────┘                  │   ║
╚══════════════════════════════════════════════════════════════╪═══╝
                                                               │
                   ┌───────────────────────────────────────────┘
                   ▼
╔══════════════════════════════╗   ╔══════════════════════════════════╗
║  GBRAIN MCP SERVER            ║   ║  EXTERNAL TOOLS                  ║
║  (Bun 1.x, HTTP mode :3131)   ║   ║                                  ║
║                              ║   ║  Ollama → phi4-mini (Tier 0)     ║
║  ┌──────────────────────────┐ ║   ║    GTX 1660 Ti, ~2.5 GB VRAM    ║
║  │  PGLite                  │ ║   ║                                  ║
║  │  pgvector + FTS + RRF    │ ║   ║  OpenAI API → gpt-4o-mini (T1)  ║
║  │  HNSW cosine similarity  │ ║   ║    direct OPENAI_API_KEY         ║
║  └──────────────────────────┘ ║   ║    burns platform credits        ║
║                              ║   ║                                  ║
║  ┌──────────────────────────┐ ║   ║  Anthropic → Sonnet 4.6 (T2)   ║
║  │  Search                  │ ║   ║              Opus 4.8 (T3)     ║
║  │  hybrid retrieval+synth  │ ║   ║                                  ║
║  └──────────────────────────┘ ║   ║  OpenRouter (Tier 1 fallback)   ║
║                              ║   ║    DeepSeek V3 post-credits      ║
║  ┌──────────────────────────┐ ║   ║                                  ║
║  │  Think                   │ ║   ║  Exa (web search)               ║
║  │  temporal + entity graph ║   ║  Exa contents (active research)   ║
║  └──────────────────────────┘ ║   ║  Lightpanda (local browser)     ║
║                              ║   ║  Playwright local (auth sites)  ║
║                              ║   ║  Calendar / Email / GitHub MCP   ║
║  ┌──────────────────────────┐ ║   ╚══════════════════════════════════╝
║  │  Dream Cycle             │ ║
║  │  nightly 3am             │ ║
║  │  8-phase consolidation   │ ║
║  └──────────────────────────┘ ║
║                              ║
║  43 Bundled Skills           ║
╚══════════════════╦═══════════╝
                   ║ reads / writes
                   ▼
╔══════════════════════════════════════════════════════════════════╗
║  ~/brain/  (markdown knowledge base)                             ║
║  people/  companies/  concepts/  projects/  UCLA/  goals/        ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Browser Stack (ADR-010 — updated 2026-06-07)

> **Browserbase permanently dropped 2026-06-07.** Replaced by local Playwright (headless Chromium)
> on Omen. Omen is always-on, so the cloud browser's main benefit (run when machine is off) doesn't
> apply, and this avoids the $20/month Developer plan cost.
> `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` are no longer required anywhere.

Every Hermes skill that touches the web routes through one of two active layers. Rule: **never pass
raw HTML to a Tier 2+ model.** Always extract structured data first.

```
Task needs web content
        │
        ├── Auth-required / LinkedIn / cookie-gated?
        │       └── Local Playwright on Omen (headless Chromium)
        │               Uses ~/.hermes/linkedin_cookies.json for session
        │
        ├── Local page fetch / monitoring / scraping (no auth needed)?
        │       └── Lightpanda (local, $0, 9x faster than Chrome, 16x less RAM)
        │
        └── Either browser → page loaded
                └── Extract clean text/structured data
                        └── Returns compact context → Sonnet
                            NOT raw HTML (30k tokens) → Sonnet
```

### Why each layer

| Layer | Tool | Status | Cost | Use cases |
|---|---|---|---|---|
| Local browser | Lightpanda | Beta (stable enough for scraping) | $0 | Research scraping, Charlie monitoring, health checks |
| Search + article extraction | Exa contents | Active | API usage | Research synthesis and current-source lookups |
| Structured extraction | AgentQL | Optional future | ~$0.02/call | Complex product pages, dashboards, forms |
| Auth-required automation | Local Playwright (Chromium) | Active | $0 | LinkedIn, cookie-gated sites on Omen |

### Token math — why extraction pays for itself

Without extraction: 5 article pages → Sonnet = 5 × 30k tokens × $3/1M = **$0.45 per research run**.
With extracted content: the model sees compact, relevant context instead of raw HTML. Phase 3 uses
Exa native contents for this; add a structured extractor only when a skill needs dashboard/form data.

### Lightpanda — Hermes native support

Lightpanda is an officially supported browser backend in Hermes Agent (Nous Research).
No custom integration needed — set in Hermes config:
```yaml
browser:
  backend: lightpanda
  endpoint: "ws://localhost:9222"
```

Start Lightpanda alongside Hermes under PM2:
```bash
pm2 start "lightpanda --host 127.0.0.1 --port 9222" --name lightpanda
```

**Beta caveat:** Lightpanda can crash on sites with unusual JS patterns. Skills that use it
should include a retry path (e.g., skip and log) for non-critical tasks.
Critical Phase 5 outbound skills use local Playwright, not Lightpanda.

---

## Local Model Evolution

**VRAM budget with voice active (sequential, not simultaneous):**
- STT phase: Parakeet ~1.5GB + system ~0.5GB = 2GB used
- LLM phase: phi4-mini ~2.4GB + system ~0.5GB = 3GB used
- TTS phase: Piper on CPU = 0 GPU VRAM
- Peak: ~3GB, well within 6GB GTX 1660 Ti limit

---

## Self-Improving Skill Loop

```
Hermes encounters a novel task
         │
         ▼
Uses built-in tools to solve it
(browser, search, shell, calendar, etc.)
         │
         ▼
Task succeeds
         │
         ▼
Hermes writes ~/.hermes/skills/dhruvaos/<task-name>/SKILL.md
  - frontmatter: tier, outbound, requires_approval, gbrain.reads/writes
  - body: step-by-step implementation
  - tests: ~/.hermes/skills/<task-name>/tests/test_basic.py
         │
         ▼
Quality gate runs
  repo-local contract tests
  → must pass before promotion
         │
         ▼
Trust gate check
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼                             ▼
outbound: false               outbound: true OR
AND no shell                  shell commands present
    │                             │
    ▼                             ▼
Auto-promoted to trusted    Discord DM to Dhruva
Runs autonomously next      with code preview
time                             │
                                 ▼
                         Dhruva approves
                         /approve <skill>
                                 │
                                 ▼
                         Promoted to trusted
```

Refinement: each run logs outcome. If skill fails, Hermes patches and re-gates.
Skills escalating >30%/week get permanently promoted to next tier.

---

## 4-Tier Model Routing + Quality Firewall

| Tier | Model | Provider | Input Cost | Use Cases | Outbound? |
|------|-------|----------|-----------|-----------|-----------|
| 0 | phi4-mini | Ollama (local) | $0 | Triage, formatting, parsing, classification — internal only | Never |
| 1 | gpt-4o-mini-2024-07-18 | OpenAI direct | $0.15/1M | Research, planning, data analysis | Never |
| 1 fallback | deepseek-v3 | OpenRouter | $0.23/1M | Same as Tier 1 when OpenAI credits < $50 | Never |
| 2 | claude-sonnet-4-6 | Anthropic | $3/1M | ALL outbound writing, reasoning, code review | Yes — requires approval |
| 3 | claude-opus-4-8 | Anthropic | $15/1M | Orchestration, architecture, high-stakes decisions | Yes — requires approval |

**Quality Firewall Rule (non-negotiable):**
```
if skill.metadata.outbound == true:
    assert model_tier >= 2              # enforced by Hermes routing
    send_preview(channel="#corrections")
    block_until_approval()             # thumbs-up reaction OR /approve
    log_approval(timestamp, user_id)
```

No skill may bypass this. No cost consideration overrides it. One bad LinkedIn post or
email costs more than years of Sonnet premium.

**Escalation logic:**
- Tier 0 reasoning failure → auto-bump to Tier 1 for that run
- Tier 1 tool failure → retry once, then bump to Tier 2
- Skill escalation rate >30% over 7 days → permanently promote in config.yaml

**Tier 1 credit watchdog:**
- OpenAI has no programmatic balance API — `check_balance_daily` in config.yaml is aspirational only; it will silently no-op
- Set a monthly calendar reminder to check https://platform.openai.com/usage manually
- Configure an OpenAI usage alert via dashboard (Settings → Billing → Usage limits) for $50 threshold
- When balance drops below $50 → manually set `tier_1.active_backend: "fallback"` in config.yaml
- Enable `openrouter` provider for Tier 1 (own billing, separate account)
- Update `tier_1.primary` to DeepSeek V3 via OpenRouter

---

## GBrain Dream Cycle — Replaces Mark 1's DreamWorker + MaintenanceWorker

Mark 1 planned custom Python scripts for weekly memory consolidation. Mark 2 uses GBrain's
built-in 8-phase nightly dream cycle.

**What `gbrain dream` does (8 phases):**
1. Entity sweep — ensure all entities have canonical files in `~/brain/`
2. Citation fixes — repair broken backlinks between brain files
3. Memory consolidation — merge redundant notes, dedup facts
4. Conversation synthesis — compress recent Discord conversations into brain nodes
5. Cross-session pattern detection — surfaces recurring themes across conversations
6. Timeline backfill — auto-date events and entity appearances
7. Auto-link creation — typed links between entities (person→company, concept→concept)
8. Gap analysis — identifies what Dhruva knows but hasn't documented

**Cron schedule:**
```
0 2 * * *  gbrain embed --stale
0 3 * * *  gbrain dream --dir ~/brain
```
Note: `gbrain sync --repo <path>` sets the `local_path` for the brain sync dream phase (not an import command).
Use `gbrain embed --stale` for incremental embedding between dream cycles.

**Compounding effect over time:**
- Week 1: raw import, search works
- Week 4: entity graph starts connecting, trajectory tracking active
- Month 3: gap analysis surfaces knowledge blind spots
- Month 12: full trajectory view of goals, relationships, projects

---

## Interface Layer

DhruvaOS uses these interfaces:

| Interface | Direction | Use Case |
|-----------|-----------|----------|
| **Discord** | Bidirectional | Full outputs: briefings, research results, task lists, outbound approval gate. |
| **ntfy.sh push** | Agent → iPhone | Proactive alerts: reminders, time-sensitive notifications to lock screen. |
| **drew-ui** | Mac web UI | Voice interface to Hermes. Deployed at `drew-ui/`. Protected by single-password auth. Hermes WebSocket integration is Phase 2 TODO — currently shows mock responses. |
| **jarvis-voice** | Mac web UI | 3D neural brain screensaver with real-time audio visualization. Connects to Gojo backend (port 3020) via SSE for task state. Built: `jarvis-voice/` (Three.js via React Three Fiber). Deployed to Vercel and proxied via drew-ui at `/jarvis/*`. |
| **iMessage/BlueBubbles** | Bidirectional | ⬜ Phase 6b — see BUILD_PLAN.md |

Notion MCP connected (4 DBs: Tasks, Projects, People, Briefings). Hermes writes at skill execution time. See HANDOFF.md for DB IDs.

### Discord Channel Architecture

| Channel | Purpose | Who Writes | Hermes Reads |
|---------|---------|-----------|-------------|
| `#briefings` | Morning/evening briefings, proactive updates | Hermes | Commands, acks |
| `#tasks` | Task list, prioritization, status updates | Hermes + Dhruva | Task commands |
| `#research` | Research synthesis outputs | Hermes | Research requests |
| `#alerts` | Urgent notifications, escalations | Hermes | — |
| `#charlie` | Charlie's Cleaners monitoring (stub) | Hermes (future) | — |
| `#corrections` | Outbound approval gate, correction input | Dhruva | All outbound previews |

`#corrections` is the most critical channel: every outbound message preview appears here
before Hermes is allowed to send it. Dhruva reacts with 👍 to approve or types `/deny`.
