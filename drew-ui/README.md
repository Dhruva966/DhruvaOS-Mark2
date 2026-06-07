# Drew — Voice + Visual Avatar

Floating bubble avatar that listens, thinks, and speaks. Powered by Hermes API + ElevenLabs TTS.

## Quick Start

### 1. Start Dev Server (Mac)

```bash
cd drew-ui
npm run dev
```

Opens at http://localhost:3002 (or next available port).

### 2. Configure Hermes TTS on Omen

Switch TTS provider from Edge (local) to ElevenLabs (cloud voice):

```bash
ssh dhruva@100.119.229.11
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
bash ~/DhruvaOS\ Mark\ 2/scripts/switch-hermes-tts-to-elevenlabs.sh
```

Or manually:
```bash
sed -i.bak 's/^  provider: edge$/  provider: elevenlabs/' ~/.hermes/config.yaml
systemctl --user restart hermes-gateway
```

### 3. Wire Hermes URL (if running on Omen over Tailscale)

Edit `.env.local`:

```bash
# localhost: Mac local (Hermes on Mac or MockServer)
NEXT_PUBLIC_HERMES_URL=http://localhost:8642

# Omen over Tailscale: replace with actual Tailscale IP
NEXT_PUBLIC_HERMES_URL=http://100.119.229.11:8642  # example, use actual IP
```

### 4. Test in Browser

Open http://localhost:3002:

1. **See Drew** — floating purple bubble in bottom-right
2. **Click Drew** — mic activates (browser permission prompt)
3. **Speak** — e.g., "Hello Drew"
4. **Watch animations:**
   - 🎤 idle → 👂 listening → 💭 thinking → 🗣️ speaking
5. **Hear response** — Drew speaks back (via ElevenLabs TTS)

## Architecture

```
Mac Browser (drew-ui)
    ↓
    Web Audio API (getUserMedia)
    ↓
    POST /api/audio/transcribe (Whisper STT on Omen)
    ↓
    transcribed text
    ↓
    Generate response (mocked for now — TODO: wire to Hermes chat)
    ↓
    POST /api/audio/speak (ElevenLabs TTS on Omen)
    ↓
    Audio blob
    ↓
    HTMLAudioElement (speaker output)
    ↓
    Drew animates: listening → thinking → speaking
```

## Components

- **`Drew.tsx`** — Floating bubble avatar with 4 animation states
- **`VoiceInterface.tsx`** — State machine + Web Audio API wiring
- **`HermesAPI.ts`** — HTTP client for Hermes endpoints

## TODO (Phase 3+)

- [ ] Wire `/api/audio/speak` to real Hermes conversation (not just TTS)
- [ ] WebSocket integration for streaming responses
- [ ] Add Cloudflare Tunnel for remote access
- [ ] Persist conversation history
- [ ] Voice-only mode (no browser)

## Troubleshooting

**"Hermes health check failed"**
- Verify Omen is accessible: `ping 100.119.229.11`
- Check Hermes is running: `ssh ... systemctl --user status hermes-gateway`

**"Microphone permission denied"**
- Browser blocked microphone. Check Chrome/Safari settings → site permissions

**"No audio output"**
- Check speaker volume
- Verify ElevenLabs key is set in `~/.hermes/.env`
- Test TTS endpoint: `curl -X POST http://localhost:8642/api/audio/speak -H "Content-Type: application/json" -d '{"text":"hello"}'`

**Dev server on wrong port**
- Another app using port 3000? Next.js auto-uses next available (3002, 3003, etc.)
- To force: `next dev --port 3000`

## Build for Production

```bash
npm run build
npm run start
```

Builds optimized bundle → `.next/`
