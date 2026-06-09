# DrewUI — DhruvaOS Dashboard + Voice Interface

Live at `dhruvavutukury.org/drew` (password-protected, runs on Omen via Cloudflare Tunnel).

## What It Is

Full-screen dashboard for DhruvaOS. Shows real-time Hermes + GBrain status, cron jobs, memory stats, and activity feed. Voice pipeline lets you talk to Drew (Claude Sonnet 4.6) and hear responses. Jarvis 3D neural brain activates as a screensaver after 90s of idle.

## Architecture

```
Browser (drew-ui, Next.js 16 on Omen)
├── /drew dashboard
│   ├── System panel  → GET /api/drew/status  → Hermes :8642/health + GBrain :3131/health
│   ├── Cron panel    → GET /api/drew/crons   → exec: hermes cron list --json
│   ├── Memory panel  → GET /api/drew/memory  → exec: gbrain onboard --check --json
│   └── Activity feed → GET /api/drew/activity → tail ~/.hermes/logs/gateway.log
│
└── /api/voice/* (voice pipeline — runs server-side on Omen)
    ├── POST /transcribe → OpenAI Whisper (whisper-1)
    ├── POST /chat       → Anthropic Claude Sonnet 4.6 (multi-turn history, last 10 turns)
    └── POST /speak      → ElevenLabs TTS (fallback: OpenAI tts-1, voice: alloy)
```

Idle screensaver: 90s no input → Jarvis 3D neural brain fills the screen (`/jarvis` iframe).

## Quick Start

### 1. Set API keys in `.env.local`

```bash
# drew-ui/.env.local
SITE_PASSWORD=<your password>

# Copy from Omen's ~/.hermes/.env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...          # optional — OpenAI TTS is the fallback
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # default: Rachel

HERMES_URL=http://127.0.0.1:8642
GBRAIN_URL=http://127.0.0.1:3131
NEXT_PUBLIC_HERMES_URL=https://api.dhruvavutukury.org
```

To pull keys from Omen:
```bash
ssh dhruva@100.119.229.11 "cat ~/.hermes/.env | grep -E 'OPENAI|ANTHROPIC|ELEVENLABS' | sed 's/=.*/=REDACTED/'"
```

### 2. Dev server

```bash
cd drew-ui
npm run dev
# Visit http://localhost:3000/drew
```

### 3. Production (on Omen)

```bash
cd drew-ui
npm run build
pm2 start npm --name drew-ui -- start
# or restart: pm2 restart drew-ui
```

## Components

| File | What it does |
|------|--------------|
| `components/DrewDashboard.tsx` | Main layout — polls status every 30s, holds conversation history |
| `components/Drew.tsx` | Animated glass orb (fixed bottom-right), 4 states: idle/listening/thinking/speaking |
| `components/VoiceInterface.tsx` | Voice pipeline state machine — real STT→LLM→TTS via `/api/voice/*` |
| `components/ConversationTranscript.tsx` | Scrolling chat transcript, auto-scrolls on new turn |
| `components/SystemStatus.tsx` | Hermes + GBrain live status dots |
| `components/CronList.tsx` | Hermes cron jobs table |
| `components/MemoryStats.tsx` | GBrain entry count, last dream time |
| `components/ActivityFeed.tsx` | Last 8 Hermes log lines |
| `components/IdleScreensaver.tsx` | 90s idle → Jarvis 3D brain iframe fullscreen |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/voice/transcribe` | POST | Multipart audio → OpenAI Whisper → `{ text }` |
| `/api/voice/chat` | POST | `{ message, history }` → Claude Sonnet 4.6 → `{ response }` |
| `/api/voice/speak` | POST | `{ text }` → ElevenLabs/OpenAI TTS → audio/mpeg stream |
| `/api/drew/status` | GET | Parallel health check Hermes + GBrain |
| `/api/drew/crons` | GET | `hermes cron list --json` output |
| `/api/drew/memory` | GET | `gbrain onboard --check --json` stats |
| `/api/drew/activity` | GET | Last 8 lines of Hermes gateway.log |
| `/api/auth` | POST | Password login → sets `site-auth` cookie |

## Auth

All `/drew`, `/jarvis`, `/content` routes protected by `middleware.ts`. Login at `/login`. Cookie: `site-auth`, 30-day, httpOnly.

## Voice Flow

1. Click/tap Drew orb → mic activates
2. Speak → release (or click again to stop)
3. `POST /api/voice/transcribe` → Whisper → transcript
4. `POST /api/voice/chat` → Claude Sonnet 4.6 with full session history → response text
5. `POST /api/voice/speak` → ElevenLabs (OpenAI fallback) → audio played
6. Conversation history accumulates in session; shown in transcript panel
7. "Clear" button resets transcript

## Screensaver

After 90s idle (no mouse/keyboard/touch): Jarvis 3D neural brain displays fullscreen as `/jarvis` iframe. Click anywhere to return to Drew dashboard.

## Route Rewrites (next.config.ts)

- `/jarvis/*` → `jarvis-voice-umber.vercel.app` (Vercel, 3D neural brain)
- `/content/*` → `web-eta-two-78.vercel.app` (Vercel, content OS)

## Troubleshooting

**Voice returns error "X not configured"** → Check `.env.local` has the relevant API key set.

**Crons show empty / error** → `hermes cron list --help` on Omen to confirm flag support. PATH must include `~/.hermes/bin`.

**GBrain memory shows "unavailable"** → `pm2 list` on Omen; restart with `pm2 restart gbrain-mcp`.

**Screensaver iframe blank** → `/jarvis` rewrite targets external Vercel. Check `next.config.ts` destination is live.

**tsc errors** → `cd drew-ui && npx tsc --noEmit` — must be zero before deploying.
