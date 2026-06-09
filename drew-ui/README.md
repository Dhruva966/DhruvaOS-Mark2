# DrewUI — DhruvaOS Dashboard

Live at `dhruvavutukury.org/drew` (password-protected, runs on Omen via Cloudflare Tunnel).

## What It Is

Malleable Claude-style chat dashboard for DhruvaOS. Talk to Drew (text or voice); Drew answers and can dynamically search GBrain memory, dispatch Hermes skills, and embed data cards inline in the conversation. The dashboard reshapes itself based on what you ask.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Public landing page |
| `/drew` | Protected chat dashboard (this app) |
| `/content` | Protected Content OS — voice brainstorm/chat |
| `/jarvis` | Proxied → jarvis-voice-umber.vercel.app (3D neural brain) |
| `/xposteros` | Proxied → web-eta-two-78.vercel.app (XPosterOS) |

## Architecture

```
Browser (drew-ui Next.js 16 on Omen)
│
├── /drew → DrewDashboard.tsx
│   ├── ChatInput.tsx        text input + mic button
│   ├── ChatMessage.tsx      message bubble + embedded data cards
│   │   ├── GBrainCard       search results from gbrain CLI
│   │   ├── DiscordCard      recent Discord messages
│   │   └── SkillCard        Hermes skill dispatch output
│   ├── WidgetBar.tsx        compact Hermes/GBrain/cron/activity chips
│   └── IdleScreensaver.tsx  90s idle → Jarvis iframe fullscreen
│
├── /api/drew/* (status polling, 30s interval)
│   ├── status   → Hermes :8642/health + GBrain :3131/health
│   ├── crons    → exec: hermes cron list --json
│   ├── memory   → exec: gbrain onboard --check --json
│   └── activity → tail ~/.hermes/logs/gateway.log
│
└── /api/voice/* (chat pipeline, server-side on Omen)
    ├── transcribe → OpenAI Whisper whisper-1
    ├── chat       → Claude Sonnet 4.6 + command parser + GBrain exec
    └── speak      → ElevenLabs TTS (fallback: OpenAI tts-1)
```

## Chat Command System

Drew's system prompt instructs it to respond in JSON `{message, commands}`. The chat API parses commands and executes them server-side before returning:

| Command | What happens |
|---------|-------------|
| `gbrain_search` | `exec gbrain search "query"` → results embedded as GBrainCard |
| `gbrain_think` | Same exec, temporal framing |
| `dispatch_skill` | Tries `POST /api/skills/{name}/run`, falls back to `hermes cron run` |
| `discord_messages` | Placeholder — not yet wired |
| `pin_widget` / `unpin_widget` | Client refreshes widget bar data |

**Robustness:** if Claude returns non-JSON, the API treats the full text as the message (no commands). Never crashes.

## Quick Start

### 1. Set `.env.local`

```bash
# drew-ui/.env.local
SITE_PASSWORD=<your password>

# Copy from Omen's ~/.hermes/.env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...           # optional
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # default: Rachel

HERMES_URL=http://127.0.0.1:8642
GBRAIN_URL=http://127.0.0.1:3131

# Content OS — XPosterOS submission
# Option A: SSH tunnel: ssh -L 8081:127.0.0.1:8081 dhruva@100.119.229.11 -N &
XPOSTEROS_API_URL=http://127.0.0.1:8081
XPOSTEROS_API_TOKEN=<from ~/.hermes/.env on Omen>
```

To pull keys from Omen:
```bash
ssh dhruva@100.119.229.11 "grep -E 'OPENAI|ANTHROPIC|ELEVENLABS' ~/.hermes/.env"
```

### 2. Dev server

```bash
cd drew-ui && npm run dev
# Visit http://localhost:3000  (login → /drew)
```

### 3. Production (on Omen)

```bash
cd drew-ui && npm run build && pm2 restart drew-ui
```

## Component Reference

| File | Role |
|------|------|
| `components/DrewDashboard.tsx` | Main orchestrator — voice pipeline, sendMessage(), widget data polling |
| `components/ChatInput.tsx` | Text + voice input bar (mic button triggers recording) |
| `components/ChatMessage.tsx` | Message bubble + GBrain/Discord/Skill embedded cards |
| `components/WidgetBar.tsx` | Compact horizontal status chips (scrollable) |
| `components/IdleScreensaver.tsx` | 90s idle → Jarvis iframe fullscreen |
| `components/Drew.tsx` | Animated glass orb (unused in /drew but available) |
| `lib/auth.ts` | Timing-safe `requireAuth()` helper used by all API routes |

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/voice/transcribe` | POST | ✓ | Audio → Whisper → `{text}` |
| `/api/voice/chat` | POST | ✓ | `{message, history}` → Claude + commands → `{response, cards, widgetCommands}` |
| `/api/voice/speak` | POST | ✓ | `{text}` → ElevenLabs/OpenAI → audio/mpeg |
| `/api/drew/status` | GET | ✓ | Hermes + GBrain health |
| `/api/drew/crons` | GET | ✓ | `hermes cron list --json` |
| `/api/drew/memory` | GET | ✓ | `gbrain onboard --check --json` |
| `/api/drew/activity` | GET | ✓ | Last 8 Hermes log lines |
| `/api/auth` | POST | — | Login → sets `site-auth` cookie |

## Voice Flow

1. Tap mic button → MediaRecorder starts
2. Tap again (or mic button turns into stop) → recording stops
3. `POST /api/voice/transcribe` → Whisper → transcript
4. Transcript added as user message; "…" placeholder appears
5. `POST /api/voice/chat` → Claude Sonnet 4.6 → JSON response + commands parsed
6. Commands executed server-side (GBrain search, skill dispatch)
7. Assistant message + inline cards replace placeholder
8. If voice mode: `POST /api/voice/speak` → TTS audio plays

## Auth

Proxy protects page routes (redirect to `/login`) and API routes (return 401 JSON). Both layers: `proxy.ts` (fast, edge, Next.js 16 convention) + `requireAuth()` in each handler (defense-in-depth). Cookie: `site-auth`, httpOnly, 30-day.

## Troubleshooting

**Drew responds with "Something went wrong"** → Check Anthropic key in `.env.local`.

**GBrain search returns "gbrain unavailable"** → PATH issue or GBrain not on Omen. Test: `ssh omen "gbrain search test"`.

**Crons show empty** → `hermes cron list` on Omen. Job IDs live in Hermes DB, not CLI JSON if `--json` unsupported.

**tsc errors before deploy** → `cd drew-ui && npx tsc --noEmit` must be zero.

**Screensaver blank** → `/jarvis` proxies to Vercel — check `next.config.ts` destination is live.
