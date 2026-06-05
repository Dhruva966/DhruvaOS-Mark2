# DhruvaOS Mark 2 — Build Plan

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
| P0.9 | Install GBrain 0.42.25.0 | `gbrain --version` | ✅ |
| P0.10 | Scaffold `~/brain/` + GBrain init | `gbrain init` succeeded | ✅ |
| P0.11 | Write `~/.gbrain/config.json` (ollama embedding) | config in place | ✅ |
| P0.12 | Run `gbrain onboard --check --json` | checks green | ✅ |
| P0.13 | Create Discord bot (drew#4878) + 6 channels | bot connected | ✅ |
| P0.14 | Create `~/.hermes/.env` (chmod 600) | keys in place | ✅ |
| P0.15 | Write `~/.hermes/config.yaml` | 4-tier routing configured | ✅ |
| P0.16 | Install Lightpanda binary | `lightpanda --version` returns; PM2 shows `lightpanda` online at :9222 |
| P0.17 | Start GBrain HTTP server via PM2 | `pm2 list` shows `gbrain-mcp` online |
| P0.18 | Start Hermes gateway via systemd user service | `systemctl --user status hermes-gateway` = active |
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
*/5 * * * * flock -n /tmp/gbrain-write.lock sh -lc 'cd /home/dhruva/brain && git pull --ff-only && /home/dhruva/.bun/bin/gbrain embed --stale'
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
- **Notion Tasks DB:** `NOTION_TASKS_DB_ID=d5257e87-f58d-4dc4-ae2f-4b969af052e7` (current value = Snoopy AI schema — replace with proper DhruvaOS Tasks DB once created)

---

## Phase 2: Inbox ⬜ IN PROGRESS (June 5, 2026)

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

**Status:** research-synthesis, correction-handler, add-task deployed as P2.E extras.
Quality firewall test and outbound skills still needed.

### P3 Tasks

```
P3.0  [OPTIONAL] AgentQL setup: install SDK, get API key           ⬜ no key yet — Exa replaces for now
P3.1  [parallel] research-synthesis skill                          ✅ deployed (Exa native content extraction, no AgentQL)
P3.2  [parallel] correction-handler skill                          ✅ deployed
P3.2b [parallel] add-task skill                                    ✅ deployed (/task command)
P3.3  [SEQUENTIAL] Quality firewall end-to-end test                ⬜ requires manual testing (Dhruva)
P3.4  [after P3.3] All 8 starting skills verified working          ⬜ pending P3.3
P3.5  [after P3.4] ntfy.sh setup for phone push notifications      ⬜ needs NTFY_TOPIC set
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

## Phase 4: Self-Improving ⬜ PLANNED (starts after Phase 3 gate passes)

**Goal:** dream cycle running nightly. Agent authors + promotes new skills autonomously.

### P4 Tasks

```
P4.1  Dream cycle crontab installed                            ✅ 3am daily via system crontab
P4.2  Knowledge graph built (gbrain extract links)             ⬜ run after brain has >100 pages
P4.3  Skill authoring end-to-end test                         ⬜ requires Phase 3 gate pass
P4.4  Tiered trust gate verified                               ⬜ requires Phase 3 gate pass
P4.5  Braindump questionnaire completed (see MEMORY.md)        ⬜ Dhruva does this: 30-min session
P4.6  First dream cycle on real content                        ⬜ runs at 3am automatically
P4.7  Brain health score ≥70 via gbrain doctor                ⬜ after P4.6
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

### P4.1 — Dream cycle setup

```bash
crontab -e
# Add (use full paths — cron has no PATH):
0 2 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain embed --stale
# Pipe failure to ntfy so silent crashes are visible:
0 3 * * * flock -n /tmp/gbrain-write.lock sh -lc '/home/dhruva/.bun/bin/gbrain dream || curl -s -d "dream cycle FAILED — check: pm2 logs gbrain-mcp" ntfy.sh/dhruva-alerts-YOURSTRING'
# Rolling 7-day brain.pglite backup (run after dream cycle completes):
30 4 * * * cp -r /home/dhruva/.gbrain/brain.pglite /home/dhruva/.gbrain/brain.pglite.$(date +\%Y\%m\%d) && find /home/dhruva/.gbrain/ -maxdepth 1 -name 'brain.pglite.*' -mtime +7 -exec rm -rf {} +

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
P5.1  [sequential] LinkedIn skill — browser-automated via Browserbase
P5.2  [sequential] GitHub skill — via GitHub MCP
P5.3  [sequential] Personal site update skill
```

### P5.1 — LinkedIn skill implementation

No official LinkedIn API for posting. Use Browserbase (cloud browser) or Playwright:
```yaml
# Add to mcp_servers: in config.yaml
mcp_servers:
  browserbase:
    command: npx
    args: ["-y", "@browserbase/mcp-server-browserbase"]
    env:
      BROWSERBASE_API_KEY: "${BROWSERBASE_API_KEY}"
      BROWSERBASE_PROJECT_ID: "${BROWSERBASE_PROJECT_ID}"
```

Skill flow: draft post (Tier 2 Sonnet) → preview in #corrections → Dhruva approves → browser automation posts.

### P5.2 — GitHub skill

GitHub has an official MCP server:
```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
```

Verify:
```bash
hermes mcp test github    # confirms repos, issues, PRs tools discovered
```

**Done condition:** each outbound skill fires quality firewall. Test with dummy content first.

---

## Phase 6: Voice + Mobile (future, post-UCLA move-in)

```
P6.1  STT: NVIDIA Parakeet-TDT-1.1B (local, GPU or CPU fallback)
P6.2  TTS: Piper (local, CPU-only, zero VRAM)
P6.3  Wake: two-clap detector + 10s silence auto-off
P6.4  iPhone: geofencing via Shortcuts + webhook to Hermes
P6.5  Remote SSH access: Tailscale on Omen
```

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
