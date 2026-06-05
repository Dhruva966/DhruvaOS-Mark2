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
║                              ║   ║  Browserbase (cloud browser)    ║
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

## Three-Layer Browser Stack (ADR-010)

Every Hermes skill that touches the web routes through one of three layers based on cost and complexity.
Rule: **never pass raw HTML to a Tier 2+ model.** Always extract structured data first.

```
Task needs web content
        │
        ├── Auth-required / CAPTCHA / stealth / LinkedIn?
        │       └── Browserbase (cloud, $0.12/hr)
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
| Cloud browser | Browserbase | Production, YC W24 | $20/mo (Developer) | LinkedIn, Gmail web, auth-walled sites, CAPTCHA |

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
should include a `retry_with_browserbase: true` fallback flag for critical tasks.
Non-critical tasks (research scraping, monitoring) can simply log and retry next run.

### Browserbase — Developer plan ($20/mo) scope

100 browser hours/month. A typical LinkedIn post draft + review takes ~5 minutes = 12 posts/hr.
At $20/mo, comfortable for personal use. Upgrade to Startup ($99/mo) only if Phase 5 skills
run daily heavy automation.

---

## Local Model Evolution (research context, June 2026)

### Tier 0 candidates (language)

| Model | VRAM | Speed | Fit |
|-------|------|-------|-----|
| phi4-mini (current) | ~2.4GB GPU | 15–25 tok/s GTX 1660 Ti | Good |
| BitNet b1.58 3B (1-bit) | 0 GPU (CPU) | ~10–20 tok/s CPU | Fallback if VRAM tight |

### Voice models (Phase 6)

| Model | Task | VRAM | Cost | Notes |
|-------|------|------|------|-------|
| Parakeet-TDT-1.1B | STT | ~1.5GB GPU (CPU fallback) | $0 | NVIDIA open-source, near real-time, <4% WER |
| Piper | TTS | 0 (CPU only) | $0 | <200ms latency, multiple voice models |
| Silero VAD | Silence detection | 0 (CPU) | $0 | 10s silence timeout for auto-off |
| Custom clap detector | Wake trigger | 0 (CPU) | $0 | Two claps within 1s window, pyaudio |

**VRAM budget with voice active (sequential, not simultaneous):**
- STT phase: Parakeet ~1.5GB + system ~0.5GB = 2GB used
- LLM phase: phi4-mini ~2.4GB + system ~0.5GB = 3GB used
- TTS phase: Piper on CPU = 0 GPU VRAM
- Peak: ~3GB, well within 6GB GTX 1660 Ti limit

Switch to 1-bit CPU model if `nvidia-smi` shows phi4-mini causing contention with other GPU workloads. Triage/classification tolerates CPU latency; user never waits on Tier 0 directly.

### Phase 6 audio/vision model options

| Approach | VRAM | Complexity | When |
|----------|------|------------|------|
| faster-whisper + phi4-mini | ~2GB | Two models, two pipelines | Current Phase 6 plan |
| Encoder-free model (e.g. Gemma 4 12B local) | 12–16GB | Single model, one pipeline | When GPU ≥12GB |
| Encoder-free model via API | 0 local | Single API call | If staying on GTX 1660 Ti |

**Encoder-free architecture insight (Gemma 4 12B, June 2026):** removes separate audio/vision encoders. Raw 40ms audio frames projected directly into LLM token space. LLM processes multimodal input from start — no encoder queue latency. Architecturally superior to whisper+LLM for Phase 6 if VRAM allows or API cost acceptable.

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
0 3 * * *  gbrain dream
```
Note: `gbrain sync` does not exist. Use `gbrain embed --stale` for incremental embedding.

**Compounding effect over time:**
- Week 1: raw import, search works
- Week 4: entity graph starts connecting, trajectory tracking active
- Month 3: gap analysis surfaces knowledge blind spots
- Month 12: full trajectory view of goals, relationships, projects

---

## Interface Layer

DhruvaOS uses three interfaces with distinct roles:

| Interface | Direction | Use Case |
|-----------|-----------|----------|
| **iMessage** | Bidirectional | Quick one-liner commands: `"add task X"`, `"whats on my cal"`. Fast, always-open on iPhone. |
| **Discord** | Bidirectional | Full outputs: briefings, research results, task lists, outbound approval gate. |
| **ntfy.sh push** | Agent → iPhone | Proactive alerts: reminders, time-sensitive notifications to lock screen. |

### iMessage Integration — BlueBubbles + Hermes

iMessage has no public API. BlueBubbles (open-source, free) runs on Mac as an iMessage bridge,
exposing a REST API + webhooks. Hermes has BlueBubbles built in.

```
iPhone → iMessage → Mac Messages.app → BlueBubbles Server (port 1234)
   ↕ REST + webhooks ↕
Hermes (Omen) — BLUEBUBBLES_SERVER_URL + BLUEBUBBLES_PASSWORD in .env
                 hermes gateway setup (one command, auto-configures)
```

**Mac setup (one time):**
1. Install BlueBubbles Server `.dmg` on Mac
2. Grant Full Disk Access + Automation → Messages in System Settings
3. Set a password in BlueBubbles UI
4. Configure Cloudflare Tunnel in BlueBubbles → stable `https://imessage.yourdomain.com` URL
5. `sudo pmset -a sleep 0` — keep Mac awake as bridge

**Omen .env additions (Phase 1):**
```bash
BLUEBUBBLES_SERVER_URL=https://imessage.yourdomain.com
BLUEBUBBLES_PASSWORD=your-password
NTFY_TOPIC=dhruva-alerts   # for push notifications
```

**Proactive alerts (ntfy.sh self-hosted on Omen):**
```bash
# Any Hermes skill can push to iPhone:
curl -d "Reminder: standup in 10 min" https://ntfy.yourdomain.com/dhruva-alerts
```
ntfy iPhone app subscribes to the topic. Instant lock screen push via ntfy upstream relay.

**SIP disable: NOT required** for text send/receive. SIP only needed for tapbacks/typing
indicators — irrelevant for a command bot.

**Account ban risk:** Near-zero for personal single-user use. Apple bans high-volume
spam bots, not personal assistants on years-old Apple IDs.

### Notion — Visual Dashboard (display only)

Notion is a **visual display layer** — browsable tables and dashboards Dhruva accesses from any device. NOT the brain, NOT the search engine. GBrain + `~/brain/` markdown is the source of truth for all knowledge. Notion gets a mirror of structured data (tasks, briefings, people) written by Hermes skills at execution time.

**Architecture:** Hermes writes directly to Notion via MCP at skill execution time. No sync daemon. No polling. Event-driven: a skill completes → writes to Notion as a final step.

**4 core databases:**

| Database | Key properties | Written by |
|----------|---------------|-----------|
| Tasks | Name, Status, Priority, Due, Project (relation) | add-task, task-prioritization |
| Projects | Name, Status, Area, Tasks (rollup), Notes URL | manual + research-synthesis |
| People | Name, Company (relation), Role, Last Contact, Brain File URL | manual + signal-detector |
| Daily Briefings | Date, Type, Summary, Discord Link, Full body | morning-briefing, evening-briefing |

**Discord + Notion together:** briefings post to Discord #briefings AND create a Notion page. Discord message includes the Notion URL. Discord = fast delivery + approval gate. Notion = persistent, searchable, visual archive.

**What Notion cannot do:**
- Graph view (people → companies → projects): use **Obsidian graph view** on `~/brain/` — already works once GBrain imports the vault
- Real-time / semantic search: GBrain handles that. Notion is for browsing, not querying.
- Bidirectional sync: Notion is write-once per skill run. Never a write source back into GBrain.

**Graph views:** Obsidian (free, local) renders `~/brain/` as a full entity graph. GBrain's dream cycle auto-links the nodes. No additional tool needed.

**Config additions to `.env`:**
```bash
NOTION_TASKS_DB=<database-id>
NOTION_PROJECTS_DB=<database-id>
NOTION_PEOPLE_DB=<database-id>
NOTION_BRIEFINGS_DB=<database-id>
```

**MCP:** Notion MCP already connected (`mcp__claude_ai_Notion__*`). Add to Hermes `mcp_servers:` config in Phase 2.

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
