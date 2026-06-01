# DhruvaOS Mark 2 — Build Plan

## Philosophy

Mark 1 planned 7 phases. Mark 2 uses the same phase structure, re-scoped for Hermes + GBrain.
The custom infrastructure (FastAPI, Mem0, Qdrant, Graphify) is gone — replaced by Hermes and
GBrain that are installed, not built. Phase 0 is an install+wire task, not a build task.

Build effort concentrates in Phase 2+ (skills) and Phase 4 (self-improving loop).

---

## Phase 0: Infrastructure (SEQUENTIAL — everything depends on this)

All tasks sequential. No parallelism. Phase 1 cannot start until P0.18 is green.

### P0 Task Table

| Task | Command / Action | Done condition |
|------|-----------------|----------------|
| P0.1 | Create `dhruvaos` non-root user | `id dhruvaos` returns user |
| P0.2 | Install Python 3.11+ via apt | `python3.11 --version` ≥3.11 |
| P0.3 | Install Bun ≥1.3.10 | `bun --version` ≥1.3.10 |
| P0.4 | Install Node v24 via nvm | `node --version` = v24.x |
| P0.5 | Install pm2 globally | `pm2 --version` returns |
| P0.6 | Install Ollama (systemd auto-start) | `systemctl status ollama` = active |
| P0.7 | Pull phi4-mini | `ollama list` shows phi4-mini |
| P0.8 | Install Hermes via official installer | `hermes --version` returns |
| P0.9 | Install GBrain ≥0.42.1.0 | `gbrain --version` shows version |
| P0.10 | Scaffold `~/brain/` + GBrain init | `gbrain init` succeeds |
| P0.11 | Write `~/.gbrain/config.json` | see MEMORY.md |
| P0.12 | Run `gbrain onboard --check --json` | all checks green |
| P0.13 | Create Discord bot + 6 channels | Bot token obtained, channels exist |
| P0.14 | Create `~/.config/dhruvaos/.env` (chmod 600) | permissions 600 |
| P0.15 | Write `~/.hermes/config.yaml` | see MODEL_ROUTING.md + MCP section below |
| P0.16 | Start GBrain HTTP server via PM2 | `pm2 list` shows `gbrain-mcp` online |
| P0.17 | Start Hermes via PM2 | `pm2 list` shows `hermes` online |
| P0.18 | Security hardening complete | AppArmor, UFW, auditd, YOLO=false, sudo removed from dhruvaos |

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
gbrain init       # initializes PGLite schema at ~/.gbrain/brain.db
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

### P0.16-17 — PM2 startup

```bash
# GBrain HTTP mode — PM2 daemon is safe because HTTP (not stdio pipe)
pm2 start "/home/dhruvaos/.bun/bin/gbrain serve --http --port 3131" --name gbrain-mcp

# Hermes
pm2 start "hermes" --name hermes    # if installed via official installer
# or if manual install:
pm2 start "~/.hermes-src/.venv/bin/python ~/.hermes-src/run_agent.py" --name hermes

pm2 startup && pm2 save
```

---

## Phase 1: Alive

**Goal:** Hermes responds in Discord. GBrain MCP connected. Brain has initial content.

### P1 Tasks

```
P1.1  [parallel] Hermes Discord end-to-end test
P1.2  [parallel] phi4-mini Tier 0 routing verified
P1.3  [parallel] Claude Sonnet Tier 2 verified
P1.4  [parallel] Claude Opus Tier 3 verified
P1.5  [SEQUENTIAL] GBrain MCP connection verified
P1.6  [SEQUENTIAL after P1.5] Obsidian vault imported into GBrain
P1.7  [after P1.6] GBrain built-in skills active (signal-detector, brain-ops)
P1.8  [after P1.7] Morning briefing stub fires at 8am
```

P1.1-P1.4 parallel-safe (different providers, no shared state).
P1.5 + P1.6 sequential (both write to GBrain PGLite DB).

### P1.5 — GBrain MCP verification

```bash
hermes mcp list          # shows registered MCP servers — gbrain should appear
hermes mcp test gbrain   # confirms tools discovered (search, think, ingest, etc.)
```

Expected output from `hermes mcp test gbrain`:
```
✓ Connected to gbrain at http://localhost:3131/mcp
✓ Tools discovered: search, think, ingest, embed, dream, onboard
```

If this fails: `pm2 logs gbrain-mcp --lines 50` to debug.

### P1.6 — Obsidian vault import

```bash
gbrain import ~/path/to/obsidian-vault --no-embed
gbrain embed --stale
gbrain onboard --check --json    # verify all checks green
gbrain extract links --source db
gbrain extract timeline --source db
gbrain stats                     # verify links > 0
```

### P1.7 — GBrain built-in skills

GBrain ships 43 bundled skills. Scaffold them to the Hermes agent workspace:
```bash
gbrain skillpack scaffold --all
```

Verify signal-detector is active:
- Send a message with a named person or project to #briefings
- Check GBrain: `gbrain search "<person name>"` — should return an entry

**Done condition:** Dhruva sends "hello" in #briefings → Hermes responds using GBrain context.

---

## Phase 2: Inbox

**Goal:** email triage works, calendar read, morning briefing has real content.

### P2 Tasks

```
P2.1  [parallel] email-triage skill: implement + test
P2.2  [parallel] calendar skill: implement + test
P2.3  [parallel] morning-briefing skill: stub → full implementation
P2.4  [parallel] evening-briefing skill: stub → full implementation
P2.5  [after P2.1-P2.4] task-prioritization skill: implement + test
P2.6  [after P2.5] Morning briefing fires with real email + calendar data
```

### P2.1 — Email triage implementation detail

**Gmail has no pre-built Hermes MCP.** Use Google API OAuth directly in the skill.

Required setup before implementing the skill:
1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Download `credentials.json` → store at `~/.config/dhruvaos/gmail-credentials.json` (chmod 600)
5. Add to `.env`: `GOOGLE_CLIENT_ID=...`, `GOOGLE_CLIENT_SECRET=...`
6. First run does OAuth flow (open browser, grant access, token saved)

Alternatively: register a community Gmail MCP server in `mcp_servers:` if one exists upstream.

Skill implementation uses:
```python
# In skill body — calls Google API directly
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
# Credentials managed by Hermes tool execution context
```

### P2.2 — Calendar skill

Google Calendar API — same OAuth flow as Gmail (same Google Cloud project).
Add `calendar.readonly` scope to the OAuth credentials from P2.1.

```python
# Calendar API call in skill
service = build('calendar', 'v3', credentials=creds)
events = service.events().list(calendarId='primary', timeMin=now, maxResults=10).execute()
```

### Parallel worktree safety for P2

P2.1-P2.4 each work on different skill YAML files — parallel-safe.
P2.5 (task-prioritization) writes `~/brain/projects/tasks.md` — ensure no other skill
write is running concurrently on GBrain.

**Done condition:** 8am briefing includes calendar events + top 5 email action items + tasks.

---

## Phase 3: Menial Tasks

**Goal:** agent handles routine requests. Quality firewall enforced end-to-end.

### P3 Tasks

```
P3.1  [parallel] research-synthesis skill: implement + test
P3.2  [parallel] correction-handler skill: implement + test
P3.3  [SEQUENTIAL] Quality firewall end-to-end test (gate — must pass before Phase 4)
P3.4  [after P3.3] All 8 starting skills verified working
```

### P3.1 — Research synthesis implementation detail

Uses Exa + Firecrawl. Exa is built into Hermes tools. Add to `.env`:
```bash
EXA_API_KEY=...
FIRECRAWL_API_KEY=...   # optional — Exa alone covers most cases
```

Brain-first check before any web search:
```python
# Always check GBrain first
brain_result = await hermes.tools.gbrain.search(query)
if brain_result.confidence > 0.8:
    return brain_result  # skip web search
# else: proceed to Exa
```

### P3.3 — Quality firewall mandatory test

Before enabling ANY outbound skill, run this exact sequence:

```
1. Send to Hermes in #corrections: "/test-outbound Hello this is a test message"
2. Verify Hermes uses claude-sonnet-4-6 (check logs: model=claude-sonnet-4-6)
3. Verify preview appears in #corrections with [APPROVAL REQUIRED] header
4. Verify Hermes is BLOCKING — does not send without approval
5. React 👍 in #corrections
6. Verify action executed only after your approval
7. Send "/deny" in #corrections on a second test
8. Verify action was discarded and logged
```

**This gate must pass before Phase 4.** No outbound skill active until verified.

**Done condition:** agent handles email triage, research, tasks without intervention.
Outbound gate fires 100% of the time.

---

## Phase 4: Self-Improving

**Goal:** dream cycle running nightly. Agent authors + promotes new skills autonomously.

### P4 Tasks

```
P4.1  [sequential] Dream cycle crontab installed + verified
P4.2  [sequential] Knowledge graph built (gbrain extract links)
P4.3  [sequential] Skill authoring end-to-end test
P4.4  [sequential] Tiered trust gate verified
P4.5  [after P4.3] Braindump questionnaire completed (see MEMORY.md)
P4.6  [after P4.4] First dream cycle on real content
P4.7  [after P4.6] Brain health score ≥70 via gbrain doctor
```

### P4.1 — Dream cycle setup

```bash
crontab -e
# Add:
0 2 * * * /home/dhruvaos/.bun/bin/gbrain embed --stale
0 3 * * * /home/dhruvaos/.bun/bin/gbrain dream

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
3. Writes `~/.hermes/skills/twitter-follower-count.yaml` with implementation
4. Quality gate runs: `pytest tests/ --mock-tools` passes
5. Trust gate: read-only → auto-promotes (no DM needed)

Verify skill was written:
```bash
ls ~/.hermes/skills/    # new skill file should appear
cat ~/.hermes/skills/twitter-follower-count.yaml
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

Extension points in architecture already exist.

```
P6.1  TTS: Piper (local, GPU) or ElevenLabs (cloud)
P6.2  STT: faster-whisper (local, RTX 2060 accelerated)
P6.3  Wake word: local always-listening detection
P6.4  iPhone: geofencing via Shortcuts + webhook to Hermes
```

---

## Parallel Build Safety Rules

### SEQUENTIAL (never parallelize)

| Resource | Why |
|----------|-----|
| GBrain PGLite DB | Single-writer embedded DB; concurrent writes corrupt |
| `gbrain import`, `gbrain embed`, `gbrain dream`, `gbrain init`, `gbrain doctor` | All write to same DB |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML → Hermes fails to start |
| Hermes process restarts (`pm2 restart hermes`) | Must be atomic |
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
# calendar skill:     ../dhruvaos-p2-calendar/skills/calendar.yaml

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
Done condition: pytest tests/email-triage/ --mock-tools passes; /email in Discord returns triage
GBrain touch: reads only (people/)
Hermes config touch: no
Parallel-safe: yes (skill file is independent)
```

---

## Verification Gates (must pass before advancing phase)

```bash
# Phase 0 → Phase 1
pm2 list                              # hermes + gbrain-mcp both online
hermes mcp list                       # gbrain registered
hermes mcp test gbrain                # GBrain tools discovered
ollama list                           # phi4-mini present
gbrain onboard --check --json         # all green

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
