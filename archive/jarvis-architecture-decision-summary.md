# Jarvis Architecture Decision Summary
## Three Options Evaluated, One Recommended

**Decision made:** Option C — **Web-First Core + Platform Shells**  
**Date:** June 8, 2026  
**Applies to:** Phase 6 (Voice + Visual Avatar)

---

## Quick Comparison

| Criteria | Option A: All Web Stack | Option B: Native by Platform | **Option C: Web + Shells (CHOSEN)** |
|----------|------------------------|------------------------------|----------------------------------|
| **Codebase count** | 1 | 3 (Swift, Kotlin, JS) | 2.5 (mostly shared) |
| **Time to ship Phase 6a** | 3 weeks | 8 weeks | **4 weeks** |
| **Phase 6b (iOS) complexity** | High (Capacitor) | Low (pure Swift) | Medium (hybrid) |
| **Desktop UX** | Good | Best | **Good** |
| **Mobile UX** | Adequate | Best | Medium (Phase 6b: Swift) |
| **Team size** | Small (1 FE) | Large (mobile experts) | **Small–Medium (1 FE + iOS dev)** |
| **Maintenance burden** | Medium | High | **Medium** |
| **Performance (idle CPU)** | ~0.5% | <0.1% | **<0.1%** |
| **Battery drain (iPhone)** | High | Low | Medium (Phase 6b) |

---

## Option A: All Surfaces → Web Stack (Next.js + Electron)

### Pros
1. **Single codebase** — Drew-UI works on Mac, Omen (Electron), and iPhone (Ionic/Capacitor)
2. **Fast initial prototyping** — reuse existing drew-ui code immediately
3. **Minimal learning curve** — TypeScript/React throughout
4. **Vercel deployment** — automatic CI/CD, edge functions

### Cons
1. **Electron on Linux is heavy** — not idiomatic on Ubuntu/Omen
2. **Mobile performance** — Ionic/Capacitor adds ~100MB + overhead
3. **Battery drain** — web runtime is inefficient on mobile
4. **No native feel** — iPhone users will notice Chromium-based UI
5. **VRAM contention** — three runtime instances (Node + Electron + Bun) on Omen

### Cost
- Vercel: $20–100/mo (depending on traffic)
- Mobile app store: $99/yr Apple

### Ship time
- Phase 6a (Mac + Omen): 3–4 weeks
- Phase 6b (iOS): +2 weeks (Ionic/Capacitor)
- Total: 5–6 weeks

### Risk
**Medium.** Web stack is familiar, but Electron + Ionic is not battle-tested on Omen.

---

## Option B: Native by Platform (Swift + Kotlin + React-Native)

### Pros
1. **Best UX per platform** — native APIs, native look & feel
2. **Highest performance** — lean, battery-efficient, minimal memory
3. **Mature ecosystem** — thousands of iOS + Android libraries
4. **App Store distribution** — users download from familiar places

### Cons
1. **Three separate codebases** — Swift (iOS), Kotlin/Jetpack (Android), JavaScript (web? or repeat?)
2. **Three CI/CD pipelines** — xcodebuild, gradle, npm
3. **Requires specialized knowledge** — iOS and Android developers not interchangeable
4. **Desktop is messy** — Mac gets SwiftUI, Omen gets GTK/Electron (inconsistent)
5. **Code reuse is minimal** — only Hermes API client shared

### Cost
- Apple Developer: $99/yr
- Google Play Console: $25 one-time
- Development time: +200% vs. Option A

### Ship time
- Phase 6a (Mac native): 2 weeks
- Phase 6a (Omen): 3 weeks (GTK or Electron)
- Phase 6b (iOS native): 3 weeks
- Phase 6b (Android): +3 weeks
- Total: 6–11 weeks

### Risk
**High.** Requires hiring or learning three platforms. Overkill for Phase 6a.

---

## **Option C: Web-First Core + Platform Shells (RECOMMENDED)**

### Architecture
```
Shared Core (70% code reuse)
  ├── HermesAPI client (TypeScript)
  ├── Conversation state machine (Zustand)
  └── Audio capture abstraction

Platform Shells (30% platform-specific)
  ├── Mac: Next.js (existing drew-ui)
  ├── Omen: Electron wrapper (reuses Next.js)
  └── iOS: SwiftUI + WKWebView (Phase 6b)
```

### Pros
1. **Best of both worlds**
   - Fast ship time (next.js + electron for 6a)
   - Native feel where it matters (iOS in 6b)
2. **70% code reuse** — core conversation logic shared
3. **Incremental complexity** — Phase 6a fast, Phase 6b improves UX without rework
4. **Hybrid iOS (Phase 6b)** — SwiftUI for native look + AVAudioSession for voice
5. **Small team** — 1 FE + 1 iOS dev (part-time) sufficient
6. **Low ops overhead** — centralized Hermes contract

### Cons
1. **Not "native all the way"** — web stack for Mac/Omen (acceptable, not ideal)
2. **Two development environments** — web + native (but not three)
3. **WKWebView limitations (Phase 6b)** — can't access all native APIs without IPC

### Cost
- Phase 6a: $0 (self-hosted on Omen) + $20/mo Vercel (optional)
- Phase 6b: $99/yr Apple Developer + 2–3 weeks iOS dev effort

### Ship time
- Phase 6a (Mac + Omen): **4 weeks**
- Phase 6b (iOS): **2 weeks** (after 6a)
- Total: **6 weeks** (vs. 5–6 for Option A, 6–11 for Option B)

### Risk
**Low.** Familiar tech stack. Hybrid iOS approach proven (e.g., Slack, Discord).

---

## Decision Rationale

### Why not Option A?

While fast, it commits to Electron on Omen long-term. Electron uses ~200MB RAM + 0.5% idle CPU on a desktop, which is acceptable but not elegant. More critically, iOS performance suffers (battery, app store review risk due to size).

**Trade-off not worth it.** Pay the small upfront cost of an iOS-native audio layer in Phase 6b rather than accepting web-based UX forever.

### Why Option C wins

1. **Phase 6a MVP matches timeline** (4 weeks = ~2 sprints)
2. **iPhone gets native voice UX** without rebuilding web on iOS
3. **Omen desktop can be optimized later** (e.g., swap Electron for GTK if budget allows)
4. **Hermes integration is DRY** — one `/api/chat` contract, not platform-specific shims
5. **Allows pivoting** — if iOS demand is low, stick with web stack; if high, upgrade to native

---

## Phase 6a Scope (Weeks 1–4)

**Option C, delivered as:**

1. **Mac (existing drew-ui):** Refactor for real Hermes WebSocket, deploy to Vercel or self-host
2. **Omen (new Electron wrapper):** Wrap drew-ui in Electron, add IPC for local file read + worktree creation
3. **Backend (Hermes):** Ensure `/api/chat` WebSocket exists (or stub it; fallback to `/api/audio/speak` for MVP)

**Not included in Phase 6a:**
- iOS app (deferred to Phase 6b)
- Gojo phone integration (separate from voice interface; can run in parallel)
- Offline mode (design only; implement Phase 6b)

---

## Phase 6b Scope (Weeks 5–6, after Phase 6a)

**iOS via Swift + WKWebView hybrid:**

1. **Native audio** — `AVAudioSession` + `SpeechRecognizer` (Framework)
2. **Voice UI** — SwiftUI (buttons, animations, transcript)
3. **Web bridge** — WKWebView embeds a minimal web component (or just uses WebSocket directly)
4. **Result:** Lock-screen voice access, native feel, battery-efficient

---

## Technology Recommendations

### Phase 6a.1 (Mac)
- **Framework:** Next.js 16+ (already in use)
- **Deployment:** Vercel (for ease) OR self-hosted on Omen via Tunnel
- **Fallback:** Discord (if Hermes offline)
- **TTS:** ElevenLabs (already integrated) or local Piper (Phase 6b)
- **STT:** Hermes `/api/audio/transcribe` (Whisper backend)

### Phase 6a.2 (Omen)
- **Framework:** Electron (minimal wrapper around drew-ui)
- **IPC:** TypeScript preload + ipcMain handlers
- **Integration:** PM2 service or systemd user service
- **Security:** Allowlist for file paths + shell commands
- **Packaging:** electron-builder (produces `.deb`)

### Phase 6b (iOS)
- **Framework:** SwiftUI (native iOS 16+)
- **Audio:** `AVAudioSession`, `SpeechRecognizer` Framework, `AVAudioPlayer`
- **Networking:** `URLSessionWebSocketTask` (native WebSocket)
- **Package:** Swift Package Manager, Xcode

---

## Integration Points

### Hermes (unchanged, minimal additions)

Current:
- `GET /health` — health check
- `POST /api/audio/transcribe` — Whisper STT
- `POST /api/audio/speak` — ElevenLabs/Piper TTS

Addition (Phase 6a MVP, optional):
- `WS /api/chat` — streaming conversation (or fallback to `/api/audio/speak` polling)

**No Hermes code changes required** for Phase 6a MVP.

### GBrain (future enhancement, not Phase 6a blocker)

Phase 6b+: Conversation history → `~/brain/conversations/<date>.md`  
Dream cycle auto-links entities mentioned in voice.

**Not required for Phase 6a.**

### Quality Firewall (already in place)

All outbound text (voice responses, task summaries) must:
- Use Tier 2+ (Sonnet 4.6+)
- Post preview to `#corrections`
- Require Discord approval
- Log approval + timestamp

Voice surfaces inherit this; no special case.

---

## Known Limitations & Mitigations

| Limitation | Mitigation |
|-----------|-----------|
| Electron on Omen less elegant than native | Future: swap for GTK if budget allows; for now, acceptable for Phase 6a |
| iOS Phase 6b is hybrid, not pure native | Use SwiftUI for UI, hybrid WebView only if needed; most calls direct WebSocket |
| Screensaver mode breaks focus (Mac) | Detect window focus; disable on active IDE window |
| Hermes API versioning drifts | Lock `HermesAPI.ts` version headers; test before updating |
| Network latency (Tailscale) on Mac | Use Vercel Edge → Tailscale failover; Discord as last fallback |

---

## Success Metrics

**Phase 6a (Mac + Omen):**
1. Drew bubble accessible at `https://drew.yourdomain.com` (Mac)
2. Real Hermes conversation working (not mocked)
3. Screensaver mode <0.1% CPU idle
4. Omen Electron app boots, shows bubble + terminal pane
5. All E2E tests passing
6. Quality firewall gate fires for outbound
7. Fallback to Discord if offline

**Phase 6b (iOS, after 6a complete):**
1. Native iOS app in TestFlight
2. Voice capture via AVAudioSession (battery-efficient)
3. Conversation syncs to GBrain
4. Lock-screen accessible (via Siri Shortcut or background task)

---

## Risks & Contingencies

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Hermes `/api/chat` WS endpoint not ready | Medium | Blocks realtime progress | Fallback: polling `/api/audio/speak` |
| Electron crashes on Omen | Low | Restarts via systemd; manual restart needed | Use `Restart=on-failure` in service |
| iOS battery drain worse than expected | Medium | Limits adoption | Use native Piper TTS instead of ElevenLabs |
| Tailscale latency ruins UX | Low | Falls back to Discord | Vercel Edge as intermediary (Phase 6b) |

---

## Comparison Chart

```
Timeline (weeks to ship)
  Option A: |========| 5–6 weeks (all web, fast but mobile UX weak)
  Option B: |==================| 6–11 weeks (native best UX, slow ship)
  Option C: |========|----| 4 weeks (6a) + 2 (6b) = 6 weeks total (CHOSEN)
                    ↑ Phase 6a complete, usable MVP
                    ↑ Phase 6b improves UX

Quality/Performance (phase 6b)
  Option A: Medium (web UX on iPhone, battery drain)
  Option B: Best (pure native, but long dev time)
  Option C: Good→Best (web 6a, then upgrade to native 6b) (CHOSEN)
            ↓
            Trade: initial web on Mac/Omen for fast Phase 6a

Maintenance (long-term, post-Phase-6)
  Option A: Low (one codebase, but web on all platforms)
  Option B: High (three codebases, three CI/CD pipelines)
  Option C: Medium (shared core, platform-specific shells) (CHOSEN)
```

---

## Recommendation for Next Steps

1. **Approve Option C** — web-first core, platform shells
2. **Start Phase 6a.1** this week — refactor drew-ui, add real Hermes WebSocket
3. **Parallel:** Add `/api/chat` WebSocket endpoint to Hermes (or design fallback)
4. **Week 2:** Deploy Mac app to Vercel, test end-to-end
5. **Week 3:** Omen Electron wrapper, IPC security review
6. **Week 4:** E2E testing, documentation, Phase 6a complete
7. **Weeks 5–6:** iOS prototype (Phase 6b), can be done in parallel by separate dev

---

## References

- [Full Architecture Doc](./jarvis-voice-interface-architecture.md)
- [Implementation Roadmap](./phase-6-implementation-roadmap.md)
- [Current Drew README](../drew-ui/README.md)
- [Gojo Voice Plan](./superpowers/plans/gojo-dhruvaos-voice-plan.md)

---

**Status:** Ready for approval & Phase 6a kickoff  
**Last updated:** June 8, 2026  
**Decision owner:** Dhruva Vutukury  
**Approved by:** —
