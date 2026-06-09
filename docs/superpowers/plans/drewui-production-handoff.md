# DrewUI Production Handoff — Connect Everything

> **STATUS (June 8 2026): Phase 1, 2, 3 COMPLETE.** Voice pipeline, dashboard, conversation history all shipped. See `drew-ui/README.md` for current architecture. Only remaining items: populate `.env.local` on Omen with API keys, `pm2 restart drew-ui`, and optional V5 config UI.

## Who You Are / Context

You are continuing production of **DrewUI** — the personal AI interface for Dhruva Vutukury's autonomous AI OS (DhruvaOS Mark 2). This is a Next.js 15 (App Router) web app that lives at `dhruvavutukury.org` and serves as the human-facing surface for the whole system.

The backend AI OS (called "Drew" or "Hermes") runs 24/7 on Dhruva's HP Omen gaming laptop (Ubuntu 24.04) — the "Omen" — accessible via Tailscale.

---

## Critical Rules (Read First)

1. **CLI: --help first, never trial-and-error.** Before running any CLI tool (hermes, gbrain, etc.), run `<tool> --help`, read it, then show the exact command.
2. **Models: never trust training data for current model names.** Before using any model in code, verify the ID at official docs. Gemini 2.0 shut down June 2026.
3. **AGENTS.md warning:** This Next.js has breaking changes — APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing Next.js code.
4. **Quality firewall:** Any text Drew sends outbound requires Dhruva's explicit Discord approval. Never auto-send.
5. **Tests:** Run `npx tsc --noEmit` from `drew-ui/` after every code change.

---

## SSH Access to Omen

```bash
ssh dhruva@100.119.229.11
# PATH fix — always run in non-login SSH sessions:
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
```

Tailscale must be active on both Mac and Omen. If SSH hangs: `tailscale status` on Mac.

---

## What Exists (Current State)

### drew-ui/ directory structure

```
drew-ui/
├── app/
│   ├── page.tsx              # Landing page (Dhruva's public site, links to /drew + /jarvis + /content)
│   ├── layout.tsx            # Root layout
│   ├── login/page.tsx        # Password auth page (complete, working)
│   ├── drew/page.tsx         # Main drew route — currently just renders VoiceInterface (stub)
│   └── api/
│       └── auth/route.ts     # POST /api/auth — password cookie auth (complete, working)
├── components/
│   ├── Drew.tsx              # Animated orb avatar (Framer Motion, 4 states: idle/listening/thinking/speaking)
│   └── VoiceInterface.tsx    # Voice pipeline UI (mic recording → STT → LLM → TTS) — STUB, uses mocks
├── lib/
│   └── HermesAPI.ts          # API client for Hermes — transcribeAudio + speakText + checkHermesHealth — STUB, falls back to mocks
├── middleware.ts             # Protects /drew, /content, /jarvis routes behind password auth (complete)
└── next.config.ts           # Rewrites /jarvis → jarvis-voice-umber.vercel.app, /content → another Vercel app
```

### Auth system (COMPLETE — do not touch)
- `middleware.ts` intercepts `/drew`, `/content`, `/jarvis` requests
- Checks `site-auth` cookie (password-based, 30-day)
- `app/api/auth/route.ts`: POST with `{ password }` → sets cookie if matches `SITE_PASSWORD` env var
- `app/login/page.tsx`: minimal password form

### Drew Avatar (COMPLETE — do not redesign)
- `components/Drew.tsx`: CSS glass orb (radial gradient, backdrop-filter)
- 4 animated states driven by `state` prop: idle (slow pulse), listening (blue glow), thinking (wobble), speaking (bounce)
- Currently positioned `fixed bottom-8 right-8` — may need to move to center for voice flow

### VoiceInterface (STUB — this is the main thing to wire up)
- Records audio via `MediaRecorder` API
- Sends blob to `${HERMES_BASE_URL}/api/audio/transcribe` → currently falls back to mock text
- Gets response text → sends to `${HERMES_BASE_URL}/api/audio/speak` → currently falls back to silent audio
- `HERMES_BASE_URL` defaults to `http://localhost:8642` (configurable via `NEXT_PUBLIC_HERMES_URL` env)

### Hermes on Omen (backend)
- **Port 8642** — has `GET /health` → `{"status":"ok","platform":"hermes-agent"}` ✅
- **No audio API exists** — `POST /api/audio/transcribe` and `POST /api/audio/speak` return 404
- Hermes is a CLI-based agent system, not an HTTP API server (runs via systemd)
- All API keys in `~/.hermes/.env` (chmod 600 on Omen): OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY (check if set: `ssh omen 'grep ELEVENLABS ~/.hermes/.env'`)

### GBrain on Omen
- **Port 3131** — `gbrain serve --http --port 3131 --host 127.0.0.1`
- JSON-RPC MCP server (not REST) — use MCP tool calls or the gbrain CLI, not raw curl
- Check health: `ssh omen 'gbrain onboard --check --json'`
- PM2 managed: `pm2 list` shows `gbrain-mcp` process

### Jarvis (COMPLETE — do not touch)
- `/jarvis` route rewrites to `jarvis-voice-umber.vercel.app` in `next.config.ts`
- 3D neural brain visualization, Jarvis blue palette, custom GLSL ShaderMaterial soma
- Deployed and live — this is done

---

## What Needs to Be Built

### Phase 1: Real Voice Pipeline (highest priority)

The `VoiceInterface.tsx` currently mocks everything. Wire it to real services.

**Architecture decision (already made — follow this):**

Since drew-ui is deployed ON Omen (behind Cloudflare Tunnel at `dhruvavutukury.org`), Next.js API routes have localhost access to all Omen services. Build Next.js API routes as the proxy layer:

```
Browser → drew-ui API routes (Next.js on Omen) → External APIs / Local services
```

**Build these Next.js API routes:**

1. **`POST /api/voice/transcribe`** — STT
   - Accept: `multipart/form-data` with `file` (audio blob, WebM/WAV/mp4)
   - Call OpenAI Whisper API (`https://api.openai.com/v1/audio/transcriptions`, model: `whisper-1`)
   - Return: `{ text: string }`
   - Auth: use `OPENAI_API_KEY` from env (already on Omen in `~/.hermes/.env` — expose via `.env.local`)

2. **`POST /api/voice/chat`** — LLM conversation
   - Accept: `{ message: string, history?: Array<{role, content}> }`
   - Call Anthropic API directly: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
   - System prompt: "You are Drew, Dhruva's personal AI assistant. You are concise, sharp, and helpful. Dhruva is a UCLA ECE student who builds autonomous AI systems. Keep responses short for voice — 1-3 sentences."
   - Return: `{ response: string }`
   - Auth: use `ANTHROPIC_API_KEY` from env

3. **`POST /api/voice/speak`** — TTS
   - Accept: `{ text: string }`
   - Call ElevenLabs API: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
   - Check ElevenLabs docs for current endpoint (search `site:elevenlabs.io/docs/api-reference`)
   - Return: audio stream (pipe the response directly, set `Content-Type: audio/mpeg`)
   - Auth: use `ELEVENLABS_API_KEY` from env; check if key exists on Omen first
   - Fallback: if no ElevenLabs key, use OpenAI TTS (`gpt-4o-mini-tts` or `tts-1`, voice: `alloy`)

**Update VoiceInterface.tsx to use real routes:**
- Replace `transcribeAudio(audioBlob)` → `POST /api/voice/transcribe`
- Replace `speakText(text)` → first `POST /api/voice/chat` to get response, then `POST /api/voice/speak` for audio
- Remove the mock fallbacks (they hide real errors)
- Add proper error display in UI

**Update HermesAPI.ts** (or deprecate in favor of direct fetch calls in VoiceInterface)

### Phase 2: Drew Dashboard

Replace the bare VoiceInterface at `/drew` with a real dashboard.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Drew  ·  [status dot]  active          │
├──────────────┬──────────────────────────┤
│   Cron Jobs  │   Memory               │
│   (list)     │   (GBrain stats)       │
├──────────────┴──────────────────────────┤
│   Recent Activity (last 5 actions)      │
└─────────────────────────────────────────┘
         [Drew orb — voice button]
```

**Build these status API routes:**

4. **`GET /api/drew/status`**
   - Fetch `http://127.0.0.1:8642/health` (Hermes) and `http://127.0.0.1:3131/health` (GBrain) in parallel
   - Return: `{ hermes: bool, gbrain: bool, timestamp: string }`

5. **`GET /api/drew/crons`**
   - SSH to Omen via Node.js `child_process.exec` or use a pre-built list from Hermes API
   - Alternative: cache cron list at build time / refresh every 5 min via revalidation
   - Run: `hermes cron list --json` (verify the flag exists: `hermes cron list --help` first)
   - Return: array of `{ id, name, schedule, last_run, status }`

6. **`GET /api/drew/memory`**
   - Call GBrain MCP HTTP endpoint or run `gbrain search --query "recent" --limit 10`
   - Return: `{ total_entries: number, last_dream: string, recent: string[] }`

**Dashboard components (minimal, dark theme matching existing UI):**
- `components/DrewStatus.tsx` — green/red dot + last-seen time
- `components/CronList.tsx` — table of cron jobs with status badges
- `components/MemoryStats.tsx` — total entries, last dream cycle, recent topics
- `components/ActivityFeed.tsx` — last 5 actions Drew took

**Drew page layout** (`app/drew/page.tsx`):
```tsx
// Server component — fetches status at request time
// Drew orb stays as client component in corner
// Dashboard panels in grid
```

### Phase 3: Conversation History

- Add conversation history state to VoiceInterface
- Store turns in-memory during session (no persistence needed yet)
- Pass history to `/api/voice/chat` for context
- Show transcript in UI (user + Drew turns)

---

## Environment Variables Needed (drew-ui)

Create `drew-ui/.env.local` (never commit):

```bash
# Auth
SITE_PASSWORD=<ask Dhruva or check deployed env>

# AI APIs — copy from Omen's ~/.hermes/.env
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=<check if exists on Omen>

# Drew services (only works when app runs on Omen)
HERMES_URL=http://127.0.0.1:8642
GBRAIN_URL=http://127.0.0.1:3131

# Public (safe to expose to browser)
NEXT_PUBLIC_HERMES_URL=http://127.0.0.1:8642
```

To check what keys exist on Omen:
```bash
ssh dhruva@100.119.229.11 "cat ~/.hermes/.env | grep -E 'OPENAI|ANTHROPIC|ELEVENLABS' | sed 's/=.*/=...REDACTED/'"
```

---

## Deployment Context

- `dhruvavutukury.org` — served via Cloudflare Tunnel from Omen
- drew-ui runs as a process on Omen (check: `pm2 list` or `systemctl --user status drew-ui`)
- If not deployed: `cd drew-ui && npm run build && pm2 start npm --name drew-ui -- start`
- The `next.config.ts` rewrites handle /jarvis and /content routing

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS |
| Animation | Framer Motion (Drew avatar) |
| AI Models | Claude Sonnet 4.6 (chat), Whisper (STT), ElevenLabs (TTS) |
| Backend | Hermes Agent (port 8642, Omen), GBrain MCP (port 3131, Omen) |
| Auth | Cookie-based password auth (middleware.ts) |
| Deploy | Cloudflare Tunnel → Omen |

---

## Success Criteria Per Phase

**Phase 1 done when:**
- Hold button → speak → Drew responds in voice (real words, not mock text)
- Browser console shows no mock fallback messages
- `npx tsc --noEmit` in drew-ui/ → zero errors

**Phase 2 done when:**
- `/drew` loads dashboard showing real Hermes status (green dot if service active)
- Cron list shows actual Hermes cron jobs (not placeholder)
- Drew orb still works for voice in corner

**Phase 3 done when:**
- Multi-turn conversation works (Drew remembers what was said earlier in session)
- Transcript visible in UI

---

## What NOT to Do

- Don't change the auth system — it works
- Don't redesign the Drew orb — it's already styled, just needs to move/resize for dashboard
- Don't touch next.config.ts rewrites for /jarvis and /content — Jarvis 3D brain is live
- Don't add SSR to client components (Drew.tsx, VoiceInterface.tsx are 'use client')
- Don't use `any` types without a comment explaining why
- Don't use `res.json()` twice on the same fetch response (consume once)
- Don't commit API keys — use .env.local only

---

## First Steps for New Chat

1. SSH to Omen and verify: `ssh dhruva@100.119.229.11 "curl -s localhost:8642/health"`
2. Check ElevenLabs key exists: `ssh dhruva@100.119.229.11 "grep ELEVENLABS ~/.hermes/.env"`
3. Check OpenAI key: `ssh dhruva@100.119.229.11 "grep OPENAI_API_KEY ~/.hermes/.env | head -1"`
4. Read `drew-ui/app/api/` and `drew-ui/lib/HermesAPI.ts` for current API shape
5. Build Phase 1 API routes: `app/api/voice/transcribe/route.ts`, `app/api/voice/chat/route.ts`, `app/api/voice/speak/route.ts`
6. Update VoiceInterface.tsx to use real routes
7. Test locally: `cd drew-ui && npm run dev` then visit `http://localhost:3000/drew`
