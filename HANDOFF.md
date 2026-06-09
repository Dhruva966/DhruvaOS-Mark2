# DhruvaOS Mark 2 — Handoff

Defines data contracts and integration points between DhruvaOS subsystems.
Read before building any skill that crosses a subsystem boundary.

---

## Subsystem Boundaries

```
┌─────────────────┐   MCP (HTTP :3131)  ┌─────────────────┐
│  Hermes Agent   │ ◄─────────────────► │  GBrain         │
│  Python 3.11+   │                     │  Bun 1.x        │
└────────┬────────┘                     └────────┬────────┘
         │                                      │
         │ Discord API      HTTP :8081          │ reads/writes
         ▼                  ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Discord        │  │  XPosterOS      │  │  ~/brain/        │
│  6 channels     │  │  FastAPI+Notion │  │  markdown files  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         ▲
         │ /api/drew/* + /api/voice/*
         │ (exec CLI on Omen, proxy AI APIs)
┌─────────────────────────────────────────────────────────────┐
│  DrewUI  (Next.js 16, port 3000 on Omen via PM2 + Vercel cloud) │
│  dhruvavutukury.org → served by Vercel (NOT Cloudflare Tunnel)  │
│  • Dashboard: status, crons, memory, activity               │
│  • Voice: Whisper STT → Claude Sonnet 4.6 → ElevenLabs TTS  │
│  • Conversation history (in-session)                        │
│  • Screensaver: /jarvis 3D neural brain (Vercel)            │
└─────────────────────────────────────────────────────────────┘
```

---

## Hermes ↔ GBrain: MCP Contract

### Connection
- Protocol: MCP via HTTP — PM2 command: `bash -c "/home/dhruva/.bun/bin/gbrain serve --http --port 3131 --enable-dcr --token-ttl 7776000"` (DCR + 90-day token TTL)
- Auth: OAuth 2.1 Bearer token. Hermes sends `Authorization: Bearer ${MCP_GBRAIN_API_KEY}` (set in `~/.hermes/.env`). Token expires ~Sept 5 2026. Auto-refresh cron runs every 60 days via `~/.hermes/scripts/refresh-gbrain-token.sh`. Client credentials in `~/.hermes/.env` as `GBRAIN_MCP_CLIENT_ID` + `GBRAIN_MCP_CLIENT_SECRET`.
- Alternative: MCP via stdio (`gbrain serve`) — for local ad-hoc testing only; incompatible with PM2
- Both services must be running: `systemctl --user status hermes-gateway` is active and `pm2 list` shows `gbrain-mcp`

### GBrain operations Hermes calls

| Operation | When | Returns |
|-----------|------|---------|
| `search(query)` | Before any response using external facts | Chunks + synthesized answer + citations |
| `think(query)` | For trajectory/temporal queries | Entity timeline + anomaly flags |
| `ingest(content, path)` | When writing new knowledge to brain | Confirmation |
| `embed(path)` | After ingesting files | Embedding job status |
| `dream()` | Nightly cron, never from active skill | Dream cycle summary |

### Data format: Hermes → GBrain writes

All skill writes to `~/brain/` must follow this format:
```markdown
---
title: "<Title>"
date: "<YYYY-MM-DD>"
tags: ["<tag1>", "<tag2>"]
source: "<skill-name>"
---

# <Title>

<content>
```

Frontmatter is required for GBrain to auto-link and index correctly.

### Data format: GBrain search → Hermes response

GBrain returns:
```json
{
  "answer": "<synthesized answer>",
  "chunks": [{"text": "...", "source": "path/in/brain", "score": 0.87}],
  "citations": ["brain/people/alice.md", "..."],
  "gaps": ["<what's missing from the brain on this topic>"]
}
```

Hermes should include citations when responding to Dhruva if `chunks` is non-empty.

---

## Hermes ↔ Discord: Event Contract

### Inbound (Discord → Hermes)

| Event | Channel | Trigger | Hermes action |
|-------|---------|---------|--------------|
| Message with `/` prefix | any | command | Route to skill dispatcher |
| Message without `/` | #briefings | conversation | Respond conversationally |
| 👍 reaction to Hermes message | #corrections | approval | Execute queued outbound action only if approval_id, content hash, expiry, and approver ID all match |
| `/deny <id>` message | #corrections | rejection | Discard queued outbound action, log |
| `/correct <text>` | #corrections | correction | Run correction-handler skill |
| `/approve <skill>` DM | DM | skill approval | Promote skill to trusted |
| `/deny <skill>` DM | DM | skill rejection | Delete skill, log reason |

### Outbound (Hermes → Discord)

| Channel | Content type | Trigger |
|---------|-------------|---------|
| `#briefings` | Daily briefing, ad-hoc updates | APScheduler or direct query |
| `#tasks` | Task list, prioritization updates | Task commands or morning briefing |
| `#research` | Research synthesis | /research command |
| `#alerts` | Urgent notifications, credit watchdog | Triggered events |
| `#charlie` | Charlie's Cleaners (stub) | Future |
| `#corrections` | **Outbound preview** — blocks until approved | Every outbound skill |

**Outbound preview format:**
```
📤 [APPROVAL REQUIRED] <skill-name>
Approval ID: <opaque-id>
Destination: <email/LinkedIn/GitHub/etc.>
Model: claude-sonnet-4-6 (Tier 2)
Content SHA-256: <hash of exact outbound payload>
Expires: <ISO timestamp, max 10 minutes unless explicitly configured>

---
<full text of outbound message>
---

React 👍 to approve • Reply /deny <approval-id> to reject
```

Approval validation rules:
- approver must be `DISCORD_ALLOWED_USER`
- approval message must be unedited and still in `#corrections`
- content hash must match the queued payload exactly
- destination must match the preview exactly
- expired approvals are denied and logged
- reactions on copied, edited, or stale previews are ignored

---

## Skill ↔ GBrain: Read/Write Contract

Every skill YAML declares its GBrain reads and writes in frontmatter:

```yaml
gbrain:
  reads: ["people/*", "projects/tasks.md"]   # glob patterns — what it queries
  writes: ["daily/recap-{{date}}.md"]        # what it creates/updates
```

### Rules
- Skills that only read from GBrain: auto-trust eligible
- Skills that write to GBrain: auto-trust eligible (writes to brain/ are reversible)
- Skills that run shell commands: Dhruva approval required, always
- Skills with `outbound: true`: Tier 2+ + Dhruva approval, always

### Brain write collision prevention (parallel worktrees)
Two skills writing to the same brain file = merge conflict.
Coordinate by writing to date-stamped files:
- daily/briefing-{{date}}.md → each day's file is unique
- projects/tasks.md → single file, never write from two parallel skills

---

## Hermes ↔ XPosterOS: HTTP Contract

XPosterOS runs as a systemd user service on Omen at `http://127.0.0.1:8081`.
Hermes controls it via the `xposteros-control` skill. All communication is localhost (no tunnel needed for Hermes).

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/system/health` | GET | none | Health check + dry_run status (reports all 3 platforms) |
| `/drafts` | GET | Bearer | List all drafts (filter to `review_ready`) |
| `/events/brain-dump` | POST | Bearer | Create Notion brain dump from Hermes |
| `/events/draft-approved` | POST | Bearer | Mark draft approved in Notion |
| `/approvals/draft` | POST | Bearer | Approve draft → queue for posting |
| `/queue/next` | GET | Bearer | Next scheduled queue item |
| `/queue/post-now` | POST | Bearer | Trigger immediate post (confirm first) |
| `/platforms/linkedin/draft` | POST | Bearer | Store LinkedIn draft (from linkedin-post skill) |
| `/platforms/linkedin/posted` | POST | Bearer | Confirm LinkedIn post published |
| `/platforms/youtube/draft` | POST | Bearer | Store YouTube video draft (from youtube-video-create) |
| `/platforms/youtube/published` | POST | Bearer | Confirm YouTube video uploaded |

### XPosterOS env vars (in `~/.hermes/.env` on Omen)

| Var | Value |
|-----|-------|
| `XPOSTEROS_API_URL` | `http://127.0.0.1:8081` |
| `XPOSTEROS_API_TOKEN` | Bearer token (= `API_AUTH_TOKEN` in `/home/dhruva/xposteros/.env`) |

### Dry-run contract
- XPosterOS starts with `XPOSTER_DRY_RUN=true` — all Notion writes blocked
- Events return `WorkerResult(status="success", output.persisted=false, dry_run=true)` in dry-run
- Go-live: set `XPOSTER_DRY_RUN=false` in `/home/dhruva/xposteros/.env` + restart service
- **Never enable live mode without Dhruva's explicit approval**

### Service management
```bash
systemctl --user status xposteros-api     # check
systemctl --user restart xposteros-api   # restart after .env or code changes
journalctl --user -u xposteros-api -n 50 --no-pager  # logs
```

### Worker cron
Hermes cron job `xposteros-workers` runs `deploy/run-workers.sh` every 2 hours.
Check: `hermes cron list` — look for job ID `144fcb74af5c`.

---

## Hermes ↔ External APIs: Tool Contract

| Tool | Provider | Auth | Used by | Status |
|------|---------|------|---------|--------|
| Web search + extract | Exa | `EXA_API_KEY` | research-synthesis, morning-briefing | ✅ key in .env |
| Task DB | Notion API | `NOTION_API_KEY` / `NOTION_TOKEN` | add-task, task-prioritization | ✅ key in .env |
| LinkedIn browser post | **Playwright (local)** | none | linkedin-post | ⬜ install: `pip install playwright && playwright install chromium`. **Browserbase permanently dropped.** |
| YouTube upload | YouTube Data API v3 | OAuth token (youtube.upload scope) | youtube-video-create | ⬜ re-run OAuth + create channel |
| Thumbnail gen | fal.ai FLUX | `FAL_KEY` | youtube-video-create | ⬜ API key needed |
| Calendar | Google Calendar API | OAuth refresh token (headless) | morning-briefing, calendar-read | ✅ token in .env |
| Email | Gmail API | OAuth refresh token (headless) | email-triage, morning-briefing | ✅ token in .env |
| Notion MCP | @notionhq/notion-mcp-server | `NOTION_TOKEN` | all Notion operations | ✅ MCP registered |
| GitHub MCP | @modelcontextprotocol/server-github | `GITHUB_TOKEN` | github-update, Phase 5 | ✅ MCP registered June 5 |
| XPosterOS API | localhost:8081 | `XPOSTEROS_API_TOKEN` | xposteros-control skill | ✅ service running |
| Web extraction (structured) | AgentQL | `AGENTQL_API_KEY` | research-synthesis (optional upgrade) | ⬜ no key yet |
| Browser automation | ~~Browserbase~~ **Playwright** | none | Phase 5 LinkedIn | ⬜ local Playwright — no account or keys needed |
| Image generation (optional) | MiniMax image-01 | `MINIMAX_API_KEY` | /image Discord skill | ⬜ Phase 6 — credits available, safe for non-sensitive prompts |
| Video generation (optional) | MiniMax Hailuo 2.3 | `MINIMAX_API_KEY` | /video Discord skill | ⬜ Phase 6 — burn credits on demo/marketing content |
| TTS (optional cloud) | MiniMax TTS | `MINIMAX_API_KEY` | voice output, non-sensitive text only | ⬜ Phase 6 — Piper (local) is default; MiniMax for quality upgrade |
| Voice call-in | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio → Whisper → Hermes → TTS | ⬜ Phase 6 — call Drew on phone |
| STT (local) | Whisper via Ollama | none | voice input | ⬜ Phase 6 — upgrade config to `model: small` |

**Google API helper script:** `~/.hermes/scripts/google_api_helper.py`
Headless OAuth via stored refresh token. Test: `set -a; source ~/.hermes/.env; set +a; source ~/.hermes/hermes-agent/venv/bin/activate && python3 ~/.hermes/scripts/google_api_helper.py test`

---

## Integration Checklist

**Phase 1 — Complete (June 5, 2026):**

- [x] `systemctl --user status hermes-gateway` is active
- [x] `pm2 list` shows `gbrain-mcp` online
- [x] Drew responds in Discord #briefings
- [x] `hermes mcp test gbrain` — 88 tools discovered
- [x] `hermes mcp list` — notion + gbrain both ✓ enabled
- [x] `gbrain onboard --check --json` — 0 recommendations, fully onboarded
- [x] Morning briefing cron: 8am PST, deliver=discord
- [x] Evening briefing cron: 9pm PST, deliver=discord
- [x] Dream cron: 3am, system crontab
- [x] UFW active: deny all, allow SSH/HTTPS/DNS/NTP
- [x] auditd rules loaded: watching .env, config, crontab
- [x] AppArmor complain mode: dhruvaos-hermes profile
- [x] Tailscale: authenticated, IP <TAILSCALE_IP>

**Phase 2 — Skills deployed (June 5, 2026):**

- [x] `hermes skills list` shows all 8 dhruvaos skills enabled
- [x] Google API credentials tested OK on Omen
- [x] All 18 API keys in ~/.hermes/.env (Notion, Gmail, Calendar, Discord, Supabase, etc.)
- [x] Hermes config: cron_mode=approve, timezone=LA, Notion MCP
- [x] Morning briefing 8am run verified in #briefings ✅
- [x] Notion Tasks DB rebuilt with DhruvaOS schema (Name/Status/Priority/Due/Project/Source) ✅ June 8
- [ ] /task /research /correct commands tested end-to-end
- [ ] Quality firewall test (P3.3 gate — manual)
- [x] Correct Notion Tasks DB ID confirmed: `7b698cab-03a0-43a0-ab04-b074bcd8b4db` ✅

**Phase 4+ — Infrastructure hardening (June 8, 2026):**

- [x] GBrain WASM crash root-caused + fixed: `vm.mmap_rnd_bits=28` (permanent), running from `~/gbrain-src/` ✅
- [x] GBrain autopilot upgrades disabled (`autopilot.self_upgrade.enabled: false`) ✅
- [x] gbrain-embed + gbrain-dream cron scripts fixed: stop PM2 → run → restart PM2 ✅
- [x] gbrain-health-monitor: hourly no-agent cron (job `77c833f1f6ac`), script at `~/.hermes/scripts/gbrain-health-check.sh` ✅
- [x] Hermes model: `gemini-3.1-flash-lite` (verified live at ai.google.dev June 8) ✅
- [x] Agent behavior rule #5 added to CLAUDE.md: always fetch official docs before setting model names ✅

**Phase H — Security + Infrastructure Hardening (June 8, 2026):**

- [x] **morning-briefing cron model**: deprecated model override cleared → `gemini-3.1-flash-lite` in jobs.json (was failing every day since June 1 deprecation). Pattern: any deprecated model causes `HTTP 404` or `Unknown provider` error in cron last_error.
- [x] **drew-ui auth middleware**: extended to cover `/api/voice/*`, `/api/drew/*`, `/api/content/*` — was completely open
- [x] **drew-ui API input caps**: 2000 chars TTS, 4000 chars chat msg, 10MB audio — prevents unbounded spend
- [x] **drew-ui API routes**: removed `exec()` CLI calls in crons/memory/activity → HTTP fetch to `localhost:8642` (Hermes) and `localhost:3131` (GBrain). exec() calls had wrong PATH and used unavailable flags (`--json`).
- [x] **connection-detector**: `stop()` → `raise SystemExit(0)` (was crashing every run), `flock -n` → `flock -w 30` (was silently dropping re-ingest on lock contention)
- [x] **api-cost-watchdog awk regex**: `T` → `[ T]` — Hermes logs use space separator, not `T`; watchdog was reporting $0 every day
- [x] **gbrain-backup-safe.sh**: stop PM2 → `cp -r` → restart PM2 → ntfy on failure. Atomic snapshot. Replaces old racy `flock cp -r` cron line at `30 4 * * *`.
- [x] **wait-for-gbrain.sh** + **ExecStartPre** in `~/.config/systemd/user/hermes-gateway.service`: polls `:3131/health` up to 60s before Hermes starts — prevents race on reboot
- [x] **phi4-mini-check.sh** + cron every 4h: ntfy if Ollama doesn't list phi4-mini
- [x] **GBrain OAuth expiry alert**: appended to `gbrain-health-check.sh`, ntfy if <14 days until 2026-09-05 expiry
- [x] **Hermes gateway health cron**: `*/5 * * * *` — `systemctl --user is-active hermes-gateway || ntfy`
- [x] **Logrotate**: `~/.config/hermes-logrotate.conf` (daily, 14-day rotation); weekly cron Sundays 4am

**Cron jobs erroring (June 8, 2026 state — updated after investigation):**

| Job ID | Name | Error | Root cause | Fix |
|--------|------|-------|------------|-----|
| `d24c69d0f054` | Contact Health Check | Unknown provider 'openai' | Global default was a deprecated model (shut down June 2026); Hermes auth fallback tried 'openai' (not configured) | ✅ Config updated to `gemini-3.1-flash-lite`; model=null; self-heals on next run |
| `fd5af998c518` | Birthday Reminder | Unknown provider 'openai' | Same as above | ✅ Same fix — self-heals |
| `e5c41a6e8f1f` | Morning Briefing | Unknown provider 'openai' | Cron model override (deprecated model) routes through OpenAI-compat endpoint in Hermes catalog; provider 'openai' not in `providers: {}` | ✅ Model override cleared (null); uses global `gemini-3.1-flash-lite` |
| `8482d6f67713` | Paper Monitor | Response truncated + Discord send failed | Output too long (750+ papers); `interpreter shutdown` before Discord delivery | ⚠️ JSON fence-stripping fix deployed; truncation needs skill chunking |

**Vercel env vars needed for drew-ui HTTP routes:**

```
HERMES_URL=https://api.dhruvavutukury.org   # only needed if running on Vercel, not Omen PM2
GBRAIN_URL=https://gbrain.dhruvavutukury.org # only needed if running on Vercel, not Omen PM2
```

drew-ui runs primarily under PM2 on Omen (port 3000), where localhost:8642/3131 work. These env vars only matter if ever deployed to Vercel serverless. Do NOT set until Cloudflare Zero Trust is enabled (tunnels are currently public internet).

**Phase 4 — Dream cycle running (June 6, 2026):**

- [x] Dream cron: `0 3 * * *` system crontab, `gbrain dream --dir /home/dhruva/brain` ✅
- [x] `~/brain` git-initialized — required for `sync` dream phase ✅
- [x] `gbrain sync --repo /home/dhruva/brain` — `local_path` set on default source ✅
- [x] Dream phases enabled: `conversation_facts_backfill`, `enrich_thin`, `skillopt` ✅
- [x] Legacy facts `row_num IS NULL` blockage fixed — v0.32.2 migration re-run ✅
- [x] Live dream cycle verified: all key phases ✓, 14 chunks embedded ✅
- [x] stale-fact-rewrite skill deployed: script + SKILL.md + 25 tests (686 total, all pass) ✅
- [x] Stale-fact-rewrite Hermes cron: 3:30am daily, job ID `6fc1a9ff790c` ✅
- [ ] Brain health score ≥70 via `gbrain doctor` (run after brain has more content)
- [ ] Knowledge graph build: run `gbrain extract links --source db` after brain >100 pages

**Phase 3 — Command skills deployed (June 5, 2026):**

- [x] add-task skill: `/task` → Notion + GBrain tasks-inbox.md (JSON-safe via Python, not curl)
- [x] research-synthesis skill: `/research` → GBrain-first, Exa content fetch, Sonnet synthesis, GBrain ingest before Discord post
- [x] correction-handler skill: `/correct` → classifies BEHAVIOR/FACT/PREFERENCE/FORMAT, appends corrections.md, GBrain ingest
- [x] All 3 Codex-reviewed + fixes applied (JSON injection, step ordering, shell portability, trust gate compliance)
- [ ] P3.3 quality firewall gate: test `/test-outbound` in #corrections (manual — needs Dhruva + Discord)
- [x] ntfy.sh phone push: NTFY_TOPIC in ~/.hermes/.env ✅ iPhone app installed + subscribed ✅ COMPLETE

**XPosterOS Integration — Complete (June 5, 2026):**

- [x] XPosterOS FastAPI backend cloned to `/home/dhruva/xposteros/` on Omen
- [x] `xposteros-api` systemd user service running at `127.0.0.1:8081`
- [x] `integrations/dhruvaos_client.py` — wired HTTP POST to Hermes (non-blocking, best-effort)
- [x] `/events/brain-dump` — creates Notion brain dump in live mode; WorkerResult in dry-run
- [x] `/events/draft-approved` — approves draft in Notion in live mode; WorkerResult in dry-run
- [x] `deploy/run-workers.sh` — worker pipeline runner for Hermes cron
- [x] Hermes cron `xposteros-workers` registered (every 2h, job ID `144fcb74af5c`)
- [x] `xposteros-control` skill deployed to `~/.hermes/skills/dhruvaos/xposteros-control/`
- [x] `XPOSTEROS_API_URL` + `XPOSTEROS_API_TOKEN` in `~/.hermes/.env`
- [x] All 6 Notion DB IDs verified + set in `/home/dhruva/xposteros/.env`
- [x] 50 tests passing, ruff lint clean (DhruvaOS repo: 747/747 contract tests — full suite June 8)
- [x] **FIXED June 6:** `NOTION_API_KEY` + `LLM_DEFAULT_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` added to `~/xposteros/.env`. Service health: `status:ok dry_run:True`. Workers no longer failing.
- [ ] Go-live: set `XPOSTER_DRY_RUN=false` (waiting on X credentials)
- [x] Cloudflare tunnel live — `xposteros-api.dhruvavutukury.org` → `127.0.0.1:8081` ✅ June 8
- [x] CORS updated: `content.dhruvavutukury.org` added to `CORS_ALLOW_ORIGINS` in `~/xposteros/.env` ✅
- [ ] X credentials: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`

---

## Known Issues

| Issue | Status | Fix |
|-------|--------|-----|
| `DISCORD_*_CHANNEL_ID` env vars may not be set | ✅ Fixed June 5 | All 5 channel IDs verified in ~/.hermes/.env |
| Notion MCP hardcoded token | ✅ Fixed June 5 | Changed to `"${NOTION_API_KEY}"` in config.yaml |
| GBrain dual-process (stdio + HTTP) | ✅ Fixed June 5 | Replaced with `url: http://localhost:3131/mcp` |
| XPosterOS workers fail every 2h | ✅ Fixed June 6 | NOTION_API_KEY + LLM keys copied to ~/xposteros/.env |
| stale-fact-rewrite Aborted() WASM error | ✅ Fixed June 7 | Rewrote to use HTTP MCP instead of CLI subprocess (PM2 holds PGLite exclusive lock) |
| `sync` phase failing (brain not a git repo) | ✅ Fixed June 6 | `git init ~/brain`, `gbrain sync --repo /home/dhruva/brain` |
| `extract_facts` blocked by legacy facts `row_num IS NULL` | ✅ Fixed June 6 | v0.32.2 migration re-run, row_num backfilled |
| **GBrain Aborted() WASM crash** | ✅ Fixed June 8 (twice) | Cause 1: `vm.mmap_rnd_bits=32` → fixed to 28 via sysctl.d. Cause 2: WAL corruption from PM2 stop race (backup script stopping PM2 while WAL flush in progress). Fix: restored from `brain.pglite.bak`; gbrain-backup-safe.sh now waits up to 32s for clean PID exit + 2s grace before cp -r. If this happens again: `pm2 stop gbrain-mcp; cp -r ~/.gbrain/brain.pglite.bak ~/.gbrain/brain.pglite; gbrain apply-migrations --yes; pm2 start gbrain-mcp` |
| **gbrain dream + embed crons** | ✅ Fixed June 8 | Scripts at `~/.hermes/scripts/gbrain-{embed,dream}.sh` stop PM2, run, restart PM2. Registered as Hermes no-agent crons. |
| **Hermes on Gemini (temporary)** | ⚠️ Active | Anthropic credits depleted June 6. Model: `gemini-3.1-flash-lite`. Switch back: `sed -i "s/gemini-3.1-flash-lite/claude-sonnet-4-6/; s/provider: google/provider: anthropic/" ~/.hermes/config.yaml && systemctl --user restart hermes-gateway` |
| **XPosterOS Vercel→Omen broken** | ✅ Fixed June 8 | Cloudflare named tunnel `dhruvaos-tunnel` (UUID `e05878ab-757e-4512-acc7-48cc491fe589`) live. UFW fixed (port 7844). All 3 routes: `api.dhruvavutukury.org`, `xposteros-api.dhruvavutukury.org`, `gbrain.dhruvavutukury.org` |
| **GitHub Actions runner not registered** | ✅ Fixed June 8 | Runner configured + running as systemd user service on Omen. |
| **PAT in XPosterOS git remote URL** | ✅ Fixed June 8 | PAT revoked, new PAT generated, remote URL cleaned. |
| **Hermes crons failing (unknown provider 'openai')** | ✅ Fixed June 8 | 12 `auxiliary.*.provider: auto` → `google` in config.yaml. Deprecated model override cleared from morning-briefing (jobs.json). Global default updated to `gemini-3.1-flash-lite`. Root cause: deprecated model in Hermes catalog routed through `provider: openai`; `providers: {}` empty → fails. |
| **Gemini model deprecated (shut down June 2026)** | ✅ Fixed June 8 | Model changed to `gemini-3.1-flash-lite` in config.yaml. Live config verified via SSH. |
| **drew-ui login stuck on loading** | ✅ Fixed June 8 | `router.push` replaced with `window.location.href` in login page — success path now redirects cleanly. |
| **drew-ui auth JSON parse crash** | ✅ Fixed June 8 | try/catch added to `/api/auth/route.ts` — malformed JSON body → 400 instead of 500 |
| **drew-ui login open redirect** | ✅ Fixed June 8 | `redirect` param validated: must start with `/` and not `//`. Malformed values fall back to `/drew`. |
| **jarvis-voice AudioContext leak** | ✅ Fixed June 8 | AudioContext stored in `audioCtxRef`, closed in `stopMicrophone`. Prevents hitting browser 6-ctx limit on repeated mic toggles. |
| **jarvis-voice ERROR_AUTO_RESET_MS dead constant** | ✅ Fixed June 8 | `ERROR_AUTO_RESET_MS` was defined in config but never imported. Error state could stick permanently. Now wired into `useVoiceState` with timer + cleanup. |
| **xposteros-control no reactor identity check** | ✅ Fixed June 8 | `DISCORD_ALLOWED_USER` check added to approval step — any Discord user could previously trigger X post approvals. |
| **.env world-readable** | ✅ Fixed June 8 | `chmod 600` on `/Users/dhruvavutukury/DhruvaOS Mark 2/.env`, `drew-ui/.env.local`, `jarvis-voice/.env.local` |
| **DEPLOYMENT.md stale env vars** | ✅ Fixed June 8 | Removed `BROWSERBASE_API_KEY` + `FIRECRAWL_API_KEY`; added `GOOGLE_API_KEY` for Gemini fallback. |
| **SITE_PASSWORD not in Vercel (drew-ui)** | ⚠️ Remaining | Browser verification June 8: login at dhruvavutukury.org/login shows "wrong password" — env var not set in Vercel. Manual fix: vercel.com → drew-ui → Settings → Env Vars → add `SITE_PASSWORD`. Note: dhruvavutukury.org is served by Vercel, NOT Cloudflare Tunnel. |
| **SITE_PASSWORD not in Omen .env.local** | ✅ Set | Verified June 8: SITE_PASSWORD present in `/home/dhruva/DhruvaOS Mark 2/drew-ui/.env.local`. PM2 drew-ui at port 3000 should authenticate correctly. Issue is Vercel deployment only. |
| **/api/drew/* routes not in main branch** | ⚠️ Remaining | crons/memory/activity routes are on `feat/jarvis-voice-neural-brain` only. Vercel main deployment returns 404 for those routes. Fix: merge feature branch to main. |
| **Vercel proxy bypass (jarvis-voice)** | ⚠️ Remaining | `jarvis-voice-umber.vercel.app` directly accessible without auth. drew-ui middleware only gates `/jarvis/*` on the proxy — direct Vercel URL bypasses it. Fix: add `middleware.ts` to jarvis-voice with password check, or enable Vercel password protection on that deployment. |
| **auth cookie = raw SITE_PASSWORD** | ⚠️ Remaining | Cookie stores the plaintext password. httpOnly+secure mitigates for personal use. Full fix: generate a session token on login, store hash server-side. |
| Anthropic credit watchdog blind to Claude Code usage | ⚠️ Structural | balance-check.sh (every 2h) mitigates. Root fix: separate API keys (done). Spend limit on platform.anthropic.com recommended. |
| **drew-ui API routes unauthenticated** | ✅ Fixed June 8 | All `/api/voice/*`, `/api/drew/*` routes now call `requireAuth()` from `lib/auth.ts`. Uses `timingSafeEqual` to prevent timing attacks. |
| **VoiceInterface stuck in thinking/speaking state** | ✅ Fixed June 8 | Added `AbortSignal.timeout(30_000)` to all 3 fetch calls (transcribe, chat, speak). |
| **api-cost-watchdog blind to Gemini** | ✅ Fixed June 8 | Added `gemini` to grep pattern + MODEL_PATTERNS + COSTS. Deployed to Omen. |
| **paper-monitor silently keeping all papers** | ✅ Fixed June 8 | `phi4-mini` returns JSON in markdown fences; added fence-stripping before `json.loads()`. Deployed to Omen. |
| **ambient-discord-listener missing** | ✅ Added June 8 | New `on_message` trigger skill. phi4-mini classifies every Discord message. Silent by default. Feeds dream cycle. Deployed to Omen. |
| **No zero-LLM heartbeat** | ✅ Added June 8 | `drew-heartbeat.sh` at `~/.hermes/scripts/` — checks Hermes, GBrain, PM2, morning briefing, dream cycle, OAuth expiry. System crontab. Alerts via ntfy. |
| **dev-error-log skill missing** | ✅ Added June 8 | Manual skill to document bugs + failed fixes + working fix + root cause. Writes to `~/brain/dev/error-log.md`. Deployed to Omen. |

**Phase V — Visual + Voice Layer (June 8, 2026):**

- [x] Cloudflare named tunnel live: `dhruvaos-tunnel` UUID `e05878ab-757e-4512-acc7-48cc491fe589` ✅
- [x] `api.dhruvavutukury.org` → Hermes `:8642` ✅ (verified: `{"status":"ok","platform":"hermes-agent"}`)
- [x] `xposteros-api.dhruvavutukury.org` → XPosterOS `:8081` ✅
- [x] `gbrain.dhruvavutukury.org` → GBrain MCP HTTP `:3131` ✅
- [x] Tunnel systemd user service: `~/.config/systemd/user/cloudflared-dhruvaos.service`, linger enabled ✅
- [x] `dhruvavutukury.org` landing page deployed (Vercel, drew-ui project) ✅
- [x] `dhruvavutukury.org/drew` — Drew voice interface, password-gated ✅
- [x] `dhruvavutukury.org/content` → XPosterOS web (proxied via Next.js rewrite) ✅
- [x] `dhruvavutukury.org/jarvis` → Jarvis 3D neural voice (proxied) ✅
- [x] Drew persona `~/.hermes/SOUL.md` deployed, loaded every message ✅
- [x] `jarvis-voice` deployed: `jarvis-voice-umber.vercel.app` (TS errors fixed) ✅
- [x] `xposteros-web` deployed: `web-eta-two-78.vercel.app` (build config fixed) ✅
- [x] Login bug fixed: `window.location.href` redirect, deployed June 8 ✅
- [ ] `SITE_PASSWORD` set in Vercel drew-ui project ⚠️ BROKEN — browser verification June 8 shows "wrong password"; env var not set in Vercel. Manual fix: vercel.com → drew-ui → Settings → Environment Variables → add SITE_PASSWORD
- [x] **jarvis-voice neural brain UI — full biorealistic rewrite (June 8)** ✅
  - Replaced abstract node-graph mesh with single biological neuron (soma + 7 primary dendrites × 4 levels + axon + collaterals)
  - GFP green / CFP cyan fluorescence microscopy palette; pitch-black background `#000008`
  - Vertex-colour taper: branches dim GFP_BRIGHT → GFP_DIM from base to tip (authentic confocal look)
  - Dendritic spines (×240), synaptic boutons (×36 YFP), Nodes of Ranvier (×20 CFP), organelles (×48 inside soma)
  - Nucleolus (YFP sphere inside nucleus) + double nuclear membrane shell
  - Action potential sparks: 15-slot InstancedMesh traveling CatmullRomCurve3 paths; frequency driven by AUDIO_ENERGY
  - Postprocessing: layered Bloom × 2 + ChromaticAberration + Vignette
  - Background extracellular field: 180 faint particles (distant neuron hints)
  - AUDIO_BANDS singleton (zero React batching delay) drives soma emissive + signal rate
  - PR: https://github.com/Dhruva966/DhruvaOS-Mark2/pull/6
- [ ] Cloudflare Zero Trust Access on `api.dhruvavutukury.org` + `gbrain.dhruvavutukury.org` (currently open internet)
- [ ] Phase 5 skills deployed to Omen: `linkedin-post`, `personal-site-update`, `youtube-video-create`
- [ ] P3.3 quality firewall gate test (manual — Discord `/test-outbound`)
- [ ] GBrain braindump ingested (`wiki/braindump-questions.md`)
- [ ] Knowledge graph: `gbrain extract links --source db`

---

## Startup Order Dependency

**Rule:** GBrain must be running before Hermes starts. ✅ FIXED June 8 — `wait-for-gbrain.sh` + `ExecStartPre` in hermes-gateway.service.

**What was done:**
- Created `~/.hermes/scripts/wait-for-gbrain.sh` — polls `:3131/health` every 5s up to 60s
- Added `ExecStartPre=/home/dhruva/.hermes/scripts/wait-for-gbrain.sh` to `~/.config/systemd/user/hermes-gateway.service`
- Ran `systemctl --user daemon-reload && systemctl --user restart hermes-gateway`

Previously: systemd started both services in parallel on boot → Hermes started before `:3131` was listening → MCP silently disabled until manual restart.

---

## GBrain OAuth Token Expiry (Sept 5, 2026)

Token TTL: 90 days from ~June 6. Auto-refresh: `~/.hermes/scripts/refresh-gbrain-token.sh` every 60 days (~Aug 5).

**Important:** The 60-day refresh script has not yet run as of June 8 (system is 3 days old). Verify it runs correctly on Aug 5 by checking logs. The `:3131/health` endpoint does NOT require auth — gbrain-health-monitor will show green even after token expiry. Only an actual authenticated MCP call test will catch a stale token.

**To manually verify token health (SSH to Omen):**
```bash
curl -s -H "Authorization: Bearer $(grep MCP_GBRAIN_API_KEY ~/.hermes/.env | cut -d= -f2)" \
  http://127.0.0.1:3131/mcp/tools | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d)} tools')" 2>/dev/null || echo "AUTH FAILED"
```

---

## Known Coupling Points (collision risk in parallel builds)

| Coupling | Risk | Resolution |
|---------|------|-----------|
| GBrain PGLite DB | Two processes write simultaneously → corruption | Never run two GBrain write operations in parallel |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML | Edit sequentially, restart Hermes after each |
| `~/brain/projects/tasks.md` | Two skills write simultaneously | task-prioritization is the only writer; no other skill writes this file |
| Discord bot token | Shared by all Hermes instances | Only one Hermes process running at a time |
| Sunday 21:00 cron slot | skill-analytics + weekly-learning-synthesis fire simultaneously | weekly-learning-synthesis writes GBrain; stagger to `10 21 * * 0` |
| 2–4am nightly window | embed → dream → stale-fact-rewrite → backup | Embed running long overlaps dream start; backup reads during active PM2 |
