# DhruvaOS Mark 2 — Build Plan (Active)

> Active work only. Completed phases are stubs. Full historical runbooks in `BUILD_PLAN_PART1.md`.

---

## Phase Status Overview

| Phase | Name | Status | Date |
|-------|------|--------|------|
| 0 | Infrastructure | ✅ COMPLETE | June 4, 2026 |
| 1 | Alive | ✅ COMPLETE | June 5, 2026 |
| 2 | Inbox | ✅ COMPLETE | June 5, 2026 |
| 3 | Menial Tasks | ✅ COMPLETE | June 5–6, 2026 |
| 4 | Self-Improving | ✅ COMPLETE | June 6, 2026 |
| 5 | Network Integration | 🚧 PARTIAL | June 8, 2026 |
| V | Visual + Voice Layer | ✅ COMPLETE | June 8, 2026 |
| 6 | Voice + Mobile | ⬜ FUTURE | post-UCLA move-in |
| 6b | BlueBubbles iMessage Bridge | ⬜ FUTURE | do at home |
| 8 | Research Compounding | ✅ DEPLOYED | June 6, 2026 |
| 9 | Social Graph | ✅ DEPLOYED | June 6, 2026 |
| 10 | Financial Intelligence | ✅ DEPLOYED | June 6, 2026 |
| 11 | Health + Wellness | ✅ DEPLOYED | June 6, 2026 |
| 13 | Content Pipeline | ✅ DEPLOYED | June 6, 2026 |
| 14 | Skill Evolution | ✅ DEPLOYED | June 6, 2026 |

---

## Completed Phases (stubs — details in BUILD_PLAN_PART1.md)

### Phase 0: Infrastructure ✅ COMPLETE (June 4, 2026)
All components installed. Hermes, GBrain, Ollama, Discord, Lightpanda, PM2, systemd, Tailscale, security hardening. GBrain runs from `~/gbrain-src/` git clone. WASM crash fixed (`vm.mmap_rnd_bits=28`). Cloudflare Tunnel live at `dhruvaos-tunnel` (UUID `e05878ab`).

### Phase 1: Alive ✅ COMPLETE (June 5, 2026)
Hermes↔GBrain wired. All 4 tiers verified. Morning briefing live. UFW + auditd + AppArmor complain mode active. Tailscale SSH live. 88 GBrain MCP tools discovered.

### Phase 2: Inbox ✅ COMPLETE (June 5, 2026)
8 skills deployed: email-triage, calendar, morning-briefing, evening-briefing, task-prioritization, add-task, research-synthesis, correction-handler. Gmail+Calendar OAuth wired. Notion MCP connected. Crons: morning=8am, evening=9pm.

### Phase 3: Menial Tasks ✅ COMPLETE (June 5–6, 2026)
research-synthesis (Exa native extraction), correction-handler, add-task, github-update. GitHub MCP wired. ntfy.sh configured. XPosterOS integration complete. xposteros-control skill deployed. 747/747 contract tests passing.

### Phase 4: Self-Improving ✅ COMPLETE (June 6, 2026)
Dream cycle running 3am nightly. Embed cron 2am. Brain backup 4:30am. brain/dhruvaos/ self-doc imported (45 pages total). First dream cycle ran June 6, 14 chunks embedded. GBrain dream phase flags all enabled. stale-fact-rewrite skill (3:30am, job `6fc1a9ff790c`). error-detection + skill-proposal loop deployed. gbrain-health-monitor hourly (job `77c833f1f6ac`).

### Phase 8: Research Compounding ✅ DEPLOYED (June 6, 2026)
paper-monitor (7am, job `8482d6f67713`), youtube-ingest, podcast-ingest, weekly-learning-synthesis (Sun 9pm, job `a31252c957ff`), connection-detector. Arxiv cs.AI/cs.LG/cs.CL + HN RSS pipeline live.

### Phase 9: Social Graph ✅ DEPLOYED (June 6, 2026)
contact-health-check (8:30am, job `d24c69d0f054`), birthday-reminder (8am, job `fd5af998c518`), post-interaction-log, meeting-prep-brief (hourly `0 * * * *`, job `8727a655eb26`).

### Phase 10: Financial Intelligence ✅ DEPLOYED (June 6, 2026)
api-cost-watchdog (9am, job `ab4ab0a38953`), subscription-audit (1st of month, job `104e4205bfca`), expense-monitor.

### Phase 11: Health + Wellness ✅ DEPLOYED (June 6, 2026)
health-ingest, daily-checkin (10pm, job `918215f0350e`), wellness-trend (Sun 8pm, job `d42598ec4c83`).

### Phase 13: Content Pipeline ✅ DEPLOYED (June 6, 2026)
content-idea-engine (Mon 9am, job `311400ac7366`), blog-draft, x-thread-draft, content-calendar (Mon 8:50am, job `775283a3b5e2`). linkedin-post, youtube-video-create, personal-site-update built and deployed to Omen June 8.

### Phase 14: Skill Evolution ✅ DEPLOYED (June 6, 2026)
skill-analytics (Sun 9pm, job `d34a842128f0`), tier-watchdog (6am, job `197e31b8a5ce`).

---

## Active / In-Progress Phases

### Phase 5: Network Integration (Outbound) 🚧 PARTIAL

XPosterOS is live. Phase 5 skills (linkedin-post, personal-site-update, youtube-video-create) are deployed to Omen but pending live credential verification and quality firewall gate.

**Pending:**
- [ ] Quality firewall end-to-end test (P3.3 gate — requires Dhruva in Discord, see P3.3 sequence in BUILD_PLAN_PART1.md)
- [ ] Playwright install on Omen: `pip install playwright && playwright install chromium` (linkedin-post needs this)
- [ ] YouTube Data API v3 OAuth token — re-run Gmail OAuth adding `youtube.upload` scope; install ffmpeg + google-api libs; scp `youtube-upload.py` to `~/.hermes/scripts/` on Omen
- [ ] `FAL_KEY` in `~/.hermes/.env` for fal.ai thumbnail generation (youtube-video-create step 6)
- [ ] `SITE_REPO` in `~/.hermes/.env` (e.g. `SITE_REPO=Dhruva966/portfolio`) for personal-site-update
- [ ] Set `XPOSTER_DRY_RUN=false` only after explicit approval and quality firewall gate passes
- [ ] Cloudflare Zero Trust — `api.dhruvavutukury.org` + `gbrain.dhruvavutukury.org` are currently open internet; add Zero Trust email OTP at dash.cloudflare.com
- [ ] GBrain braindump — ingest `wiki/braindump-questions.md` answers before enabling outbound skills

**Verification (per outbound skill):**
```bash
# Each skill: test post → firewall fires → approve → verify sent
# P3.3 gate sequence (full detail in BUILD_PLAN_PART1.md → Phase 3 → P3.3):
# 1. Send "/test-outbound Hello this is a test message" in #corrections
# 2. Verify claude-sonnet-4-6 in logs: ssh omen "tail ~/.hermes/logs/gateway.log | grep model"
# 3. Verify [APPROVAL REQUIRED] preview appears, message BLOCKED
# 4. React 👍 → verify action executes only after approval
# 5. Send "/deny" → verify action discarded and logged
```

---

### Phase V: Visual + Voice Interface ✅ COMPLETE (June 8, 2026)

**Delivered:**
- **Jarvis** — 3D neural brain visualization (Jarvis blue palette, GLSL ShaderMaterial soma w/ 3D simplex noise energy veins + Fresnel rim, HDR dendrites, Noise film grain). Live at `/jarvis` via Vercel rewrite.
- **DrewUI — malleable Claude-style chat dashboard** at `/drew`. Architecture:
  - Full-width chat UI (Claude.ai-style) — text input + voice mic button in bottom bar
  - Compact widget bar: Hermes/GBrain health dots, memory count, cron count, last activity
  - Drew responds with structured JSON commands — can search GBrain, dispatch Hermes skills, pin/unpin dashboard widgets, all inline as chat cards
  - Suggestion chips on empty state for quick prompts
  - Idle screensaver: 90s → Jarvis 3D brain fullscreen iframe; click to return
- **Voice pipeline** — Whisper STT → Claude Sonnet 4.6 (with command parsing) → ElevenLabs TTS (OpenAI fallback). Fully integrated in chat input mic button.
- **Content OS** at `/content` — voice brainstorm mode + chat mode; Space to toggle recording; Drew auto-responds to questions. Submits to XPosterOS (`/xposteros` rewrite) or clipboard fallback.
- **Auth** — `middleware.ts` guards pages (`/drew`, `/content`, `/jarvis`) AND API routes (`/api/voice/*`, `/api/drew/*`, `/api/content/*`). `lib/auth.ts` provides timing-safe `requireAuth()` for defense-in-depth. 30-day httpOnly cookie.
- **Chat command system** — Drew's system prompt teaches it to return JSON `{message, commands}`. Commands: `gbrain_search`, `gbrain_think`, `dispatch_skill`, `discord_messages`, `pin_widget`, `unpin_widget`. API executes them server-side and returns results as embedded cards.

**New components (June 8, 2026):**
- `ChatInput.tsx` — text + voice button input bar
- `ChatMessage.tsx` — message bubbles with inline GBrain/Discord/Skill cards
- `WidgetBar.tsx` — compact scrollable status chips
- `lib/auth.ts` — timing-safe auth helper used by all API routes

**Completed (June 8, 2026 hardening session):**
- [x] Auth middleware extended to cover all API routes (`/api/voice/*`, `/api/drew/*`)
- [x] Input caps added: 2000 char TTS, 4000 char chat msg, 10MB audio
- [x] API routes (`crons`, `memory`, `activity`) replaced exec() with HTTP to localhost Hermes/GBrain
- [x] blob URL memory leak fixed in VoiceInterface.tsx
- [x] AudioContext leak fixed in HermesAPI.ts
- [x] DrewDashboard 401 silent failure fixed
- [x] BrainCanvas missing useEffect deps fixed
- [x] connection-detector stop() crash + flock -n → -w 30 fixed; deployed to Omen
- [x] api-cost-watchdog awk regex + log target fixed; deployed to Omen
- [x] morning-briefing Hermes cron model: deprecated model override cleared → uses global `gemini-3.1-flash-lite`
- [x] Omen infrastructure: gbrain-backup-safe.sh, wait-for-gbrain.sh, ExecStartPre, phi4-mini cron, health cron, logrotate
- [x] **Drew-UI security hardening**: all API routes now behind `requireAuth()` (timing-safe), AbortSignal.timeout 30s on voice pipeline
- [x] **api-cost-watchdog**: Gemini blind spot fixed (grep + MODEL_PATTERNS + COSTS). Deployed.
- [x] **paper-monitor**: phi4-mini markdown fence-stripping before JSON parse. Deployed.
- [x] **ambient-discord-listener** skill: on_message trigger, phi4-mini intent classification, silent by default, feeds dream cycle. Deployed.
- [x] **drew-heartbeat.sh**: zero-LLM system crontab monitor — Hermes, GBrain, PM2, morning briefing, dream cycle, OAuth expiry. Deploy: add `*/15 * * * * /home/dhruva/.hermes/scripts/drew-heartbeat.sh` to system crontab.
- [x] **dev-error-log** skill: manual skill to document bugs + failed fixes + working fix. Deployed.

**Pending:**
- [ ] **SITE_PASSWORD in Vercel drew-ui** ⚠️ BLOCKING login — browser verified June 8: "wrong password". Omen .env.local already has it. Vercel deployment is missing it. Go to vercel.com → drew-ui project → Settings → Environment Variables → add `SITE_PASSWORD` → Redeploy
- [ ] **Merge feat/jarvis-voice-neural-brain → main** — `/api/drew/crons`, `/api/drew/memory`, `/api/drew/activity` routes only on feature branch; Vercel main deployment returns 404 for those routes
- [ ] **GBrain braindump ingest** — `wiki/braindump-questions.md` answers; `gbrain import`
- [ ] **Populate `.env.local` on Omen** — copy OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY from `~/.hermes/.env`; set XPOSTEROS_API_TOKEN
- [ ] **Discord messages panel** — wire `/api/drew/discord` to Hermes Discord API when endpoint confirmed
- [ ] **XPosterOS tunnel** — for Content OS submit: SSH tunnel `-L 8081:127.0.0.1:8081` or rebind XPosterOS to `0.0.0.0` on Omen
- [x] **Contact Health Check + Birthday Reminder**: "Unknown provider 'openai'" — root cause was deprecated model (shut down June 2026) → Hermes auth fell back to openai (not configured). Fix: global default updated to `gemini-3.1-flash-lite`, model=null in jobs.json. Self-heal on next scheduled run.
- [ ] **Paper Monitor**: fix "Response truncated" — output too long, needs chunking in skill body
- [ ] **SITE_PASSWORD env var** on jarvis-voice Vercel project (jarvis-voice now has middleware.ts guarding direct URL)

---

### Phase 6: Voice + Mobile ⬜ FUTURE (post-UCLA move-in)

Full local voice pipeline — do after settling at UCLA.

**Pending:**
- [ ] STT: upgrade Whisper from `base` to `small` (`stt.model: small` in config.yaml), or evaluate NVIDIA Parakeet-TDT-1.1B (~1.5GB VRAM) for state-of-art accuracy
- [ ] TTS: install Piper (`pip install piper-tts`, download `en_US-lessac-high.onnx`) — CPU-only, <200ms latency, $0
- [ ] Wake: two-clap detector (`pyaudio` + `silero-vad`) — see clap_detector.py pattern in BUILD_PLAN_PART1.md Phase 6
- [ ] voice-handler Hermes skill — intent classify → route to existing skills → Piper TTS reply
- [ ] iPhone geofencing via Shortcuts + webhook to Hermes
- [ ] Twilio voice call-in (optional): Twilio → Hermes webhook → Whisper → TTS reply

**STT decision at Phase 6:** benchmark faster-whisper vs Gemma 4 12B via Vertex AI (encoder-free, simpler pipeline if VRAM stays at 6GB).

**Never use MiniMax STT** — voice biometrics are sensitive. MiniMax TTS is OK for generic text only.

---

### Phase 6b: BlueBubbles iMessage Bridge ⬜ FUTURE (do at home — requires Mac + Cloudflare Tunnel)

**Goal:** Text Drew from iPhone via iMessage. Drew responds. Fast path for quick commands.

**Architecture:**
```
iPhone → iMessage → Mac Messages.app → BlueBubbles Server (port 1234)
    ↕ REST + webhooks ↕
Hermes (Omen) — BLUEBUBBLES_SERVER_URL + BLUEBUBBLES_PASSWORD in .env
```

**Mac setup (one time, do at home):**
1. Install BlueBubbles Server `.dmg` on Mac
2. Grant Full Disk Access + Automation → Messages in System Settings
3. Set password in BlueBubbles UI
4. Configure Cloudflare Tunnel in BlueBubbles → stable HTTPS URL
5. `sudo pmset -a sleep 0` — keep Mac awake as bridge

**Omen `.env` additions:**
```bash
BLUEBUBBLES_SERVER_URL=https://imessage.<yourdomain>.com
BLUEBUBBLES_PASSWORD=<your-password>
```

**Hermes config:** BlueBubbles is a built-in Hermes gateway — `hermes gateway setup` auto-configures once env vars are set.

**Notes:**
- SIP disable NOT required for text send/receive
- Account ban risk: near-zero for personal single-user use
- Requires Cloudflare Tunnel to be set up first (already done — `dhruvaos-tunnel`)
- Depends on: Mac always-on (already true if using Mac as BlueBubbles bridge)

---

## Operational Patterns (always-relevant)

### Zero-LLM Cron Tier

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

### Parallel Build Safety Rules

**SEQUENTIAL (never parallelize):**

| Resource | Why |
|----------|-----|
| GBrain PGLite DB | Single-writer embedded DB; concurrent writes corrupt |
| `gbrain import`, `gbrain embed`, `gbrain dream`, `gbrain init`, `gbrain doctor` | All write to same DB |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML → Hermes fails to start |
| Hermes process restarts (`systemctl --user restart hermes-gateway`) | Must be atomic |
| Crontab edits | `crontab -e` not concurrent-safe |
| `mcp_servers:` registration | Hermes reloads config on restart — only one editor at a time |

**PARALLEL-SAFE:**

| Resource | Why |
|----------|-----|
| Individual skill YAML files (`skills/*.yaml`) | Different files, no shared state |
| `~/brain/**` markdown content | Files; GBrain ingests after, not during |
| Discord channel config | Documentation only |
| Provider API key testing | Tests different providers independently |
| Phase documentation (`*.md` in project root) | Pure writes |

### Git Worktree Pattern for Parallel Phases

```bash
# Create worktrees for parallel phase tasks
git worktree add ../dhruvaos-p2-email -b phase2-email-triage
git worktree add ../dhruvaos-p2-calendar -b phase2-calendar

# Each Claude Code session works in its own dir
# Merge when done
git checkout main
git merge phase2-email-triage
git merge phase2-calendar
git worktree remove ../dhruvaos-p2-email
git worktree remove ../dhruvaos-p2-calendar
```

### Task Decomposition Template (15-minute units)

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

## Phase Gates

```bash
# Phase 3 → Phase 4  [HARD GATE — quality firewall MUST pass before any outbound skill]
# Run P3.3 sequence in Discord (full detail in BUILD_PLAN_PART1.md → Phase 3 → P3.3)

# Phase 4 → Phase 5
gbrain think "my goals"               # returns trajectory (not empty)
# Novel task → skill authored in ~/.hermes/skills/
gbrain doctor --json | jq .score      # score ≥ 70

# Phase 5 → done
# Each outbound skill: test post → firewall fires → approve → verify sent

# Phase V verification
curl https://api.dhruvavutukury.org/health   # Hermes reachable from outside
# V2: open dashboard on phone → Drew status visible
# V4: hold mic → hear Drew respond
```
