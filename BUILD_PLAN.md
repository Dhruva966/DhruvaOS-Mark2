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
| P0.18 | Start Hermes via PM2 | `pm2 list` shows `hermes` online |
| P0.19 | Security hardening complete | AppArmor, UFW, auditd, YOLO=false, sudo removed from dhruvaos |

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

### P0.17-18 — PM2 startup

```bash
# Lightpanda CDP server (Hermes connects via WebSocket)
pm2 start "lightpanda --host 127.0.0.1 --port 9222" --name lightpanda

# GBrain HTTP mode — PM2 daemon is safe because HTTP (not stdio pipe)
pm2 start "/home/dhruvaos/.bun/bin/gbrain serve --http --port 3131 --host 127.0.0.1" --name gbrain-mcp

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
*/5 * * * * cd /home/dhruvaos/brain && git pull --ff-only && /home/dhruvaos/.bun/bin/gbrain embed --stale
```

Install Obsidian Git plugin on Mac → auto-commit every 5 min.

### P1.6 — Obsidian vault import

**Vault confirmed:** `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/dhruva's wiki` (iCloud-synced, on Mac)

Copy vault to Omen before importing (run on Mac):
```bash
VAULT="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/dhruva's wiki"
rsync -av "$VAULT/" dhruvaos@<omen-ip>:/home/dhruvaos/brain/
```

Then on Omen, initialize git sync (see MEMORY.md → Brain Sync Architecture):
```bash
cd ~/brain && git init
git remote add origin git@github.com:Dhruva966/dhruvaos-brain.git
git add . && git commit -m "initial import from obsidian vault" && git push -u origin main
```

Then import into GBrain:
```bash
gbrain import ~/brain --no-embed
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

### P2.0 — Notion database setup (one-time, do before P2.1)

Create the 4 core databases in Notion. Use Notion AI or the MCP tools to scaffold them:

1. **Tasks** — Name (title), Status (select), Priority (select), Due (date), Project (relation), Source (select)
2. **Projects** — Name (title), Status (select), Area (select), Tasks (relation+rollup), Notes URL
3. **People** — Name (title), Company (relation), Role (text), Last Contact (date), Brain File URL
4. **Daily Briefings** — Date (title), Type (select: Morning/Evening), Summary (text), Discord Link (URL)

Store database IDs in `.env`:
```bash
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
      NOTION_API_KEY: "${NOTION_API_KEY}"
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
P3.0  [SEQUENTIAL first] AgentQL setup: install SDK, get API key, verify
P3.1  [parallel] research-synthesis skill: implement + test (uses AgentQL)
P3.2  [parallel] correction-handler skill: implement + test
P3.3  [SEQUENTIAL] Quality firewall end-to-end test (gate — must pass before Phase 4)
P3.4  [after P3.3] All 8 starting skills verified working
```

### P3.0 — AgentQL setup

AgentQL replaces raw HTML extraction in all browser-reading skills. Prevents 10k-50k token
page dumps from reaching Sonnet.

```bash
# Install in Hermes venv
source ~/.hermes-src/.venv/bin/activate
pip install agentql

# Add to .env
AGENTQL_API_KEY=...   # sign up at agentql.com — free tier: 50 calls/mo, then $0.02/call
```

Verify:
```python
import agentql
# Should import without error; no API call at import time
print(agentql.__version__)
```

**Token math:** 1 research run (5 pages) without AgentQL → ~$0.45 Sonnet cost.
With AgentQL → ~$0.10 total. Pays for itself at >3 research runs/week.

### P3.1 — Research synthesis implementation detail

Uses Exa + AgentQL. Exa finds sources; AgentQL extracts structured content from each page.
Add to `.env`:
```bash
EXA_API_KEY=...
AGENTQL_API_KEY=...   # required for structured extraction (see P3.0)
# FIRECRAWL_API_KEY no longer needed — AgentQL replaces it for article extraction
```

Brain-first check before any web search:
```python
# Always check GBrain first
brain_result = await hermes.tools.gbrain.search(query)
if brain_result.confidence > 0.8:
    return brain_result  # skip web search
# else: proceed to Exa + AgentQL extraction
```

AgentQL extraction pattern (used inside research-synthesis):
```python
import agentql
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # Lightpanda CDP endpoint — fast, low RAM
    browser = p.chromium.connect_over_cdp("ws://127.0.0.1:9222")
    page = agentql.wrap(browser.new_page())
    page.goto(article_url)
    data = page.query_data("""
    {
        title
        author
        published_date
        key_points[]
        summary
    }
    """)
    # data is a dict — send to Sonnet as JSON, not raw HTML
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

Note: The phase0-setup.sh script now installs the dream cycle crontab automatically.
If installing manually:

```bash
crontab -e
# Add (use full paths — cron has no PATH):
0 2 * * * /home/dhruvaos/.bun/bin/gbrain embed --stale
# Pipe failure to ntfy so silent crashes are visible:
0 3 * * * /home/dhruvaos/.bun/bin/gbrain dream || curl -s -d "dream cycle FAILED" ntfy.sh/dhruva-alerts
# Rolling 7-day brain.db backup (run after dream cycle completes):
30 4 * * * cp /home/dhruvaos/.gbrain/brain.db /home/dhruvaos/.gbrain/brain.db.$(date +\%Y\%m\%d) && find /home/dhruvaos/.gbrain/ -name 'brain.db.*' -mtime +7 -delete

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
- Latency: real-time or faster on RTX 2060
- Cost: $0, no limits

**phi4-mini + Parakeet on RTX 2060 (6GB):** don't run simultaneously. Pipeline is sequential — STT finishes before Hermes calls phi4-mini. No VRAM collision.

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

**RTX 2060 constraint:** Gemma 4 12B needs 12–16GB VRAM; RTX 2060 has 6GB. Does not fit local today. Options when Phase 6 arrives:
- Use Gemma 4 12B via Google Vertex AI API (Tier 1/2, cloud inference, no local VRAM)
- Upgrade to GPU with ≥12GB VRAM (RTX 3080 Ti, 4070, etc.)
- Keep faster-whisper + phi4-mini two-model approach (works now, more infrastructure)

**Decision at Phase 6:** benchmark faster-whisper vs Gemma 4 12B API call for latency + cost. Encoder-free via API likely wins on simplicity if VRAM stays at 6GB.

### P6 — Tier 0 model note: 1-bit models

phi4-mini uses ~2.4GB VRAM on RTX 2060 (6GB total). If GPU contention appears (desktop + phi4-mini + any other GPU task), consider swapping Tier 0 to a 1-bit CPU model (BitNet b1.58 3B or similar):
- Runs on CPU using 32GB system RAM — zero GPU VRAM used
- Integer arithmetic (1-bit) → CPU inference speed comparable to phi4-mini on GPU for short triage/classification tasks
- Only relevant if VRAM pressure becomes real — verify with `nvidia-smi` on Day 1 before switching

### P6.5 — Remote SSH access via Tailscale (simpler than jump-host solutions)

For SSH into Omen from anywhere (coffee shop, class, travel):

```bash
# Install Tailscale on Omen (run as dhruvaos or admin)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Get stable hostname:
tailscale status | grep omen
```

Then from any device (phone, laptop, another machine):
```bash
ssh dhruvaos@<omen-hostname>.ts.net
```

Tailscale punches through university CGNAT the same way Cloudflare Tunnel does — no open inbound ports needed. This replaces the Cloudflare Tunnel for SSH use cases.

**Why not pi-remote-bridge (or similar jump-host setups):** those are for machines you can't directly install Tailscale on. You can install directly on the Omen — a Pi jump host adds hardware complexity for no benefit here.

**Cloudflare Tunnel stays** for HTTP services (GBrain external access if ever needed, ntfy, etc.). Tailscale is for SSH. Both coexist fine.

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

These go in `/home/dhruvaos/scripts/` as standalone bash scripts on their own cron lines — NOT Hermes skills. Zero tokens, lower latency, no PM2 dependency.

Pattern:
```bash
#!/usr/bin/env bash
# Zero-LLM cron: check disk space, alert if >85%
USAGE=$(df /home/dhruvaos | awk 'NR==2 {print $5}' | tr -d '%')
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
pm2 list                              # hermes + gbrain-mcp + lightpanda all online
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
