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
| `/system/health` | GET | none | Health check + dry_run status (now reports all 3 platforms) |
| `/drafts` | GET | Bearer | List all drafts (filter to `review_ready`) |
| `/events/brain-dump` | POST | Bearer | Create Notion brain dump from Hermes |
| `/events/draft-approved` | POST | Bearer | Mark draft approved in Notion |
| `/approvals/draft` | POST | Bearer | Approve draft → queue for posting |
| `/queue/next` | GET | Bearer | Next scheduled queue item |
| `/queue/post-now` | POST | Bearer | Trigger immediate post (confirm first) |
| `/platforms/linkedin/draft` | POST | Bearer | Store LinkedIn draft (from linkedin-post skill) |
| `/platforms/linkedin/posted` | POST | Bearer | Confirm LinkedIn post published |
| `/platforms/youtube/draft` | POST | Bearer | Store YouTube video draft (from youtube-video-create skill) |
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
| LinkedIn browser post | Browserbase | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` | linkedin-post skill | ⬜ credentials needed |
| YouTube upload | YouTube Data API v3 | OAuth token (youtube.upload scope) | youtube-video-create skill | ⬜ re-run OAuth + create channel |
| Thumbnail gen | fal.ai FLUX | `FAL_KEY` | youtube-video-create skill | ⬜ API key needed |
| Calendar | Google Calendar API | OAuth refresh token (headless) | morning-briefing, calendar-read | ✅ token in .env |
| Email | Gmail API | OAuth refresh token (headless) | email-triage, morning-briefing | ✅ token in .env |
| Notion MCP | @notionhq/notion-mcp-server | `NOTION_TOKEN` | all Notion operations | ✅ MCP registered |
| GitHub MCP | @modelcontextprotocol/server-github | `GITHUB_TOKEN` | github-update, Phase 5 | ✅ MCP registered June 5 |
| XPosterOS API | localhost:8081 | `XPOSTEROS_API_TOKEN` | xposteros-control skill | ✅ service running |
| Web extraction (structured) | AgentQL | `AGENTQL_API_KEY` | research-synthesis (optional upgrade) | ⬜ no key yet |
| Browser automation | Browserbase | `BROWSERBASE_API_KEY` | Phase 5 LinkedIn | ⬜ Phase 5 |
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
- [ ] Morning briefing 8am run verified in #briefings (pending — June 5 8am)
- [ ] Notion Tasks DB proper schema created (current: Snoopy AI schema)
- [ ] /task /research /correct commands tested end-to-end
- [ ] Quality firewall test (P3.3 gate — manual)
- [x] Correct Notion Tasks DB ID confirmed: `7b698cab-03a0-43a0-ab04-b074bcd8b4db` ✅

**Phase 4 — Dream cycle running (June 6, 2026):**

- [x] Dream cron: `0 3 * * *` system crontab, `gbrain dream --dir /home/dhruva/brain` ✅
- [x] `~/brain` git-initialized — required for `sync` dream phase ✅
- [x] `gbrain sync --repo /home/dhruva/brain` — `local_path` set on default source ✅
- [x] Dream phases enabled: `conversation_facts_backfill`, `enrich_thin`, `skillopt` ✅
- [x] Legacy facts `row_num IS NULL` blockage fixed — v0.32.2 migration re-run ✅
- [x] Live dream cycle verified: all key phases ✓, 14 chunks embedded ✅
- [x] stale-fact-rewrite skill deployed: script + SKILL.md + 25 tests (646 total, all pass) ✅
- [x] Stale-fact-rewrite Hermes cron: 3:30am daily, job ID `6fc1a9ff790c` ✅
- [ ] Brain health score ≥70 via `gbrain doctor` (run after brain has more content)
- [ ] Knowledge graph build: run `gbrain extract links --source db` after brain >100 pages

**Phase 3 — Command skills deployed (June 5, 2026):**

- [x] add-task skill: `/task` → Notion + GBrain tasks-inbox.md (JSON-safe via Python, not curl)
- [x] research-synthesis skill: `/research` → GBrain-first, Exa content fetch, Sonnet synthesis, GBrain ingest before Discord post
- [x] correction-handler skill: `/correct` → classifies BEHAVIOR/FACT/PREFERENCE/FORMAT, appends corrections.md, GBrain ingest
- [x] All 3 Codex-reviewed + fixes applied (JSON injection, step ordering, shell portability, trust gate compliance)
- [ ] P3.3 quality firewall gate: test `/test-outbound` in #corrections (manual — needs Dhruva + Discord)
- [x] ntfy.sh phone push: NTFY_TOPIC=dhruva-alerts-14a313f0dbe1 in ~/.hermes/.env ✅. Still needed: install ntfy iPhone app → subscribe to ntfy.sh/dhruva-alerts-14a313f0dbe1

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
- [x] 50 tests passing, ruff lint clean (DhruvaOS repo: 646/646 contract tests — full suite June 6)
- [x] **FIXED June 6:** `NOTION_API_KEY` + `LLM_DEFAULT_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` added to `~/xposteros/.env`. Service health: `status:ok dry_run:True`. Workers no longer failing.
- [ ] Go-live: set `XPOSTER_DRY_RUN=false` (waiting on X credentials)
- [ ] Cloudflare tunnel for Vercel→Omen backend (manual step — `/etc/cloudflared/config.yml` placeholder)
- [ ] Vercel env vars: `XPOSTEROS_API_URL=https://xposteros.<TUNNEL_DOMAIN>` (needs tunnel first)
- [ ] X credentials: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`

---

## Known Issues

| Issue | Status | Fix |
|-------|--------|-----|
| `DISCORD_*_CHANNEL_ID` env vars may not be set | ✅ Fixed June 5 | All 5 channel IDs verified in ~/.hermes/.env |
| Notion MCP hardcoded token | ✅ Fixed June 5 | Changed to `"${NOTION_API_KEY}"` in config.yaml |
| GBrain dual-process (stdio + HTTP) | ✅ Fixed June 5 | Replaced with `url: http://localhost:3131/mcp` |
| **XPosterOS workers fail every 2h** | ✅ **Fixed June 6** | NOTION_API_KEY + LLM keys copied to ~/xposteros/.env; health: status:ok dry_run:True |
| stale-fact-rewrite deployed | ✅ **Fixed June 6** | Script at ~/.hermes/scripts/, SKILL.md at ~/.hermes/skills/dhruvaos/stale-fact-rewrite/, Hermes cron 3:30am (job ID 6fc1a9ff790c) |
| `sync` phase failing (brain not a git repo) | ✅ **Fixed June 6** | `git init ~/brain`, `gbrain sync --repo /home/dhruva/brain` set local_path |
| `extract_facts` blocked by legacy facts with `row_num IS NULL` | ✅ **Fixed June 6** | v0.32.2 migration re-run after setting local_path; row_num backfilled |
| **Anthropic credits depleted** | 🔴 **OPEN — URGENT** | All Claude cron jobs failing (HTTP 400). Top up at console.anthropic.com. Meeting-prep-brief fires every 30min and burns retries. |
| **GBrain CLI WASM crash (v0.42.26.0)** | 🟡 **OPEN** | `gbrain search`/`gbrain call` fail with PGLite WASM error. Running gbrain-mcp PM2 (pid 100969, v0.42.25.0 in memory) is healthy — **do NOT restart it**. Stale-fact-rewrite will fail nightly. Wait for gbrain 0.42.27 fix, or pin CLI to older version when available. |
| **PM2 startup not configured** | 🟡 **OPEN** | PM2 was empty on reconnect — gbrain-mcp survives reboots only because it was never killed. Run `pm2 startup` + `pm2 save` with correct PATH to make restarts safe. |

---

## Known Coupling Points (collision risk in parallel builds)

| Coupling | Risk | Resolution |
|---------|------|-----------|
| GBrain PGLite DB | Two processes write simultaneously → corruption | Never run two GBrain write operations in parallel |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML | Edit sequentially, restart Hermes after each |
| `~/brain/projects/tasks.md` | Two skills write simultaneously | task-prioritization is the only writer; no other skill writes this file |
| Discord bot token | Shared by all Hermes instances | Only one Hermes process running at a time |
