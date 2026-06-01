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
║  HERMES AGENT  (Python 3.11+, ~/.hermes/)                        ║
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
║  ┌──────────────────────────┐ ║   ║    RTX 2060, 2.5 GB VRAM        ║
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
║  │  temporal + entity graph ║   ║  Firecrawl (extraction)         ║
║  └──────────────────────────┘ ║   ║  Browserbase (cloud browser)    ║
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

## Mark 1 → Mark 2 Component Mapping

| Mark 1 Component | Mark 2 Replacement | Type |
|-----------------|-------------------|------|
| Custom Python orchestrator (FastAPI, 12 endpoints) | Hermes Agent runtime | Hermes built-in |
| Mem0 biographical memory | GBrain PGLite + `~/brain/` | GBrain feature |
| Qdrant vector store | GBrain pgvector (PGLite/HNSW) | GBrain feature |
| Graphify knowledge graph | GBrain auto-link + entity graph | GBrain feature |
| DreamWorker (weekly manifest) | GBrain dream cycle (nightly) | GBrain feature |
| MaintenanceWorker | GBrain dream cycle | GBrain feature |
| ReviewerAgent | Hermes skill quality gate | Hermes built-in |
| DebateAgent | Hermes subagent delegation (max 3, depth 2) | Hermes built-in |
| 10-worker fleet | 8 starting Hermes skills (extensible) | Custom skills |
| FastAPI internal API | Hermes MCP + `gbrain serve` | Hermes+GBrain built-in |
| 8-tier model routing | 4-tier routing in config.yaml | Custom config |
| Discord interface | Hermes Discord gateway | Hermes built-in |
| Quality firewall + approval gate | Hermes approval + skill `outbound` metadata | Custom config |
| Self-healing correction loop | `correction-handler` skill + GBrain write | Custom skill |
| Charlie's Cleaners monitoring | `charlie-monitoring` stub | Future skill (not yet) |
| Phase 6 TTS (Piper) | Future Phase 6 | Out of scope |
| Phase 6 STT (faster-whisper) | Future Phase 6 | Out of scope |
| Phase 6 iPhone geofencing | Future Phase 6 | Out of scope |

**What's dropped permanently:** Qdrant standalone service, Mem0 library, Graphify library,
FastAPI app, custom orchestrator Python codebase, separate MaintenanceWorker cron script.

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
Hermes writes ~/.hermes/skills/<task-name>.yaml
  - frontmatter: tier, outbound, requires_approval, gbrain.reads/writes
  - body: step-by-step implementation
  - tests: ~/.hermes/skills/<task-name>/tests/test_basic.py
         │
         ▼
Quality gate runs automatically
  pytest tests/ --mock-tools
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
- Monitor OpenAI platform balance via dashboard
- When balance drops below $50 → disable `openai_direct` provider in config.yaml
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
0 2 * * *  gbrain sync --repo ~/brain && gbrain embed --stale
0 3 * * *  gbrain dream
```

**Compounding effect over time:**
- Week 1: raw import, search works
- Week 4: entity graph starts connecting, trajectory tracking active
- Month 3: gap analysis surfaces knowledge blind spots
- Month 12: full trajectory view of goals, relationships, projects

---

## Discord Channel Architecture

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
