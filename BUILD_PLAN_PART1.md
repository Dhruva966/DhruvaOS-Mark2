# DhruvaOS Mark 2 — Build Plan (Historical Archive)

> **Note for Claude:** This file documents everything that has already been executed. It exists for historical reference — understanding what was built, how, and why. Do NOT use this as a guide for what to do next. See `BUILD_PLAN.md` for the active plan.
>
> Phases 0, 1, 2, 3 (mostly), 4 (mostly), 8, 9, 10, 11, 13, 14 are COMPLETE. The runbooks, install commands, and task tables below represent work already done on the HP Omen as of June 2026.

---

# DhruvaOS Mark 2 — Build Plan

## Current State — June 8, 2026

| Item | Status |
|------|--------|
| Hermes provider | **`gemini-3.1-flash-lite` (google) — TEMPORARY** while Anthropic credits replenish. Switch back: `sed -i "s/gemini-3.1-flash-lite/claude-sonnet-4-6/; s/provider: google/provider: anthropic/" ~/.hermes/config.yaml && systemctl --user restart hermes-gateway`. **Always verify current model at ai.google.dev — Gemini 2.0 shut down June 1, 2026.** |
| Hermes cron provider fix | **FIXED June 8** — 12 `auxiliary.*.provider: auto` entries → `google`. Was resolving to openai (not a registered provider). |
| Browserbase | **PERMANENTLY DROPPED** — replaced by local Playwright ($0). Disabled in config.yaml. |
| gbrain dream/embed crons | **FIXED June 8** — Scripts at `~/.hermes/scripts/gbrain-{embed,dream}.sh` stop PM2, run operation, restart PM2. Registered as Hermes no-agent crons at 2am/3am. |
| GBrain install method | **CHANGED** — runs from `~/gbrain-src/` git clone (NOT global bun install). bun global install resolves PGLite 0.5.1 which breaks pgvector. |
| GBrain WASM crash | **FIXED June 8** — `vm.mmap_rnd_bits=28` set permanently via `/etc/sysctl.d/99-wasm-compat.conf`. |
| GBrain autopilot | **DISABLED** — `autopilot.self_upgrade.enabled: false`. Manual bi-weekly updates: `cd ~/gbrain-src && git pull && bun install && pm2 restart gbrain-mcp` |
| gbrain-health-monitor | **DEPLOYED** — hourly no-agent cron (job `77c833f1f6ac`), auto-recovers PM2, alerts #alerts on failure/recovery, silent when healthy. |
| stale-fact-rewrite | Fixed — uses HTTP MCP instead of CLI subprocess |
| GitHub Actions auto-deploy | **DONE June 8** — runner on Omen as systemd user service, PAT regenerated with `workflow` scope, git remote URL cleaned. |
| API keys | Separated: Claude Code key, Hermes key (`~/.hermes/.env`), XPosterOS key (`~/xposteros/.env`) |
| meeting-prep-brief | Fixed to `0 * * * *` (24/day, was 48/day) |
| balance-check.sh | Deployed to `~/.hermes/scripts/`, runs every 2h via system crontab |
| Cloudflare Tunnel | **LIVE June 8** — named tunnel `dhruvaos-tunnel` (UUID `e05878ab`). `api.dhruvavutukury.org` (Hermes), `xposteros-api.dhruvavutukury.org` (XPosterOS), `gbrain.dhruvavutukury.org` (GBrain). Systemd user service + linger. |
| dhruvavutukury.org | **LIVE June 8** — landing page + `/drew` (voice, password-gated) + `/content` (XPosterOS) + `/jarvis` (3D neural). Login fixed. |
| jarvis-voice neural UI | **REBUILT June 8** — biorealistic single neuron (GFP/CFP fluorescence), action potentials, dendritic spines, Nodes of Ranvier, vertex-colour gradient. PR #6. |
| Drew persona | **DEPLOYED June 8** — `~/.hermes/SOUL.md`, loaded every message. Poke Master Protocol active. |
| Notion Tasks DB | **FIXED June 8** — DhruvaOS schema: Name/Status(select)/Priority/Due/Project/Source. |
| paper-monitor | **FIXED June 8** — PER_FEED_CAP=8, correct model (GPT-4o-mini), prerequisite fixed. |
| failure-backlog | **DEPLOYED June 8** — cron every 6h (job `7fb1535f27b7`). |
| Security (AppArmor enforce, quality firewall gate) | **Deferred to very end** |
| Phase 5 skills | **BUILT, not deployed to Omen** — `linkedin-post`, `personal-site-update`, `youtube-video-create`. 686 tests passing. Deploy after P3.3 gate. |
| GBrain braindump | **NOT ingested** — wiki/braindump-questions.md partial. Ingest before Phase 5 deploy. |
| Cloudflare Zero Trust | **PENDING** — `api.` + `gbrain.dhruvavutukury.org` open internet. Add Zero Trust email OTP at dash.cloudflare.com. |

**Next: Cloudflare Zero Trust, deploy Phase 5 skills, P3.3 firewall test, GBrain braindump.**

---

## Philosophy

Mark 1 planned 7 phases. Mark 2 uses the same phase structure, re-scoped for Hermes + GBrain.
The custom infrastructure (FastAPI, Mem0, Qdrant, Graphify) is gone — replaced by Hermes and
GBrain that are installed, not built. Phase 0 is an install+wire task, not a build task.

Build effort concentrates in Phase 2+ (skills) and Phase 4 (self-improving loop).

---

## Phase 0: Infrastructure ✅ COMPLETE (June 4, 2026)

All tasks done. Phase 1 active.

### P0 Task Table

| Task | Command / Action | Done condition | Status |
|------|-----------------|----------------|--------|
| P0.1 | ~~Create `dhruvaos` non-root user~~ → used `dhruva` (main user) | user exists | ✅ |
| P0.2 | Install Python 3.12 via apt (3.11 not in Ubuntu 24.04 repos) | `python3 --version` ≥3.11 | ✅ |
| P0.3 | Install Bun ≥1.3.10 | `bun --version` = 1.3.14 | ✅ |
| P0.4 | Install Node v24 via nvm | `node --version` = v24.x | ✅ |
| P0.5 | Install pm2 globally | `pm2 --version` returns | ✅ |
| P0.6 | Install Ollama (systemd auto-start) | `systemctl status ollama` = active | ✅ |
| P0.7 | Pull phi4-mini + nomic-embed-text | `ollama list` shows both | ✅ |
| P0.8 | Install Hermes via official installer | gateway running | ✅ |
| P0.9 | Install GBrain 0.42.36.0 | `gbrain --version` | ✅ |
| P0.10 | Scaffold `~/brain/` + GBrain init | `gbrain init` succeeded | ✅ |
| P0.11 | Write `~/.gbrain/config.json` (ollama embedding) | config in place | ✅ |
| P0.12 | Run `gbrain onboard --check --json` | checks green | ✅ |
| P0.13 | Create Discord bot (drew#4878) + 6 channels | bot connected | ✅ |
| P0.14 | Create `~/.hermes/.env` (chmod 600) | keys in place | ✅ |
| P0.15 | Write `~/.hermes/config.yaml` | 4-tier routing configured | ✅ |
| P0.16 | Install Lightpanda binary | `lightpanda --version` returns; PM2 shows `lightpanda` online at :9222 | ✅ |
| P0.17 | Start GBrain HTTP server via PM2 | `pm2 list` shows `gbrain-mcp` online | ✅ |
| P0.18 | Start Hermes gateway via systemd user service | `systemctl --user status hermes-gateway` = active | ✅ |
| P0.19 | Baseline hardening in progress | Approval gates, allowlist, and non-root runtime set; AppArmor/UFW/auditd still phase 0.5 |

### P0.8 — Hermes install (current method, verified June 2026)

```bash
# Official one-liner — handles Python 3.11, venv, uv, Node.js, ripgrep, ffmpeg
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version
```

If offline or pinned install needed:
```bash
git clone https://github.com/NousResearch/hermes-agent ~/.hermes-src
cd ~/.hermes-src
python3.11 -m venv .venv && source .venv/bin/activate
uv sync           # preferred (uses uv.lock for hash-verified install)
```

### P0.10 — GBrain init

```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
mkdir -p ~/.gbrain
# Write config (see MEMORY.md for content)
gbrain init       # initializes PGLite schema at ~/.gbrain/brain.pglite/
```

### P0.15 — Hermes config.yaml (MCP section)

GBrain runs in HTTP mode as a PM2 daemon. Hermes connects via HTTP MCP.
Key: `mcp_servers:` (not `mcp.servers`) — verified from Hermes cli-config.yaml.example.

```yaml
# ~/.hermes/config.yaml (MCP section — add to full config from MODEL_ROUTING.md)
mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"
```

Full config structure also needs provider + model routing sections from MODEL_ROUTING.md.

### P0.16 — Lightpanda install

```bash
# Ubuntu/Omen — prebuilt binary (glibc, works on Ubuntu natively)
curl -LO https://github.com/lightpanda-io/browser/releases/latest/download/lightpanda-x86_64-linux
chmod +x lightpanda-x86_64-linux
sudo mv lightpanda-x86_64-linux /usr/local/bin/lightpanda
lightpanda --version   # verify install

# Hermes config — tell Hermes to use Lightpanda as browser backend
# Add to ~/.hermes/config.yaml (already written in P0.15, append this section):
# browser:
#   backend: lightpanda
#   endpoint: "ws://127.0.0.1:9222"
#   fallback_backend: browserbase
```

**Beta caveat:** Lightpanda is production-capable for scraping but may crash on heavy JS pages.
Skills must handle retry. Critical outbound skills use Browserbase fallback.

### P0.17-18 — service startup

```bash
# Lightpanda CDP server (Hermes connects via WebSocket)
pm2 start "lightpanda --host 127.0.0.1 --port 9222" --name lightpanda

# GBrain HTTP mode — PM2 daemon is safe because HTTP (not stdio pipe)
pm2 start "/home/dhruva/.bun/bin/gbrain serve --http --port 3131 --host 127.0.0.1" --name gbrain-mcp

# Hermes gateway
set -a; source ~/.hermes/.env; set +a
hermes gateway install
systemctl --user status hermes-gateway

pm2 startup && pm2 save
```

---

## Phase 1: Alive ✅ COMPLETE (June 5, 2026)

**Goal:** Hermes responds in Discord. GBrain MCP connected. Brain has initial content.

**Status:** ALL tasks complete as of overnight June 4-5 session.

### P1 Tasks

```
P1.1  [parallel] Hermes Discord end-to-end test              ✅ Drew responds in DMs + #briefings
P1.2  [parallel] phi4-mini Tier 0 routing verified            ✅
P1.3  [parallel] Claude Sonnet Tier 2 verified                ✅
P1.4  [parallel] Claude Opus Tier 3 verified                  ✅
P1.5  [SEQUENTIAL] GBrain MCP connection verified             ✅ 88 tools discovered
P1.6  [SEQUENTIAL after P1.5] Obsidian vault imported         ✅ 40 pages, 45 chunks, embedded
P1.7  [after P1.6] GBrain built-in skills active              ✅ category dirs in ~/.hermes/skills/ (scaffolded in prior session)
P1.8  [after P1.7] Morning briefing stub fires at 8am         ✅ cron set, deliver=discord, model=claude-sonnet-4-6
P1.9  Lid-close suspend disabled                              ✅ HandleLidSwitch=ignore, sleep.target masked
P1.10 Security hardening (AppArmor + UFW + auditd)           ✅ UFW active, auditd rules loaded, AppArmor complain mode
P1.11 Tailscale (anywhere SSH)                                ✅ v1.98.4 installed + authenticated. IP stored in private ops note
```

P1.1-P1.4 parallel-safe (different providers, no shared state).
P1.5 + P1.6 sequential (both write to GBrain PGLite DB).

### P1.5 — GBrain MCP verification ✅ DONE

**Actual wire-up** (production contract):
```bash
# ~/.hermes/config.yaml
mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"

hermes mcp list          # verify appears
hermes mcp test gbrain   # 88 tools discovered
```

**Actual output:** `✓ Connected (2285ms) ✓ Tools discovered: 88`

If this fails: `pm2 logs gbrain-mcp --lines 50` to debug.

### P1.5b — Brain sync setup (do before vault import)

Set up Git sync so Obsidian on Mac and GBrain on Omen stay in sync automatically.
Full setup instructions in MEMORY.md → "Brain Sync Architecture" section.

Quick version:
```bash
# On Mac — initialize brain repo:
cd ~/path/to/obsidian-vault
git init && git remote add origin git@github.com:Dhruva966/dhruvaos-brain.git
git push -u origin main

# On Omen — add to crontab:
*/5 * * * * flock -n ~/.gbrain/gbrain-write.lock sh -lc 'cd /home/dhruva/brain && git pull --ff-only && /home/dhruva/.bun/bin/gbrain embed --stale'
```

Install Obsidian Git plugin on Mac → auto-commit every 5 min.

### P1.6 — Obsidian vault import ✅ DONE

**Vault location (Mac):** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/dhruva's wiki` (40 files, iCloud)

Copied via rsync to Omen at `~/vault/obsidian/` (not `~/brain/`):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""   # Mac — generate key first
ssh-copy-id dhruva@<LAN_IP>                         # authorize on Omen
ssh dhruva@<LAN_IP> "mkdir -p ~/vault/obsidian"
rsync -avz -e "ssh -o StrictHostKeyChecking=no" \
  "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/dhruva's wiki/" \
  dhruva@<LAN_IP>:~/vault/obsidian/
```

**OLLAMA_BASE_URL gotcha (Ubuntu 24.04):** IPv6 localhost resolution fails. Must set:
```bash
echo 'export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1' >> ~/.bashrc
```

Import into GBrain (corrected commands — `onboard --apply` is a no-op, use `jobs submit`):
```bash
gbrain init --pglite --embedding-model ollama:nomic-embed-text
gbrain import ~/vault/obsidian --no-embed
gbrain embed --all
gbrain jobs submit extract-timeline-from-meetings --follow
gbrain jobs submit extract-ner --follow
gbrain jobs submit unify-types --params '{"target_pack":"gbrain-base-v2"}' --follow
gbrain onboard --check --json    # verify 0 recommendations
```

**Result:** 40 pages, 45 chunks, 85 tags, fully embedded, pack upgraded to gbrain-base-v2.

### P1.7 — GBrain built-in skills

GBrain ships ~43-50 bundled skills. Scaffold them to the Hermes agent workspace:
```bash
gbrain skillpack scaffold --all
```

Skills land in the agent workspace `skills/` dir (i.e., `~/.hermes/skills/`). The command is idempotent — safe to re-run, will not overwrite edited files.

**Done condition:** `~/.hermes/skills/RESOLVER.md` exists.

Key always-on skills scaffolded: `signal-detector`, `brain-ops` (injected every message).
Other notable skills: `briefing`, `daily-task-manager`, `skill-creator`, `query`, `enrich`, `capture`.

Verify signal-detector is active:
- Send a message with a named person or project to #briefings
- Check GBrain: `gbrain search "<person name>"` — should return an entry

**Note:** If upgrading from pre-v0.36.0.0, run `gbrain skillpack migrate-fence` first.

### P1.10 — Security hardening (UFW + auditd + AppArmor)

**Order matters: UFW first (highest ROI), auditd second, AppArmor last in complain mode.**

**Reality check:** `require_approval_always: true` already in Hermes config is the strongest control. OS hardening is defense-in-depth against a rogue skill or supply chain attack.

**UFW (20 min):**
```bash
sudo ufw default deny incoming
sudo ufw default deny outgoing
sudo ufw default deny forward
sudo ufw allow in on lo       # loopback — REQUIRED or GBrain/Ollama localhost connections break
sudo ufw allow out on lo
sudo ufw allow out 53/udp comment "DNS"
sudo ufw allow out 53/tcp comment "DNS TCP fallback"
sudo ufw allow out 123/udp comment "NTP"
sudo ufw allow out 80/tcp comment "HTTP (apt)"
sudo ufw allow out 443/tcp comment "HTTPS (APIs, Discord, apt-s)"
sudo ufw allow out 22/tcp comment "SSH/git"
sudo ufw enable
sudo ufw status verbose
```

**auditd (30 min):**
```bash
sudo apt install auditd audispd-plugins
sudo systemctl enable --now auditd

# Create /etc/audit/rules.d/50-dhruvaos.rules:
sudo tee /etc/audit/rules.d/50-dhruvaos.rules <<'EOF'
-w /etc/crontab -p wa -k cron-modify
-w /var/spool/cron/crontabs/ -p wa -k cron-modify
-w /home/dhruva/.config/systemd/user/ -p wa -k user-systemd-units
-w /var/log/wtmp -p wa -k logins
-w /home/dhruva/.hermes/.env -p rwa -k hermes-secrets
-a always,exit -F dir=/home/dhruva/.hermes -F perm=w -k hermes-dir-writes
-w /etc/systemd/system/ -p wa -k systemd-system-units
-w /etc/sudoers -p wa -k sudoers-modify
EOF
sudo augenrules --load

# Query logs:
sudo ausearch -k hermes-secrets
sudo ausearch -k cron-modify
```

**AppArmor (complain mode — no service disruption):**
```bash
sudo apt install apparmor-utils

# Create named profile — Hermes Python process:
sudo tee /etc/apparmor.d/hermes-agent <<'EOF'
profile hermes-agent {
    #include <abstractions/base>
    #include <abstractions/python>
    #include <abstractions/nameservice>
    /home/dhruva/.hermes/ r,
    /home/dhruva/.hermes/** rw,
    /home/dhruva/.hermes/.venv/bin/python3 ix,
    /home/dhruva/.hermes/.venv/lib/** r,
    network tcp,
    network udp,
    deny network raw,
    deny /etc/** w,
}
EOF
sudo apparmor_parser -r /etc/apparmor.d/hermes-agent
sudo aa-complain /etc/apparmor.d/hermes-agent   # log-only mode — no blocking
# Profile loads as: dhruvaos-hermes (verify: sudo aa-status | grep hermes)

# Add to ~/.config/systemd/user/hermes-gateway.service under [Service]:
# AppArmorProfile=dhruvaos-hermes
# Then: systemctl --user daemon-reload && systemctl --user restart hermes-gateway

# After 2 weeks of clean complain logs, switch to enforce:
# sudo aa-enforce dhruvaos-hermes
```

**Done condition:** `sudo ufw status verbose` shows rules active; `sudo ausearch -k hermes-secrets` returns entries; Hermes still running after AppArmor complain mode.

**Cron job IDs (Omen, as of June 2026):**
- Morning briefing: `e5c41a6e8f1f` (8am PST) — resume if paused: `hermes cron resume e5c41a6e8f1f`
- **Notion Tasks DB:** `NOTION_TASKS_DB_ID=7b698cab-03a0-43a0-ab04-b074bcd8b4db` ✅ verified write OK (June 5, 2026). Status field = `status` type (not `select`).
- **Other DB IDs now in .env:** NOTION_PROJECTS_DB_ID, NOTION_PEOPLE_DB_ID, NOTION_BRIEFINGS_DB_ID

---

## Phase 2: Inbox ⚠️ COMPLETE (June 5, 2026) (except P2.0: Notion DB creation — manual step pending)

**Goal:** email triage works, calendar read, morning briefing has real content.

**Status:** Skills written + deployed. Keys merged. Cron jobs set. Awaiting: Notion DB creation (manual in UI), first live briefing verification, command end-to-end tests, and quality firewall gate.

### P2 Tasks

```
P2.0  [one-time] Notion 4-DB setup                            ⬜ create manually in Notion UI (NOTION_TASKS_DB_ID set)
P2.1  [parallel] email-triage skill                           ✅ deployed, Gmail+classify+mark-read, 4-msg Discord
P2.2  [parallel] calendar skill                               ✅ deployed, 7-day agenda, composable
P2.3  [parallel] morning-briefing skill                       ✅ deployed, 4-msg Discord format (calendar+inbox+tasks+research)
P2.4  [parallel] evening-briefing skill                       ✅ deployed, 3-msg Discord format
P2.5  [after P2.1-P2.4] task-prioritization skill             ✅ deployed, Notion+GBrain scoring
P2.6  [after P2.5] Morning briefing fires with real data      ⬜ verify 8am June 5 run in #briefings

Phase 2 EXTRAS deployed (Phase 3 territory):
P2.E1 add-task skill                                          ✅ deployed, /task command, Notion+GBrain
P2.E2 research-synthesis skill                                ✅ deployed, Exa+GBrain, /research command
P2.E3 correction-handler skill                                ✅ deployed, /correct command, permanent GBrain facts
```

**All skills enabled:** `hermes skills list` shows all 8 dhruvaos skills as enabled.
**MCPs connected:** GBrain (88 tools) + Notion MCP both ✅.
**Crons:** morning=8am, evening=9pm, dream=3am — all active.

### P2.0 — Notion database setup (one-time, do before P2.1) — UPDATED June 2026

**Create the 4 databases manually in the Notion UI.** Programmatic creation via MCP is possible but complex (relation bootstrapping requires specific ordering + two-pass updates). Manual creation takes ~15 minutes and is lower risk.

1. **Tasks** — Name (title), Status (*status* type — not select), Priority (select), Due (date), Project (relation to Projects DB), Source (select)
2. **Projects** — Name (title), Status (select), Area (select), Tasks (relation+rollup from Tasks DB), Notes URL
3. **People** — Name (title), Company (relation), Role (text), Last Contact (date), Brain File URL
4. **Daily Briefings** — Date (title), Type (select: Morning/Evening), Summary (text), Discord Link (URL)

After creating each DB: open it in Notion → "..." menu → "Add connections" → add your integration.

Get integration token: `https://www.notion.so/my-integrations` → New integration → copy token (starts with `ntn_` or `secret_`).

Store in `~/.hermes/.env`:
```bash
NOTION_API_KEY=ntn_xxxx    # your token value
NOTION_TASKS_DB=<id>
NOTION_PROJECTS_DB=<id>
NOTION_PEOPLE_DB=<id>
NOTION_BRIEFINGS_DB=<id>
```

Add Notion MCP to Hermes `mcp_servers:` in `~/.hermes/config.yaml`:
```yaml
mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"
  notion:
    command: "npx"
    args: ["-y", "@notionhq/notion-mcp-server"]
    env:
      NOTION_TOKEN: "${NOTION_API_KEY}"   # CRITICAL: process env key must be NOTION_TOKEN
```

**Notion MCP notes (v2.2.1, June 2026):**
- Use local npm package, NOT hosted `mcp.notion.com` (hosted requires browser OAuth, incompatible with headless Hermes)
- All `*database*` tool names renamed to `*data-source*` in v2.0.0 (e.g., `create-a-data-source`)
- Two unpatched CVEs in local npm server — mitigated by running as non-root dhruva user
- `query-data-source` returns max 100 rows; handle `has_more: true` + `start_cursor` pagination

### P2.1 — Email triage implementation detail — UPDATED June 2026

**One-time OAuth setup (do on Mac, then copy token to Omen):**

Service accounts do NOT work with personal @gmail.com. Desktop app OAuth2 is correct.
OOB (out-of-band) flow was killed in January 2023 — do not use redirect URI `urn:ietf:wg:oauth:2.0:oob`.

Setup steps:
1. Create Google Cloud project → enable Gmail API + Google Calendar API
2. Create OAuth 2.0 credentials (Desktop app type) → download `credentials.json`
3. **CRITICAL: Publish OAuth app to "In production"** (not "Testing") — Testing mode makes refresh tokens expire after 7 days. For personal use: publish without verification (just fill placeholder privacy policy URL).
4. Run the Mac-side auth script (see `scripts/gmail-oauth-setup.py` — created in Phase 2 prep)
5. `scp ~/.hermes/token.json dhruva@omen:~/.hermes/token.json`

From then on: Python library refreshes the token automatically using the refresh token. Refresh token is permanent as long as the app is "In production" and used regularly.

**Combined scopes (Gmail + Calendar in ONE token):**
```python
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",    # read + mark as read; no send/delete
    "https://www.googleapis.com/auth/calendar.readonly",
]
```

Install on Omen (in Hermes venv):
```bash
source ~/.hermes/.venv/bin/activate
pip install google-api-python-client google-auth-oauthlib google-auth-httplib2
```

### P2.2 — Calendar skill — UPDATED June 2026

Google Calendar API uses the SAME `token.json` as Gmail (same OAuth credentials, combined scopes in P2.1). No separate OAuth flow needed.

```python
# Calendar API call in skill
service = build('calendar', 'v3', credentials=creds)
events = service.events().list(calendarId='primary', timeMin=now, maxResults=10).execute()
```

### Hermes skill format clarification (June 2026 research)

**Hermes uses SKILL.md markdown files**, not `.yaml` files. The DhruvaOS project stores stubs as `skills/*.yaml` with YAML frontmatter + markdown body (essentially the same format). When deploying to Hermes, copy to `~/.hermes/skills/<name>.md`.

**Fields that Hermes IGNORES (DhruvaOS documentation conventions only):**
- `tier:` — Hermes does NOT route by this. Set model via `hermes cron create --model` or `config.yaml`.
- `outbound:` — behavioral contract only; Hermes has global `approvals.mode` in config.yaml
- `requires_approval:` — implement via `clarify` tool calls in the skill body
- `gbrain.reads/writes:` — documentation only; GBrain scoping happens through actual `gbrain search` queries in the body
- `schedule:` — **not a skill field**; cron is separate (see below)

**Cron setup (correct way):**
```bash
# Create scheduled job — separate from skill YAML:
hermes cron create "0 8 * * *" "Run morning briefing" --skill morning-briefing --deliver discord --model anthropic/claude-sonnet-4-6
hermes cron create "0 21 * * *" "Run evening briefing" --skill evening-briefing --deliver discord --model anthropic/claude-sonnet-4-6
```

**Skill-to-skill chaining:** Use Skill Bundles (`~/.hermes/skill-bundles/<slug>.yaml`) or write the skill body to instruct the agent to sequentially run sub-skills.

### Parallel worktree safety for P2

P2.1-P2.4 each work on different skill files — parallel-safe.
P2.5 (task-prioritization) writes `~/brain/projects/tasks.md` — ensure no other skill
write is running concurrently on GBrain.

**Done condition:** 8am briefing includes calendar events + top 5 email action items + tasks.

---

## Phase 3: Menial Tasks ⬜ IN PROGRESS (June 5, 2026)

**Goal:** agent handles routine requests. Quality firewall enforced end-to-end.

**Status:** All command skills deployed + tested. github-update fully implemented as quality firewall test skill. P3.3 gate not yet run (needs Dhruva in Discord). 747/747 contract tests passing (full suite June 8). XPosterOS integration complete. **KNOWN ISSUE:** XPosterOS workers fail every 2h — see P3.6b fix.

### P3 Tasks

```
P3.0  [OPTIONAL] AgentQL setup: install SDK, get API key           ⬜ no key yet — Exa replaces for now
P3.1  [parallel] research-synthesis skill                          ✅ deployed (Exa native content extraction, no AgentQL)
P3.2  [parallel] correction-handler skill                          ✅ deployed
P3.2b [parallel] add-task skill                                    ✅ deployed (/task command)
P3.3  [SEQUENTIAL] Quality firewall end-to-end test                ⬜ requires manual testing (Dhruva in Discord)
P3.3b github-update skill fully implemented (quality firewall test skill) ✅ deployed June 5
P3.3c GitHub MCP added to hermes config.yaml                       ✅ June 5
P3.4  [after P3.3] All 8 starting skills verified working          ⬜ pending P3.3
P3.5  [after P3.4] ntfy.sh setup for phone push notifications      ✅ COMPLETE — NTFY_TOPIC in .env, iPhone app installed + subscribed (June 2026)
P3.6  XPosterOS integration                                        ✅ complete June 5 (see HANDOFF.md XPosterOS section)
P3.7  xposteros-control contract tests                             ✅ 17/17 passing June 8 (747/747 full suite June 8)
```

### P3.6b — XPosterOS .env fix (URGENT — workers fail every 2h)

Confirmed from 10am cron output: DraftGenerator + XPoster fail with `notion_or_llm_not_configured`.
The 6 Notion DB IDs are in `~/xposteros/.env` but the API auth token and LLM keys are missing.

```bash
# SSH to Omen, then:
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"

# Copy keys from hermes .env (both already present there):
# Note: .env stores NOTION_API_KEY; Hermes config maps it to NOTION_TOKEN; use NOTION_API_KEY here
NOTION_API_KEY=$(grep "^NOTION_API_KEY=" ~/.hermes/.env | cut -d= -f2-)
ANTHRO_KEY=$(grep "^ANTHROPIC_API_KEY=" ~/.hermes/.env | cut -d= -f2-)
cat >> ~/xposteros/.env <<EOF
NOTION_API_KEY=${NOTION_API_KEY}
LLM_DEFAULT_PROVIDER=anthropic
ANTHROPIC_API_KEY=${ANTHRO_KEY}
EOF

systemctl --user restart xposteros-api
curl -s http://127.0.0.1:8081/system/health
# Next cron run (≤2h) should show DraftGenerator without notion_or_llm_not_configured
```

### P3.0 — AgentQL setup (OPTIONAL — Exa replaces for basic research)

**Status update June 2026:** research-synthesis now uses Exa's native content extraction feature.
Exa returns full article text without needing AgentQL. AgentQL is still valuable for
structured data extraction from non-article pages (dashboards, product pages, forms).

**Add AgentQL when:** research quality needs improvement on complex pages, or a new skill
needs structured form/dashboard extraction. Current research-synthesis works without it.

```bash
# When ready:
source ~/.hermes/hermes-agent/venv/bin/activate
pip install agentql

# Add to ~/.hermes/.env
AGENTQL_API_KEY=...   # sign up at agentql.com
```

### P3.1 — Research synthesis (DEPLOYED — uses Exa native content extraction)

**How it works (June 2026):**
- `/research <topic>` in Discord #research
- Step 1: GBrain search first (brain-first principle)
- Step 2-3: Exa search + Exa content fetch (full article text, no raw HTML)
- Step 4: Sonnet synthesis (known + new + open questions)
- Step 5: Write to ~/brain/resources/research-[topic]-[date].md
- Step 6: GBrain ingest of new research note (durable — before Discord)
- Step 7: Discord #research summary (≤1800 chars, notification only)

**No AgentQL needed** — Exa's `contents` parameter returns clean article text natively.

### P3.2 — Correction handler (DEPLOYED)

`/correct <text>` in Discord #corrections. Interprets correction → classifies (BEHAVIOR/FACT/PREFERENCE/FORMAT) → appends to ~/brain/concepts/corrections.md → GBrain ingest → Discord acknowledgment.

### P3.3 — Quality firewall mandatory test

**GATE: must pass before enabling any outbound skill (Phase 5).**

Run this exact sequence manually from Discord:
```
1. Send in #corrections: "/test-outbound Hello this is a test message"
2. Verify Hermes uses claude-sonnet-4-6 (check: ssh omen "tail ~/.hermes/logs/gateway.log | grep model")
3. Verify preview appears in #corrections with [APPROVAL REQUIRED] header
4. Verify Hermes is BLOCKING — message not sent without approval
5. React 👍 in #corrections → verify action executes only after approval
6. Send "/deny" on second test → verify action discarded and logged
```

**Done condition:** approval gate fires 100% of the time on outbound actions.

### P3.5 — ntfy.sh phone push setup

Free push notifications to phone for approval requests and alerts.

```bash
# Pick a random secret topic string:
NTFY_TOPIC="dhruva-alerts-$(openssl rand -hex 6)"

# Test from Omen:
ssh dhruva@omen "curl -s -d 'DhruvaOS test' ntfy.sh/$NTFY_TOPIC"

# iPhone: install ntfy app → subscribe to: ntfy.sh/$NTFY_TOPIC

# Add to ~/.hermes/.env:
NTFY_TOPIC=dhruva-alerts-xxxxxxxxxxxx
```

Use for: approval request notifications, skill errors, dream cycle failures.

**Done condition:** agent handles email triage, research, tasks without intervention.
Outbound gate fires 100% of the time.

---

## Phase 4: Self-Improving ⬜ IN PROGRESS (June 6, 2026)

**Goal:** dream cycle running nightly. Agent authors + promotes new skills autonomously.

### P4 Tasks

```
P4.1  Dream cycle crontab installed                            ✅ 3am daily (user crontab, June 5 2026)
P4.1b Embed cron at 2am                                        ✅ installed June 5 2026
P4.1c brain.pglite rolling backup cron at 4:30am              ✅ installed June 5 2026
P4.1d brain/dhruvaos/ self-documentation created + GBrain import ✅ 5 files, 45 pages total embedded
P4.1e ntfy.sh configured: NTFY_TOPIC in .env, iPhone app installed + subscribed  ✅ COMPLETE June 2026
P4.2  Knowledge graph built (gbrain extract links)             ⬜ run after brain has >100 pages (currently 45)
P4.3  Skill authoring end-to-end test                         ⬜ requires Phase 3 gate pass
P4.4  Tiered trust gate verified                               ⬜ requires Phase 3 gate pass
P4.5  Braindump questionnaire completed (see MEMORY.md)        ⬜ Dhruva does this: 30-min session
P4.6  First dream cycle on real content                        ✅ ran June 6, 2026 — all key phases ✓, 14 chunks embedded
P4.6b ~/brain git-initialized (required for sync phase)        ✅ git init + commit, gbrain sync --repo set local_path
P4.6c Legacy fact blockage fixed (extract_facts guard)         ✅ v0.32.2 migration re-run, row_num backfilled
P4.7  Brain health score ≥70 via gbrain doctor                ⬜ after P4.6
P4.8  GBrain dream phase flags enabled                         ✅ all 3 phases enabled June 6, 2026 (conversation_facts_backfill, enrich_thin, skillopt)
P4.9  stale-fact-rewrite skill deployed                        ✅ SKILL.md + Python script + 25 tests; Hermes cron 3:30am, job ID 6fc1a9ff790c
P4.10 Self-healing skill loop                                  ✅ error-detection (every 6h) + skill-proposal deployed June 6, 2026
```

### P4.0 — ntfy.sh cloud setup (prerequisite for dream cycle alerts)

No install needed. ntfy.sh is a free public service — Drew sends HTTP, phone gets push.

```bash
# Pick a random topic string (this is your "password" — keep it unpredictable):
# Example: dhruva-alerts-x7k3q9   ← replace with your own random string

# Test from Omen:
curl -d "ntfy test" ntfy.sh/dhruva-alerts-YOURSTRING
# Should appear on iPhone immediately

# iPhone setup:
# 1. Install ntfy app (App Store, free)
# 2. Server: ntfy.sh (default)
# 3. Subscribe to topic: dhruva-alerts-YOURSTRING
```

Record your topic string in `~/.hermes/.env`:
```bash
NTFY_TOPIC=dhruva-alerts-YOURSTRING
```

Self-hosted ntfy (private server on Omen + Cloudflare Tunnel) is optional — upgrade to it
if you want privacy or Cloudflare Tunnel is already running for other reasons.

### P4.8 — GBrain dream phase flags ✅ DONE (June 6, 2026)

All 3 previously-disabled dream phases enabled:
```bash
gbrain config set cycle.conversation_facts_backfill.enabled true
gbrain config set cycle.enrich_thin.enabled true
gbrain config set cycle.skillopt.enabled true
```

Also fixed — `sync` phase was failing because `~/brain` was not a git repo. Fixed:
```bash
cd ~/brain && git init && git config user.email 'dhruva@dhruvaos' && git config user.name 'Dhruva'
git add -A && git commit -m "init: initial brain content"
gbrain sync --repo /home/dhruva/brain  # sets local_path on default source
```

Also fixed — `extract_facts` was blocked by legacy facts with `row_num IS NULL`. Fixed by re-running v0.32.2 migration after setting `local_path`:
```bash
# Remove complete entry from ~/.gbrain/migrations/completed.jsonl (backed up first)
# Then: gbrain apply-migrations --yes  → v0.32.2 ran, fenced facts, assigned row_num
```

**Live dream cycle result (June 6, 2026):** all key phases ✓. 14 chunks newly embedded.
Pre-existing non-issues: lint (12 brain content formatting issues), orphans (51/52 expected for new brain), skillopt error (1 pre-existing), synthesize (needs session_corpus_dir).

**Gap vs OpenAI Dreaming V3 (June 2026):** GBrain dream organizes/links existing notes but does NOT:
- Mine conversation history for implicit facts
- Detect stale facts + rewrite them ("going to Singapore" → "went to Singapore")
- Auto-update memories as circumstances change

`conversation_facts_backfill` closes the conversation-mining gap. Stale-fact-rewrite (P4.9) closes the update gap.

### P4.9 — Stale-fact-rewrite ✅ DONE (June 6, 2026)

GBrain is a private repo (`garrytan/gbrain`) — not upstream, implemented as Hermes skill.

**Files deployed:**
- `~/.hermes/scripts/stale-fact-rewrite.py` — core Python script
- `~/.hermes/skills/dhruvaos/stale-fact-rewrite/SKILL.md` — skill definition (tier 0, outbound: false)
- `skills/dhruvaos/stale-fact-rewrite/` — repo copy with 25 tests (all passing)

**How it works:**
1. Queries active facts via `gbrain call recall`
2. Fetches entity page context via `gbrain get <entity_slug>`
3. phi4-mini (Ollama, local, free) evaluates staleness
4. For stale facts: `gbrain call forget_fact` (expire) → `gbrain call extract_facts` (insert updated)
5. Logs all rewrites to `~/.gbrain/stale-fact-rewrites.jsonl`
6. Silent on 0 rewrites (Hermes --no-agent empty stdout = silent delivery)

**Hermes cron:** 3:30am daily, job ID `6fc1a9ff790c`

**Key implementation detail:** does NOT set `is_dream_generated: true` on `extract_facts` call — that flag causes GBrain to skip extraction entirely (returns `{skipped: 'dream_generated'}`).

**Manual invocation:** Drew runs `python3 ~/.hermes/scripts/stale-fact-rewrite.py 2>&1` or `--dry-run` for preview.

Run tests: `uvx pytest skills/dhruvaos/stale-fact-rewrite/tests/ -q` (25 pass)
Full suite: `uvx pytest skills/ -q` (747 pass across all deployed skills)

### P4.10 — Self-healing + self-building skill loop

Two skills:
1. **error-detection**: cron reads `~/.hermes/logs/gateway.log`, identifies failing skills, posts to #corrections
2. **skill-proposal**: tracks unhandled Discord requests, proposes new SKILL.md drafts to #tasks for 👍 approval before deploy

`require_approval_always: true` stays. Proposal → approval → auto-deploy is the safe pattern.

### P4.1 — Dream cycle setup

**CRITICAL:** dream cron MUST include `--dir ~/brain` or synthesize/extract/lint phases are skipped (they require a local brain directory). Dry-run confirmed this June 5, 2026.

```bash
crontab -e
# Add (use full paths — cron has no PATH):
# IMPORTANT: use ~/.gbrain/gbrain-write.lock (persistent across reboots) NOT /tmp/gbrain-write.lock
0 2 * * * flock -n /home/dhruva/.gbrain/gbrain-write.lock /home/dhruva/.bun/bin/gbrain embed --stale 2>&1 | logger -t gbrain-embed
# Pipe failure to ntfy — use sh -c to capture gbrain exit code BEFORE piping to logger.
# (Piping to logger swallows gbrain's exit code; sh -c captures it in $EC first.)
# NTFY_TOPIC: set crontab env var at top of crontab: NTFY_TOPIC=<your-topic-from-~/.hermes/.env>
0 3 * * * flock -n /home/dhruva/.gbrain/gbrain-write.lock sh -c '/home/dhruva/.bun/bin/gbrain dream --dir /home/dhruva/brain; EC=$?; [ $EC -ne 0 ] && { curl -s -d "DhruvaOS: dream cycle FAILED exit=$EC" "https://ntfy.sh/${NTFY_TOPIC}" || echo "dream FAILED exit=$EC ntfy unreachable $(date)" >> /home/dhruva/.gbrain/dream-failures.log; }; exit $EC' 2>&1 | logger -t gbrain-dream
# Rolling 7-day brain.pglite backup — use flock to wait for dream to finish before copying:
30 4 * * * flock /home/dhruva/.gbrain/gbrain-write.lock cp -r /home/dhruva/.gbrain/brain.pglite /home/dhruva/.gbrain/brain.pglite.$(date +\%Y\%m\%d) && find /home/dhruva/.gbrain/ -maxdepth 1 -name 'brain.pglite.*' -mtime +7 -exec rm -rf {} +

# Verify:
gbrain dream --dry-run    # simulate 8 phases, check for errors
```

### P4.2 — Knowledge graph build

```bash
gbrain extract links --source db --dry-run   # preview — check output
gbrain extract links --source db             # commit entity graph
gbrain extract timeline --source db          # add temporal data
gbrain stats                                 # verify links > 0, entities > 0
```

### P4.3 — Skill authoring test

Give Hermes a novel task it has no skill for:
```
/hermes "how many followers does this Twitter account have: @paulg"
```

Expected behavior:
1. Hermes uses browser tool to look up the account
2. Returns the follower count
3. Writes `~/.hermes/skills/dhruvaos/twitter-follower-count/SKILL.md` with implementation
4. Repo-local contract tests pass; Hermes does not provide `--mock-tools`
5. Trust gate: read-only → auto-promotes (no DM needed)

Verify skill was written:
```bash
ls ~/.hermes/skills/    # new skill file should appear
cat ~/.hermes/skills/dhruvaos/twitter-follower-count/SKILL.md
```

### P4.4 — Trust gate verification

Test read-only auto-promotion:
```bash
# Novel read-only task → skill authored → auto-promoted
hermes mcp list    # verify new skill appears in available tools
```

Test write/shell approval gate:
```bash
# Give Hermes a task that requires creating a file
/hermes "create a file at ~/test-output.txt with today's date"
# Expect: Discord DM arrives with code preview
# Action: review the code in the DM
# Approve: /approve <skill> in DM
# Verify: file created only after approval
rm ~/test-output.txt   # clean up
```

### P4.7 — Brain health verification

```bash
gbrain doctor --remediation-plan --json    # preview what needs fixing
gbrain doctor --remediate --yes --target-score 70 --max-usd 2
# Re-run onboard check:
gbrain onboard --check --json
```

`gbrain doctor` uses GBrain's built-in repair engine. `--max-usd 2` limits spend on
LLM-powered repairs. Target score 70+ means the brain is healthy enough for daily use.

**Done condition:** dream cycle runs nightly. Novel task → skill authored + promoted.
`gbrain think "my goals"` returns coherent trajectory.

---

## Phase 5: Network Integration

**Goal:** agent drafts + posts to LinkedIn, GitHub, personal site — all through quality firewall.

Each skill in this phase: `outbound: true`, Tier 2 mandatory, approval required on every run.

### P5 Tasks

```
P5.1  [sequential] LinkedIn skill — browser-automated via local Playwright ✅ DEPLOYED June 8 (Browserbase permanently dropped)
P5.2  [sequential] GitHub skill — via GitHub MCP ✅ COMPLETE (shipped in P3 as github-update)
P5.3  [sequential] Personal site update skill ✅ DEPLOYED June 8
P5.4  [sequential] YouTube video creation skill — ContentOS, 3-approval flow ✅ DEPLOYED June 8
```

**Status:** 747/747 contract tests passing (full suite June 8). All Phase 5 skills deployed to Omen June 8 (SSH via Tailscale). xposteros-control security fix: DISCORD_ALLOWED_USER check added to approval flow.

### P5.1 — LinkedIn skill ✅ BUILT (Playwright, not Browserbase)

**Browserbase permanently dropped June 7, 2026.** LinkedIn automation uses local Playwright on Omen.

Full implementation in `skills/dhruvaos/linkedin-post/SKILL.md` v1.0.0.
- Step 0: env check (DISCORD_CORRECTIONS_CHANNEL_ID) — no Browserbase keys needed
- Step 1: 3 GBrain searches for context
- Step 2: Sonnet draft, 150-300 words, ≤3 hashtags, 0-2 emoji
- Step 3: approval_id + content_hash + expires HARD STOP in #corrections
- Step 4: Playwright headless Chromium → navigate LinkedIn → verify login → post
- Step 5: confirm or report failure
- 13 contract tests, all passing

**Deploy:**
```bash
# Install Playwright on Omen (one-time):
pip install playwright && playwright install chromium
# No Browserbase account or keys needed
```

If LinkedIn detects and blocks Playwright: add `--channel chrome` to use real Chrome binary, or add cookies/session persistence. Don't buy Browserbase preemptively.

### P5.2 — GitHub skill ✅ COMPLETE (live since Phase 3)

`github-update` deployed as P3 quality firewall test skill. GitHub MCP wired. Done.

### P5.3 — Personal site update skill ✅ BUILT

Full GitHub MCP implementation in `skills/dhruvaos/personal-site-update/SKILL.md` v1.0.0.
- Step 0: validates SITE_REPO + DISCORD_CORRECTIONS_CHANNEL_ID; parses REPO_OWNER/REPO_NAME
- Step 1: 3 GBrain searches for context
- Step 2: reads existing repo structure + format via get_file_contents
- Step 3: Sonnet draft matching existing format (Jekyll/Astro/Hugo auto-detected)
- Step 4: approval_id + content_hash + expires, slug sanitized (re.sub, no path traversal)
- Step 5: HARD STOP approval preview in #corrections
- Step 6: create_or_update_file (new) or get SHA + update (existing)
- Step 7: confirm with commit SHA + GitHub Pages URL
- 19 contract tests, all passing

**Deploy:** requires SITE_REPO env var in `~/.hermes/.env` (e.g. `SITE_REPO=Dhruva966/portfolio`).
GitHub MCP already wired from Phase 3.

### P5.4 — YouTube video creation skill ✅ BUILT (ContentOS)

Full 9-step ContentOS implementation in `skills/dhruvaos/youtube-video-create/SKILL.md` v1.0.0.
- Step 0: env check (YOUTUBE_CHANNEL_ID, FAL_KEY, DISCORD_CORRECTIONS_CHANNEL_ID)
- Step 1: 5-question interview via `clarify` tool, 30-min timeout
- Step 2: GBrain search + Exa research synthesis
- Step 3: content brief → HARD STOP approval (approval_id + sha256 + 15-min expiry)
- Step 4: full script via Sonnet (Tier 2), saved to brain/resources/youtube-scripts-{date}.md
- Step 5: script → HARD STOP approval (second gate)
- Step 6: fal.ai FLUX thumbnail (landscape_16_9, non-blocking if fails)
- Step 7: ffmpeg placeholder video (30s title card, title_escaped for filter safety)
- Step 8: upload HARD STOP → youtube-upload.py → notify /platforms/youtube/published
- Step 9: confirm with video URL to #corrections
- 40 contract tests, all passing

**Deploy:** requires YOUTUBE_CHANNEL_ID + FAL_KEY in `~/.hermes/.env`, re-run Gmail OAuth with `youtube.upload` scope, install ffmpeg + google-api libs, scp `youtube-upload.py` to `~/.hermes/scripts/` on Omen.

### P5.1 — LinkedIn Playwright setup

No MCP server needed. Playwright runs as a subprocess from the skill script.
Browserbase MCP is disabled in `~/.hermes/config.yaml` (`enabled: false`) and will not be re-enabled.

**Done condition:** each outbound skill fires quality firewall. Test with dummy content first.

---

## Phase 8: Research Compounding ✅ DEPLOYED (June 6, 2026)

5 skills deployed to Omen with cron jobs:
- **paper-monitor** (daily 7am, job 8482d6f67713): arxiv cs.AI/cs.LG/cs.CL + HN RSS → phi4 filter → Sonnet summary → brain
- **youtube-ingest** (/ingest <url>): transcript → synthesis → brain → connection-detector
- **podcast-ingest** (/ingest <audio>): whisper STT → same pipeline
- **weekly-learning-synthesis** (Sun 9pm, job a31252c957ff): brain additions → weekly digest in #briefings
- **connection-detector** (post-import trigger): surfaces 3 related concepts per new note

## Phase 9: Social Graph ✅ DEPLOYED (June 6, 2026)

4 skills deployed:
- **contact-health-check** (daily 8:30am, job d24c69d0f054): alerts on overdue relationships (>30d friend, >90d acquaintance)
- **birthday-reminder** (daily 8am, job fd5af998c518): 7-day advance + day-of alert
- **post-interaction-log** (/met <person> <notes>): logs to brain, extracts facts via GBrain
- **meeting-prep-brief** (every 60min `0 * * * *`, job 8727a655eb26): calendar lookahead → GBrain people brief. **Fixed June 7 from 30min (was burning $0.14/day).**

## Phase 10: Financial Intelligence ✅ DEPLOYED (June 6, 2026)

3 skills deployed:
- **api-cost-watchdog** (daily 9am, job ab4ab0a38953): estimates LLM spend from logs, alerts >$2/day
- **subscription-audit** (1st of month, job 104e4205bfca): known subs review with unused flagging
- **expense-monitor** (/expenses import <csv>): manual CSV categorization, no bank API

## Phase 11: Health + Wellness ✅ DEPLOYED (June 6, 2026)

3 skills deployed:
- **health-ingest** (/health import): parses Apple Health XML → weekly brain summaries
- **daily-checkin** (10pm prompt + /checkin, job 918215f0350e): 3-question log, streak tracking
- **wellness-trend** (Sun 8pm, job d42598ec4c83): 7-day health comparison in #briefings

## Phase 13: Content Pipeline ✅ DEPLOYED (June 6, 2026)

4 skills deployed:
- **content-idea-engine** (Mon 9am, job 311400ac7366): GBrain → 3-5 post ideas to #tasks
- **blog-draft** (/blog "<title>"): Sonnet draft → approval in #corrections → personal-site-update
- **x-thread-draft** (/thread "<topic>"): 5-7 tweet thread → approval → XPosterOS queue
- **content-calendar** (Mon 8:50am, job 775283a3b5e2): weekly post targets vs actuals

## Phase 14: Skill Evolution ✅ DEPLOYED (June 6, 2026)

2 skills deployed:
- **skill-analytics** (Sun 9pm, job d34a842128f0): weekly per-skill invocation/error health report
- **tier-watchdog** (daily 6am, job 197e31b8a5ce): flags >30% escalation, posts promotion command

---

## Phase 6: Voice + Mobile (future, post-UCLA move-in)

```
P6.1  STT: local Whisper (already configured — upgrade to 'small' model for accuracy)
      NVIDIA Parakeet-TDT-1.1B is the long-term upgrade target (state-of-art, ~1.5GB VRAM)
P6.2  TTS: Piper (local, CPU-only, zero VRAM) — primary option
      MiniMax TTS optional: cloud, higher quality, safe for non-sensitive text (not for notes/tasks)
P6.3  Wake: two-clap detector + 10s silence auto-off
P6.4  iPhone: geofencing via Shortcuts + webhook to Hermes
P6.5  Remote SSH access: Tailscale on Omen  ✅ done
P6.6  Twilio voice call-in: call a Twilio number → audio streams → Whisper STT → Hermes → TTS reply
      Architecture: Twilio → Hermes webhook → Whisper → skill routing → TTS → Twilio speak back
```

**STT note:** Hermes already has `stt.provider: local` with `model: base`. Upgrade to `model: small` for better accuracy. Never use MiniMax STT — voice biometrics are sensitive.

**TTS note (MiniMax):** MiniMax TTS sends text (not audio) to Chinese servers. Safe for generic/non-personal strings. Avoid for brain notes, tasks, personal context. Use Piper for those. MiniMax credentials: `MINIMAX_API_KEY` in `~/.hermes/.env` — add when ready to use. Hermes `tts.provider` config supports `minimax` natively.

**Image/video gen (MiniMax — optional, burn credits):**
- Image: `image-01` model, `POST https://api.minimax.io/v1/t2i_v2` — use for `/image` Discord command, marketing assets
- Video: Hailuo 2.3, text-to-video or image-to-video, ~1 credit/6s clip at 768p — use for demo content
- Both: zero sensitive data (prompts only), safe to use freely

### P6 — Full voice pipeline

```
[always-on mic]
  → clap detector (pyaudio, CPU, ~1% load)
  → [TWO CLAPS detected within 0.2–1.0s]
  → Parakeet STT activates
  → [speech captured]
  → Silero VAD monitors silence
  → [10 seconds no speech detected]
  → transcript sent to Hermes
  → Hermes processes (Tier 0–3 as needed)
  → response text → Piper TTS → speakers
  → back to clap detector
```

### P6.1 — STT: NVIDIA Parakeet-TDT-1.1B

```bash
pip install nemo_toolkit[asr]
# or lighter:
pip install parakeet-tdt

# Test (expects CUDA):
python -c "import nemo.collections.asr as nemo_asr; \
  model = nemo_asr.models.ASRModel.from_pretrained('nvidia/parakeet-tdt-1.1b'); \
  print(model.transcribe(['test.wav']))"
```

- VRAM: ~1.5GB on GPU. Can run CPU-only if VRAM tight (slower but acceptable)
- Accuracy: state-of-art for English, ~word-error-rate <4% on clean audio
- Latency: real-time or faster on GTX 1660 Ti
- Cost: $0, no limits

**phi4-mini + Parakeet on GTX 1660 Ti (6GB):** don't run simultaneously. Pipeline is sequential — STT finishes before Hermes calls phi4-mini. No VRAM collision.

### P6.2 — TTS: Piper (CPU, zero VRAM)

```bash
pip install piper-tts
# Download a voice model (en_US-lessac-high is natural-sounding):
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json

# Test:
echo "DhruvaOS ready." | piper --model en_US-lessac-high.onnx --output_raw | aplay -r 22050 -f S16_LE -t raw -
```

- RAM: ~200MB
- Latency: <200ms to first audio on CPU
- Cost: $0, no limits, fully offline

### P6.3 — Wake: two-clap detector + 10s silence auto-off

```python
# clap_detector.py — always-listening, CPU only
import pyaudio, numpy as np, time

RATE = 16000
CHUNK = 512
ENERGY_THRESHOLD = 2000   # tune per mic/room
CLAP_WINDOW = 1.0         # seconds between first and second clap
SILENCE_TIMEOUT = 10.0    # seconds of silence → deactivate

def detect_clap(audio_chunk):
    energy = np.abs(np.frombuffer(audio_chunk, np.int16)).mean()
    return energy > ENERGY_THRESHOLD

def run_wake_detector(on_wake_callback):
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paInt16, channels=1, rate=RATE,
                    input=True, frames_per_buffer=CHUNK)
    clap_times = []
    print("Listening for two claps...")
    while True:
        data = stream.read(CHUNK, exception_on_overflow=False)
        if detect_clap(data):
            now = time.time()
            clap_times = [t for t in clap_times if now - t < CLAP_WINDOW]
            clap_times.append(now)
            if len(clap_times) >= 2:
                clap_times.clear()
                on_wake_callback()   # → activate Parakeet STT
```

Silero VAD handles the 10s silence detection during active listening:
```bash
pip install silero-vad
```

### P6.4 — Hermes skill: voice-handler

```yaml
name: voice-handler
version: 1.0.0
tier: 0   # triage; escalates as needed
outbound: false
requires_approval: false
description: "Receive voice transcript, route to appropriate skill, respond via TTS"
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "people/*"]
  writes: []
---
Steps:
  1. Receive transcript string from STT pipeline
  2. Intent classify at Tier 0 (phi4-mini):
     - add task → add-task skill
     - research X → research-synthesis
     - whats on my cal → calendar query
     - reminder → add to tasks-inbox with due time
     - correction → correction-handler
     - general question → GBrain search + respond
  3. Run matched skill
  4. Convert response text to speech via Piper
  5. Play audio output
```

### P6.2 — STT model selection note (research context, June 2026)

Two viable approaches:
1. **faster-whisper** (current plan) — separate STT model, ~2GB VRAM, feeds text to phi4-mini
2. **Encoder-free multimodal** (emerging, e.g. Gemma 4 12B) — single model handles audio input natively, no separate STT step; lower latency pipeline

**Gemma 4 12B architecture insight:** removes audio encoder entirely, projects raw 40ms audio frames directly into LLM token space. One model for text + audio instead of whisper + LLM. Latency benefit: LLM starts processing before audio encoder finishes (encoder-free = no encoder queue).

**GTX 1660 Ti constraint:** Gemma 4 12B needs 12–16GB VRAM; GTX 1660 Ti has 6GB. Does not fit local today. Options when Phase 6 arrives:
- Use Gemma 4 12B via Google Vertex AI API (Tier 1/2, cloud inference, no local VRAM)
- Upgrade to GPU with ≥12GB VRAM (RTX 3080 Ti, 4070, etc.)
- Keep faster-whisper + phi4-mini two-model approach (works now, more infrastructure)

**Decision at Phase 6:** benchmark faster-whisper vs Gemma 4 12B API call for latency + cost. Encoder-free via API likely wins on simplicity if VRAM stays at 6GB.

### P6 — Tier 0 model note: 1-bit models

phi4-mini uses ~2.4GB VRAM on GTX 1660 Ti (6GB total). If GPU contention appears (desktop + phi4-mini + any other GPU task), consider swapping Tier 0 to a 1-bit CPU model (BitNet b1.58 3B or similar):
- Runs on CPU using 32GB system RAM — zero GPU VRAM used
- Integer arithmetic (1-bit) → CPU inference speed comparable to phi4-mini on GPU for short triage/classification tasks
- Only relevant if VRAM pressure becomes real — verify with `nvidia-smi` on Day 1 before switching

### P6.5 — Remote SSH access via Tailscale (simpler than jump-host solutions)

For SSH into Omen from anywhere (coffee shop, class, travel):

```bash
# Install Tailscale on Omen (verified June 2026):
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # prints auth URL — open in browser, authenticate with Google/GitHub

# Enable Tailscale SSH (eliminates authorized_keys management):
sudo tailscale set --ssh

# Verify:
tailscale status    # shows online + tailnet IP (100.x.x.x)
```

Then from any device (phone, laptop, coffee shop):
```bash
ssh dhruva@omen                      # MagicDNS short name (if enabled on tailnet)
ssh dhruva@<100.x.x.x>              # Tailscale IP always works
```

**Free tier (April 2026 update):** unlimited devices, up to 6 users — fully uncapped for solo use.

**CGNAT handling:** Tailscale uses STUN/ICE for direct peer-to-peer when possible, DERP relay fallback when both peers are behind symmetric NAT (common on university networks). Works automatically, no configuration needed.

**Cloudflare Tunnel** is better for exposing HTTP services publicly (web dashboard, ntfy, etc.). Add only if needed — no urgency. Both coexist fine if installed later.

---

## Zero-LLM Cron Tier (cost optimization pattern)

Not every scheduled task needs Hermes or an LLM call. Deterministic tasks = pure bash cron jobs.

| Task type | Use | Reason |
|-----------|-----|--------|
| "Is new email arrived?" | bash + Gmail API poll | No reasoning needed |
| "Calendar event in 10 min" | bash + gcal API + ntfy | Pure conditional |
| Disk / RAM health check | bash + ntfy on threshold | Arithmetic, not language |
| File existence / backup verify | bash | Trivial |
| "Did dream cycle run today?" | bash check cron log | Log grep |

These go in `/home/dhruva/scripts/` as standalone bash scripts on their own cron lines — NOT Hermes skills. Zero tokens, lower latency, no PM2 dependency.

Pattern:
```bash
#!/usr/bin/env bash
# Zero-LLM cron: check disk space, alert if >85%
USAGE=$(df /home/dhruva | awk 'NR==2 {print $5}' | tr -d '%')
[ "$USAGE" -gt 85 ] && curl -s -d "Disk ${USAGE}% full on Omen" ntfy.sh/dhruva-alerts
```

Rule: if you can write the logic in bash without any "understand this" step → don't route it through Hermes.

---


## Parallel Build Safety Rules

### SEQUENTIAL (never parallelize)

| Resource | Why |
|----------|-----|
| GBrain PGLite DB | Single-writer embedded DB; concurrent writes corrupt |
| `gbrain import`, `gbrain embed`, `gbrain dream`, `gbrain init`, `gbrain doctor` | All write to same DB |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML → Hermes fails to start |
| Hermes process restarts (`systemctl --user restart hermes-gateway`) | Must be atomic |
| Crontab edits | `crontab -e` not concurrent-safe |
| `mcp_servers:` registration | Hermes reloads config on restart — only one editor at a time |

### PARALLEL-SAFE

| Resource | Why |
|----------|-----|
| Individual skill YAML files (`skills/*.yaml`) | Different files, no shared state |
| `~/brain/**` markdown content | Files; GBrain ingests after, not during |
| Discord channel config | Documentation only |
| Provider API key testing | Tests different providers independently |
| Phase documentation (`*.md` in project root) | Pure writes |

### Git worktree pattern for parallel phases

```bash
# Create worktrees for parallel phase tasks
git worktree add ../dhruvaos-p2-email -b phase2-email-triage
git worktree add ../dhruvaos-p2-calendar -b phase2-calendar

# Each Claude Code session works in its own dir
# email-triage skill: ../dhruvaos-p2-email/skills/email-triage.yaml
# calendar skill:     ../dhruvaos-p2-calendar/skills/calendar-read.yaml

# Merge when done
git checkout main
git merge phase2-email-triage
git merge phase2-calendar
git worktree remove ../dhruvaos-p2-email
git worktree remove ../dhruvaos-p2-calendar
```

---

## Task Decomposition Template (15-minute units)

```
Task: <one verb + one noun>
Dominant risk: <what can go wrong>
Done condition: <verifiable test — command + expected output>
GBrain touch: <none | reads only | writes — if writes, coordinate>
Hermes config touch: <yes/no — if yes, serialize + restart>
Parallel-safe: <yes/no>
```

Example:
```
Task: Implement email-triage skill
Dominant risk: Gmail OAuth setup fails (credentials.json missing or wrong scope)
Done condition: repo-local contract tests pass; `/email` in Discord returns triage
GBrain touch: reads only (people/)
Hermes config touch: no
Parallel-safe: yes (skill file is independent)
```

---

## Verification Gates (must pass before advancing phase)

```bash
# Phase 0 → Phase 1
pm2 list                              # gbrain-mcp + lightpanda online
systemctl --user status hermes-gateway
hermes mcp list                       # gbrain registered
hermes mcp test gbrain                # GBrain tools discovered
ollama list                           # phi4-mini present
gbrain onboard --check --json         # all green
lightpanda --version                  # binary present

# Phase 1 → Phase 2
# Send "hello" in Discord #briefings → Hermes responds with GBrain context
gbrain search "test"                  # returns results
gbrain stats                          # entities > 0 after vault import

# Phase 2 → Phase 3
# 8am briefing fires with real calendar + email data
# /tasks in Discord → returns prioritized list

# Phase 3 → Phase 4  [HARD GATE]
# Quality firewall test (P3.3) MUST PASS completely
# No Phase 4 skills enabled until firewall verified

# Phase 4 → Phase 5
gbrain think "my goals"               # returns trajectory (not empty)
# Novel task → skill authored in ~/.hermes/skills/
gbrain doctor --json | jq .score      # score ≥ 70

# Phase 5 → done
# Each outbound skill: test post → firewall fires → approve → verify sent
```

---

## Phase V: Visual + Voice Layer ✅ IN PROGRESS (jarvis-voice neural brain complete)

**Goal:** Everything you can actually see and hear. DhruvaOS control panel, Drew avatar with animations, voice interface, dynamic configuration from UI. Make the system feel alive.

**Critical path:** V1 (Cloudflare Tunnel) ✅ DONE. jarvis-voice neural brain UI ✅ DONE.

### jarvis-voice neural brain — COMPLETE (June 8, 2026)

Full biorealistic fluorescence neuron visualization. Key decisions:
- **Single neuron** (not a network) — one soma + dendritic tree + axon
- **GFP/CFP/YFP palette** — authentic fluorescence wavelengths
- **Vertex-colour taper** — branches dim from base to tip (confocal microscopy look)
- **Biological detail**: dendritic spines, synaptic boutons, Nodes of Ranvier, organelles, nucleolus
- **Action potentials**: InstancedMesh sparks traveling CatmullRomCurve3 paths, voice-triggered
- **Postprocessing**: layered Bloom × 2, ChromaticAberration, Vignette
- **AUDIO_BANDS singleton**: zero-lag audio reactivity (bypasses React batching)
- **PR**: https://github.com/Dhruva966/DhruvaOS-Mark2/pull/6

**Remaining for Phase V:**

**Do this before building UI:** Ingest GBrain braindump (`wiki/braindump-questions.md` Section 1 answers already filled). Drew knows almost nothing personal — ingest first so the UI reflects a live, context-aware agent.

---

### V1: Cloudflare Tunnel ⬜ PREREQUISITE (30 min)

Expose Omen APIs publicly with Cloudflare Access auth (only your Google account can reach them).

**You need:** Cloudflare account + domain (or use free `.trycloudflare.com` — no domain needed for testing).

```bash
# On Omen:
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo apt-key add -
echo "deb https://pkg.cloudflare.com/cloudflared focal main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Authenticate (opens browser on Mac — paste URL):
cloudflared tunnel login

# Create named tunnel:
cloudflared tunnel create dhruvaos

# Configure routes (edit ~/.cloudflared/config.yml):
# tunnel: <tunnel-id>
# credentials-file: /home/dhruva/.cloudflared/<id>.json
# ingress:
#   - hostname: api.dhruvaos.app
#     service: http://localhost:8642
#   - hostname: xposteros.dhruvaos.app
#     service: http://localhost:8000
#   - hostname: gbrain.dhruvaos.app
#     service: http://localhost:3131
#   - service: http_status:404

# Add DNS routes:
cloudflared tunnel route dns dhruvaos api.dhruvaos.app
cloudflared tunnel route dns dhruvaos xposteros.dhruvaos.app

# Install as systemd service:
sudo cloudflared service install
sudo systemctl start cloudflared
```

**Done condition:** `curl https://api.dhruvaos.app/health` returns Hermes health from Mac or phone.

**Free `.trycloudflare.com` alternative (zero config, temporary URL):**
```bash
cloudflared tunnel --url http://localhost:8642
# Prints a random URL like https://random-name.trycloudflare.com
# Use that as your API base URL for testing before getting a domain
```

---

### V2: DhruvaOS Control Panel ⬜ (4 hours)

Single-page dashboard served from Vercel (Next.js), talking to Omen via Cloudflare Tunnel. Extend XPosterOS web (`~/xposteros/web/`) with a `/drew` route.

**What you can see:**
- Drew status card — provider (Gemini/Anthropic), uptime, active model, last task, last 5 Discord messages
- Cron jobs panel — all active schedules, next run, last result, enable/disable toggle
- GBrain stats — entry count, last dream, last embed, recent memories
- System health — Hermes ✅/❌, GBrain ✅/❌, Ollama ✅/❌, all providers

**What you can change from UI (dynamic + malleable):**
- Enable/disable individual crons
- Change cron schedule (inline edit)
- Switch Drew's active model/provider
- Flip XPOSTER_DRY_RUN
- Trigger manual skill runs

**API endpoints to add to Hermes/XPosterOS:**
```
GET  /drew/status      → provider, uptime, model, last task
GET  /drew/crons       → all cron jobs with schedule, last run, status
POST /drew/crons/:id   → update schedule or enabled state
GET  /drew/health      → all subsystem health
GET  /drew/memory      → recent GBrain entries (last 10)
```

---

### V3: Drew Avatar + Animations ⬜ (3 hours)

Jarvis-inspired liquid glass orb. Lives in the control panel header.

**States:**
| State | Visual | When |
|-------|--------|------|
| Idle | Slow breathing pulse, translucent glass ring, ambient blue glow | No active task |
| Thinking | Spinning arc segments, faster pulse, "Processing…" subtitle | Skill running |
| Speaking | Audio waveform rippling through glass | TTS playing |
| Alert | Red edge glow, pulsing | Credit depleted, dream failed, error |
| Offline | Grey, no glow, "Drew is offline" | Hermes down |

**Tech stack:**
- CSS `@keyframes` + `backdrop-filter: blur(12px)` for glass morphism
- Canvas API for waveform visualizer during speech
- Framer Motion for state transitions
- Poll `/drew/status` every 5s to update state

**Color palette:** deep navy (`#0a0f1e`) + electric blue (`#4facfe`) + white glass (`rgba(255,255,255,0.08)`)

---

### V4: Voice Interface ⬜ (3 hours)

Hermes TTS is already configured (`edge` provider, `en-US-AriaNeural`). Wire it to the web.

**Quick win first (no build):** Enable `auto_tts: true` in `~/.hermes/config.yaml` → Drew speaks all Discord responses immediately. Test quality before building web interface.

**Web voice flow:**
1. Hold mic button in browser → Web Audio API records
2. POST audio blob to new Hermes endpoint `/voice/input`
3. Hermes processes → returns text response + TTS audio URL
4. Audio plays in browser → Drew avatar animates to Speaking state

**Voice quality options (in order of quality):**
1. `edge` (current, free) — en-US-AriaNeural sounds like Cortana
2. `elevenlabs` (configured, needs API key) — sounds like actual Jarvis, ~$0.18/1k chars
3. `minimax` (credits available) — Chinese server, don't use for personal content

**ElevenLabs setup (recommended for "wow" factor):**
```bash
# Add to ~/.hermes/.env:
ELEVENLABS_API_KEY=...
# In config.yaml:
# tts:
#   provider: elevenlabs
#   elevenlabs:
#     voice_id: pNInz6obpgDQGcFmaJgB  (already set — Adam voice)
```

**Done condition:** hold mic on web → speak → hear Drew respond through browser speakers, avatar animates.

---

### V5: Dynamic Config + Brain Dump UI ⬜ (2 hours)

Make everything editable without SSH:

- **Skill parameter editor** — edit key values in skill YAML from web form (thresholds, contact lists, notification targets)
- **Brain dump form** — submit answers to braindump-questions.md directly from dashboard → auto-formats + POSTs to `/drew/brain-dump` → GBrain ingest
- **Memory viewer** — browse GBrain entries by tag, search by topic, see what Drew actually knows
- **Personality switcher** — dropdown to change Drew's active persona (helpful/concise/technical/kawaii etc.)

**Brain dump endpoint (add to XPosterOS or new Hermes route):**
```
POST /drew/brain-dump
Body: { section: "identity", question: "Who are you?", answer: "..." }
Action: format as brain markdown → write to ~/brain/about/dhruva-{section}.md → gbrain import
```

---

### Phase V Verification Gates

```bash
# V1 done:
curl https://api.dhruvaos.app/health   # returns from Mac or phone

# V2 done:
# Open dashboard on phone → see Drew status + all crons
# Toggle a cron from UI → hermes cron list confirms change

# V3 done:
# Trigger a skill run → avatar animates to Thinking state
# Skill completes → avatar returns to Idle

# V4 done:
# Hold mic, say "what's on my calendar" → hear Drew respond (spoken)
# Avatar animates to Speaking during audio playback

# V5 done:
# Submit braindump answer from UI → gbrain search returns it
# Change personality from dropdown → Drew's next Discord message reflects it
```

---

### GitHub Actions Auto-Deploy (pending)

Workflow file created at `~/xposteros/.github/workflows/deploy.yml` (committed, NOT yet pushed). Runner software at `~/actions-runner-xposteros/`.

**To complete (user tasks):**
1. Regenerate GitHub PAT with `workflow` scope at github.com/settings/tokens
2. Update git remote: `git -C ~/xposteros remote set-url origin "https://Dhruva966:NEW_PAT@github.com/Dhruva966/linkedIn-XPoster.git"` → `git push origin main`
3. Get runner token: github.com/Dhruva966/linkedIn-XPoster → Settings → Actions → Runners → New → Linux x64 → copy token
4. On Omen: `bash ~/setup-runner.sh PASTE_TOKEN`
5. Security fix: `git -C ~/xposteros remote set-url origin "https://github.com/Dhruva966/linkedIn-XPoster.git"` (remove PAT from URL)

**Security note:** current PAT is embedded in git remote URL plaintext (`git -C ~/xposteros remote -v` exposes it). Fix ASAP after regenerating.

**Once running:** every `git push` from Codex → Omen auto-pulls + restarts workers in ~30 seconds. Cost: $0.
