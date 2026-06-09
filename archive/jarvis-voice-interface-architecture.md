# Jarvis Voice Interface Architecture
## Multi-Surface Design for DhruvaOS Mark 2

**Date:** June 8, 2026  
**Status:** Phase 5-6 Planning  
**Owner:** Dhruva Vutukury  

---

## Executive Summary

Jarvis is the visual + voice interface layer for DhruvaOS — a screensaver-always-on bubble that listens, thinks, and executes tasks. This document recommends a **hybrid multi-surface approach** that keeps platform-specific concerns isolated while sharing core conversation logic through Hermes.

**Key decision:** Desktop (Drew-UI on Mac) and remote desktop (Electron/web on Omen) as Phase 6a targets, with a secondary phone/mobile pathway deferred to Phase 6b.

---

## Architecture Overview

### Three Surfaces, One Brain

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Surfaces (Phase 6)                     │
├──────────────────────┬──────────────────────┬───────────────────┤
│  Mac Browser (Drew)  │  Omen Desktop        │  iPhone (Future)  │
│  (Next.js + Tailwind)│  (Electron)          │  (Native/WebView) │
│  - screensaver mode  │  - full desktop app  │  - lock screen    │
│  - floating bubble   │  - persistent window │  - Siri shortcut  │
│  - Mac-native audio  │  - terminal panes    │  - voice only     │
│  @ custom domain     │  @ localhost/Tunnel  │  @ VPN + iCloud   │
└──────────────────────┴──────────────────────┴───────────────────┘
                          │      │      │
                          └──────┼──────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Hermes Conversation   │
                    │  API (HTTP + WS)       │
                    │  @ 100.119.229.11:8642 │
                    └────────────────────────┘
                          │      │
            ┌─────────────┴──────┴──────────┐
            ▼                               ▼
      ┌─────────────┐              ┌──────────────┐
      │ GBrain MCP  │              │ Model Router │
      │ (memory)    │              │ (Tier 0→3)   │
      └─────────────┘              └──────────────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
          ┌───────────────────────────┐
          │  Backend: Skills + Tasks  │
          │  (Devin / Custom exec)    │
          └───────────────────────────┘
```

### Design Principles

1. **Stateless audio client** — each surface handles its own microphone/speaker; Hermes owns the conversation state
2. **Shared conversation API** — single WebSocket `/api/chat` stream for all surfaces
3. **Platform-optimized UI** — drawing (Next.js), desktop (Electron), mobile (native) each use native APIs
4. **Quality firewall preserved** — approval gates live at Hermes layer, not duplicated per surface
5. **Fallback to Discord** — if any surface fails, Discord remains the always-available backup

---

## Technology Stack Comparison

### Option A: All Surfaces → Web Stack (Next.js + Electron)

| Aspect | Pro | Con |
|--------|-----|-----|
| **Code reuse** | Single codebase for Mac + Omen | Heavy JS runtime overhead |
| **Time to ship** | Fast prototype path | Electron on Linux not ideal |
| **Desktop UX** | Good (Electron works on both) | Performance/battery (Electron is heavy) |
| **Mobile** | Can use Ionic/Capacitor | Not native feel; battery drain |
| **Maintenance** | One team, one language | Three builds (web/desktop/mobile) |

**Verdict:** Not recommended for full fleet. OK for Phase 6a (Mac + Omen), but blocks mobile.

---

### Option B: Native by Platform (Swift + Kotlin + React-Native)

| Aspect | Pro | Con |
|--------|-----|-----|
| **Native feel** | Best UX per platform | Three codebases to maintain |
| **Performance** | Lean, fast, battery-efficient | High initial effort |
| **Desktop** | Mac: SwiftUI, Omen: GTK | Complex desktop builds |
| **Mobile** | iOS/Android native voice APIs | Separate CI/CD per platform |
| **Reuse** | Core logic in Hermes | UI must be platform-specific |

**Verdict:** Gold standard long-term, but overkill for Phase 6a.

---

### **Option C: Web-First Core + Platform Shells (RECOMMENDED)**

| Aspect | Outcome |
|--------|---------|
| **Phase 6a (Mac + Omen)** | Next.js (Drew on Mac) + Electron (Omen). Shared `/voice` service backend. |
| **Phase 6b (iOS future)** | Native Swift UI via `WKWebView` (hybrid) OR simple native `AVAudioSession` + WebSocket to Hermes. |
| **Code reuse** | 70% shared: HermesAPI client, state machine, conversation logic. 30% platform-specific: audio capture, rendering. |
| **Shipping speed** | Phase 6a in ~4 weeks (bootstrap existing drew-ui, add Electron wrapper for Omen). |
| **Maintenance** | Centralizes Hermes contract; surfaces vary. |

**This is the recommended approach.**

---

## Recommended Architecture: Option C Details

### 6a.1 Mac Desktop (Drew-UI — Phase 6a, T1)

**Current state:** Next.js app running locally at `localhost:3002`. Uses framer-motion bubble, Web Audio API, Hermes fallback mocks.

**Phase 6a scope:**
- Upgrade `drew-ui/` to production-ready
- Wire real Hermes conversation via WebSocket
- Add screensaver mode (always-on bubble in corner, minimal CPU)
- Deploy to custom domain (Vercel OR self-hosted on Omen via Tunnel)

**Key files:**

```
drew-ui/
├── app/
│   ├── page.tsx              (main page, imports components)
│   ├── api/
│   │   ├── chat/route.ts     (NEW: WebSocket endpoint if needed; mostly client-side)
│   │   └── health/route.ts   (NEW: Hermes health check)
│   └── screensaver/
│       └── page.tsx          (NEW: minimal bubble, full screen, 0.1% CPU idle)
│
├── components/
│   ├── Drew.tsx              (existing: avatar bubble)
│   ├── VoiceInterface.tsx     (refactor: replace mock generator with real Hermes stream)
│   ├── ScreensaverMode.tsx    (NEW: always-on, listens for double-tap or wake word)
│   ├── ConversationPanel.tsx  (NEW: scrollable chat history + transcript)
│   ├── TaskExecutor.tsx       (NEW: shows running task, progress, output)
│   └── ErrorBoundary.tsx      (NEW: fallback to Discord link)
│
├── lib/
│   ├── HermesAPI.ts           (refactor: add WebSocket chat stream)
│   ├── audioCapture.ts        (NEW: reusable mic/speaker abstraction)
│   ├── stateManager.ts        (NEW: conversation state machine)
│   └── screensaverDetector.ts (NEW: idle detection → screensaver mode)
│
├── hooks/
│   ├── useVoiceChat.ts        (NEW: custom hook for conversation lifecycle)
│   ├── useScreensaver.ts      (NEW: screensaver toggle)
│   └── useAudioStream.ts      (NEW: mic capture state)
│
└── env/
    └── .env.production        (Hermes URL for prod, Omen Tailscale IP)
```

**Deployment:**

Option 1: **Vercel** (recommended for fast iteration)
- Runs on Vercel edge; Hermes URL points to Omen via Tailscale
- `NEXT_PUBLIC_HERMES_URL=http://100.119.229.11:8642` (Tailscale IP)
- Screensaver page at `yourname.drew.app/screensaver`
- Always available, zero ops on Mac

Option 2: **Self-hosted on Omen** (recommended if custom domain + zero internet dependency)
- `npm run build && npm run start` on Omen via PM2
- Reverse proxy: Caddy/nginx with Cloudflare Tunnel
- Available at `https://drew.yourdomain.com`
- Single point of failure: Omen down = interface down
- But: faster iteration, full control, no Vercel logs

**Phase 6a Minimum Viable Product:**
1. Hermes conversation via real `/api/chat` WebSocket (not mocked)
2. Screensaver mode that activates after 3min idle
3. Conversation history in sidebar (last 10 exchanges)
4. Task indicator: "Running task: refactor auth.ts..." with progress
5. Fallback: if Hermes offline, show Discord link

---

### 6a.2 Omen Desktop (Electron Wrapper — Phase 6a, T2)

**Current state:** None. Hermes API available at `:8642`, but no desktop GUI on Omen itself.

**Phase 6a scope:**
- Wrap drew-ui as an Electron app
- Run locally on Omen at startup (systemd service or PM2)
- Window stays minimized in taskbar, floats when clicked
- Full-screen terminal pane for task output (gcc, git diff, pytest, etc.)

**New service:**

```
omen-voice/
├── main.ts                    (Electron main process, window mgmt)
├── preload.ts                 (IPC bridge: local FS, process control)
├── src/
│   ├── windows/
│   │   ├── bubble.ts         (float bubble, 300x300px, always-on-top)
│   │   ├── terminal.ts       (docked terminal pane for task output)
│   │   └── window-mgmt.ts    (show/hide/focus logic)
│   │
│   └── ipc/
│       ├── handlers.ts       (IPC for local file read, symlink creation, etc.)
│       └── types.ts          (IPC message shapes)
│
├── package.json              (Electron + drew-ui dependencies)
└── tsconfig.json
```

**Why Electron on Omen?**
- Reuses drew-ui code
- No additional language (TypeScript throughout)
- Native OS integration (taskbar icon, window controls)
- Can shell out to `git`, `gcc`, local tools via IPC

**Key IPC calls:**
- `ipc.invoke('read-file', '/path/to/file')` — read local worktree diffs
- `ipc.invoke('run-command', 'git status')` — shell commands for task output
- `ipc.invoke('create-worktree', 'gojo-<session-id>')` — spawn isolated worktree
- `ipc.invoke('get-system-status')` — GPU/CPU for task scheduling

**Deployment:**
- `electron-builder` produces a `.deb` installer
- Install via `sudo dpkg -i omen-voice_1.0.0_amd64.deb`
- Runs as `dhruva` user via systemd or PM2
- Auto-start on Omen boot

---

### 6a.3 Hermes Conversation Backend (New `/api/chat` WebSocket)

**Current state:** Hermes has `/api/audio/transcribe` and `/api/audio/speak` endpoints but no unified conversation stream.

**Phase 6a scope:**
- Add WebSocket endpoint `/api/chat` (or upgrade `/api/audio/speak` to stream responses)
- Client sends transcribed user text → Hermes routes to skill
- Hermes streams back: `{ status, type, content }`
  - `type` = `'transcribed'`, `'thinking'`, `'executing'`, `'final'`, `'error'`
  - `content` = the actual text or structured result
- Phase 6a doesn't require WebSocket per se, but allows real-time progress ("executing task X...")

**Message schema:**

```typescript
// Client → Hermes
type ChatMessage = {
  user_id: string;           // Discord user ID or username
  text: string;              // raw transcription
  context?: {
    repo?: string;           // if Gojo call
    conversation_history: Message[];
  };
};

// Hermes → Client (streaming)
type ChatResponse = {
  id: string;                // unique message ID for tracking
  timestamp: number;         // ms since epoch
  type: 'transcribed' | 'thinking' | 'executing' | 'final' | 'error';
  content: string;           // text to display or speak
  metadata?: {
    task_id?: string;        // if task spawned
    command?: string;        // if shell command ran
    output_preview?: string; // first 200 chars of output
    approval_required?: boolean;
    approval_url?: string;   // Discord #corrections link
  };
};
```

**No code change needed yet** — existing Hermes API (`/api/audio/speak`) can work, but streaming response would be cleaner. Scope for Phase 6b if bandwidth-heavy.

---

### 6b (Future) iPhone/iPad

**Defer until Phase 6b.** Three options in priority order:

1. **Native Swift + WKWebView hybrid** (recommended)
   - Swift `AVAudioSession` for mic/speaker (native APIs, battery-efficient)
   - `WKWebView` embeds small React app for status display
   - WebSocket connects directly to Hermes
   - Fastest ship, good UX, ~2 weeks

2. **Full native SwiftUI + Combine** (gold standard)
   - SwiftUI for entire UI
   - Custom `AVAudioSession` + `SpeechRecognizer` framework
   - Direct Hermes WebSocket
   - Best battery/performance, ~4 weeks

3. **React Native** (not recommended)
   - Cross-platform, but heavy on iPhone
   - Battery drain vs. native
   - Maintain Node runtime on iOS

---

## File Structure (Full Recommended Layout)

```
DhruvaOS Mark 2/
├── drew-ui/                         (Phase 6a.1: Mac desktop)
│   ├── app/
│   │   ├── page.tsx
│   │   ├── screensaver/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── chat/route.ts
│   │   │   └── health/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Drew.tsx               (refactor: cleaner state binding)
│   │   ├── VoiceInterface.tsx      (refactor: real Hermes stream)
│   │   ├── ScreensaverMode.tsx     (NEW)
│   │   ├── ConversationPanel.tsx   (NEW)
│   │   ├── TaskExecutor.tsx        (NEW)
│   │   └── ErrorBoundary.tsx       (NEW)
│   ├── lib/
│   │   ├── HermesAPI.ts            (refactor: WebSocket support)
│   │   ├── audioCapture.ts         (NEW: abstraction layer)
│   │   ├── stateManager.ts         (NEW: FSM)
│   │   └── screensaverDetector.ts  (NEW)
│   ├── hooks/
│   │   ├── useVoiceChat.ts
│   │   ├── useScreensaver.ts
│   │   └── useAudioStream.ts
│   ├── package.json                (add: next-themes, zustand, msw for mock)
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── .env.production
│
├── omen-voice/                      (Phase 6a.2: Omen desktop)
│   ├── main.ts                      (Electron main)
│   ├── preload.ts                   (IPC bridge)
│   ├── src/
│   │   ├── windows/
│   │   │   ├── bubble.ts
│   │   │   ├── terminal.ts
│   │   │   └── window-mgmt.ts
│   │   └── ipc/
│   │       ├── handlers.ts
│   │       └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── electron-builder.json
│   └── README.md
│
├── voice/                           (If adding Gojo phone voice surface)
│   ├── README.md                    (from plan docs)
│   ├── src/
│   │   ├── config.ts
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── voice.ts
│   │   │   └── mediaStream.ts
│   │   ├── personas/
│   │   │   └── gojo.ts
│   │   ├── sessions/
│   │   │   ├── store.ts
│   │   │   └── events.ts
│   │   └── coding/
│   │       ├── repoRegistry.ts
│   │       └── worktree.ts
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── jarvis-voice-interface-architecture.md   (this file)
│   └── superpowers/plans/
│       ├── gojo-dhruvaos-voice-plan.md           (existing)
│       └── phase-6-implementation-roadmap.md    (NEW: detailed task breakdown)
│
└── README.md                        (update: mention Phase 6 surfaces)
```

---

## Integration with Existing DhruvaOS

### Hermes Contracts

**No breaking changes required.** Existing Hermes API (`/api/audio/transcribe`, `/api/audio/speak`) suffices for Phase 6a.

**Recommended additions (not required for MVP):**
```yaml
# ~/.hermes/config.yaml
voice:
  surfaces:
    - mac_drew      # Next.js app
    - omen_desktop  # Electron app
  conversation_api: "http://localhost:8642/api/chat"  # new WS endpoint
  fallback_discord: true   # if voice fails, post to #corrections instead
```

### Model Routing

All outbound text (responses, task summaries) must go through existing quality firewall:
- **Tier 2+** (Sonnet 4.6+) for any user-visible response
- **Approval gate** in #corrections for outbound text
- **No cost override** — ever

Voice responses read by user → same Tier 2+ requirement. System will escalate if Tier 0/1 reasoning is insufficient.

### GBrain Memory

Conversation history (if persisted) should flow through GBrain:
- Each exchange stored in `~/brain/conversations/<date>.md`
- GBrain dream cycle auto-links entities mentioned
- Enables "remember when I asked about..." in future sessions

**Implementation:** optional for Phase 6a, required for Phase 6b (multi-device context sync).

---

## Deployment Paths

### Path 1: Mac Only (Fastest — 2 weeks)

1. Refactor drew-ui to use real Hermes WebSocket
2. Deploy to Vercel or self-host on Omen
3. Test screensaver mode
4. Done

**Cost:** $0 (Vercel free tier) or Omen electricity  
**Tradeoff:** No Omen-native GUI; must SSH in for terminal output

### Path 2: Mac + Omen (Complete Phase 6a — 4 weeks)

1. Path 1 (Mac)
2. Wrap drew-ui in Electron for Omen
3. Add IPC handlers for local file read, worktree creation
4. Deploy as systemd service
5. Test Gojo coding loop end-to-end

**Cost:** $0 (self-hosted) + Omen electricity  
**Benefit:** Full desktop experience on Omen; Gojo phone calls can show live diffs

### Path 3: All Three (Add iPhone — Phase 6b, ~6 weeks after 6a)

1. Paths 1+2
2. Build native Swift app with WKWebView hybrid
3. TestFlight internal distribution
4. Production via App Store

**Cost:** $99/yr Apple Developer Program  
**Benefit:** Lock-screen voice access, battery efficiency

---

## Risk Mitigation

### Risk: Hermes API changes during Phase 6a development

**Mitigation:** Version Hermes API contract in `HermesAPI.ts`. Version file: `X-API-Version: 2026.6` header. If Hermes changes endpoint, surface gets a clear error.

### Risk: Screensaver mode breaks focus on Mac (e.g., accidentally triggers during work)

**Mitigation:**
- Detect active window focus: don't activate screensaver while focused on IDE
- Require explicit double-tap to wake (not just audio above threshold)
- Disable screensaver during meetings (calendar integration)

### Risk: Audio permissions denied on Mac/Omen

**Mitigation:**
- Clear onboarding flow at first launch
- "Click to grant microphone permission" button
- Fallback: if permission denied, show link to Discord instead

### Risk: Electron app on Omen consumes too much CPU/RAM

**Mitigation:**
- Keep bubble minimized when not in use
- Use CSS containment to avoid layout thrashing
- Profile with DevTools before shipping

---

## Success Criteria

### Phase 6a Milestone: "Jarvis Talks"

**Definition of done:**

1. ✅ Drew bubble appears on Mac at `https://drew.custom.domain` (or `localhost:3002` in dev)
2. ✅ Click Drew → transcription works (real Hermes, not mock)
3. ✅ Hermes responds with real task execution output
4. ✅ Response is spoken via TTS (ElevenLabs or local Piper)
5. ✅ Conversation history visible in sidebar
6. ✅ Screensaver mode activates after 3min idle, shows floating bubble
7. ✅ Omen desktop app (Electron) boots, shows same interface
8. ✅ Task output visible in Omen terminal pane (e.g., git diff, pytest output)
9. ✅ Fallback to Discord if Hermes offline
10. ✅ Quality firewall gate fires for outbound text (Tier 2+, requires approval)

### Phase 6b Milestone: "Jarvis Portable"

1. ✅ Native Swift app on iPhone
2. ✅ Voice access from lock screen
3. ✅ Battery runtime ≥8 hours of casual use
4. ✅ Conversation history synced to GBrain

---

## Tech Debt & Future Refactors

### T1 Priority (Phase 6a)

- [ ] Extract state machine logic to separate module (reusable across surfaces)
- [ ] Add E2E tests with MSW (mock Hermes API)
- [ ] Document IPC contract for Omen Electron app

### T2 Priority (Phase 6b prep)

- [ ] Add GBrain sync for conversation history
- [ ] Implement unified voice command grammar (wake word, command structure)
- [ ] Build WebSocket `/api/chat` endpoint if streaming responses needed

### T3 Priority (Ops)

- [ ] AppArmor profile for Electron app (prevent malicious worktree escapes)
- [ ] Monitor GPU VRAM under voice load (STT + LLM concurrent)
- [ ] Implement battery-aware TTS selection (ElevenLabs vs. local Piper on low battery)

---

## Recommended First Task

**Start with drew-ui Phase 6a.1 (Mac desktop):**

1. **Sprint 1 (Week 1):**
   - Refactor `VoiceInterface.tsx` to use real Hermes WebSocket
   - Replace mock response generator with actual `/api/chat` call
   - Add `ConversationPanel.tsx` to show history
   - Deploy to Vercel (or Omen via Tunnel)

2. **Sprint 2 (Week 2):**
   - Add screensaver mode (`ScreensaverMode.tsx`)
   - Add `TaskExecutor.tsx` to show running task progress
   - Test end-to-end: voice → Hermes skill → TTS response
   - Verify quality firewall gate (approval required for outbound)

3. **Sprint 3+ (Weeks 3-4):**
   - Electron wrapper for Omen (`omen-voice/` service)
   - IPC handlers for file read, worktree creation
   - Terminal pane integration
   - Deploy as PM2 service on Omen

**Definition of "Phase 6a done":** All 10 success criteria ✅.

---

## Appendix: Technology Deep Dives

### Why Next.js for Drew-UI?

- **Server Components** for zero-JS rendering of static content (screensaver)
- **Edge Functions** for fallback health checks (Vercel)
- **Image Optimization** for avatar rendering
- **Built-in TypeScript** support
- **API Routes** for local Hermes health check
- **File-based routing** keeps structure predictable

### Why Electron for Omen?

- Wraps drew-ui with minimal code
- IPC to local processes (git, codex runner)
- Taskbar integration (system tray)
- No additional language (already TypeScript)
- Native window management (focus, minimize, etc.)

### Why WebSocket (not polling)?

- **Real-time progress:** "executing step 2/5..." without latency
- **Streaming responses:** Hermes streams text as it thinks, user sees "thinking..." indicator update live
- **Connection persistence:** single connection per session, not request-per-message
- **Lower bandwidth:** no polling overhead

**Not required for Phase 6a MVP,** but cleaner architecture for Phase 6b+.

### Audio Capture Abstraction

Why a separate `audioCapture.ts`?

```typescript
// lib/audioCapture.ts
export interface AudioCaptureProvider {
  requestPermission(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
}

// Web implementation (Mac)
export class WebAudioCapture implements AudioCaptureProvider { ... }

// Electron implementation (Omen)
export class ElectronAudioCapture implements AudioCaptureProvider {
  // delegates to native `mediaDevices` via IPC if needed
}
```

Allows same UI code to work across surfaces without platform branching.

---

## References

- [Current Drew README](../drew-ui/README.md)
- [Gojo Voice Plan](./superpowers/plans/gojo-dhruvaos-voice-plan.md)
- [Hermes Agent Docs](https://github.com/NousResearch/hermes-agent)
- [Electron IPC Guide](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Document version:** 1.0  
**Last updated:** June 8, 2026  
**Next review:** After Phase 6a Sprint 1 completion
