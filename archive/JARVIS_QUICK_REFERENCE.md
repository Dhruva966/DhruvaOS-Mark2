# Jarvis Voice Interface — Quick Reference Card

## One-Page Summary

**Goal:** Screensaver-always-on bubble that listens, thinks, speaks, and executes tasks.

**Recommended Approach:** **Option C — Web-First Core + Platform Shells**

---

## Technology Stack

| Layer | Phase 6a | Phase 6b | Cost | Timeline |
|-------|---------|---------|------|----------|
| **Mac Desktop** | Next.js (existing drew-ui) | Same | $0 | 2w |
| **Omen Desktop** | Electron wrapper | Same | $0 | 2w |
| **iOS** | — | Native Swift + WKWebView | $99/yr | 2w |
| **Backend** | Hermes (no changes required) | Same | — | — |

---

## Three Options at a Glance

```
Option A: All Web (Next.js + Electron + Capacitor)
  ⚡ Ship 6a in 3 weeks
  ❌ iPhone UX poor (battery drain, non-native feel)
  ❌ Commits to web-only forever

Option B: Native by Platform (Swift + Kotlin + GTK)
  ✅ Best UX per platform
  ❌ Ship 6a in 8 weeks (requires 3 teams)
  ❌ Maintenance burden (3 codebases)

Option C: Web-First Core + Platform Shells ⭐ CHOSEN
  ✅ Ship 6a in 4 weeks
  ✅ Phase 6b upgrades iOS to native (2w more)
  ✅ 70% code reuse
  ✅ Small team (1 FE + 1 iOS dev)
```

---

## Why Option C Wins

1. **Fastest ship time** — Phase 6a in 4 weeks (parallel Mac + Omen)
2. **Incremental iOS** — Phase 6b uses native audio without full rewrite
3. **Code reuse** — HermesAPI client, state machine, error handling shared
4. **Small team** — no need to hire native platform experts immediately
5. **DRY Hermes integration** — single `/api/chat` contract for all surfaces

---

## Phase 6a Timeline (4 weeks)

| Week | Task | Status |
|------|------|--------|
| **1** | Refactor drew-ui: add real Hermes WebSocket | New `lib/HermesAPI.ts` |
| **1** | Add conversation panel, screensaver mode | New `components/*` |
| **2** | Deploy to Vercel (or self-host on Omen) | Accessible at `drew.yourdomain.com` |
| **2** | Error boundary + fallback to Discord | Graceful offline mode |
| **3** | Scaffold Omen Electron app | New `omen-voice/` service |
| **3** | IPC handlers for file read, worktree creation | Security review completed |
| **4** | Build `.deb`, test on Omen, E2E testing | Phase 6a complete ✅ |

---

## Phase 6b Timeline (2 weeks, after Phase 6a)

| Week | Task | Status |
|------|------|--------|
| **5** | Xcode project scaffold, AVAudioSession setup | SwiftUI views |
| **6** | TestFlight build, device testing | App Store ready |

---

## File Structure (New Files)

```
drew-ui/
├── components/
│   ├── VoiceInterface.tsx      (REFACTOR: real Hermes WebSocket)
│   ├── ScreensaverMode.tsx     (NEW)
│   ├── ConversationPanel.tsx   (NEW)
│   ├── TaskExecutor.tsx        (NEW)
│   └── ErrorBoundary.tsx       (NEW)
├── lib/
│   ├── HermesAPI.ts            (REFACTOR: WebSocket client)
│   ├── audioCapture.ts         (NEW: mic/speaker abstraction)
│   └── stateManager.ts         (NEW: conversation FSM)
└── hooks/
    ├── useVoiceChat.ts         (NEW)
    ├── useScreensaver.ts       (NEW)
    └── useAudioStream.ts       (NEW)

omen-voice/                     (NEW: Electron wrapper)
├── main.ts
├── preload.ts
├── src/windows/
│   ├── bubble.ts
│   └── terminal.ts
└── src/ipc/
    ├── handlers.ts
    └── types.ts

jarvis-ios/                     (NEW: Phase 6b)
├── Jarvis/
│   ├── Views/
│   ├── Models/
│   └── Services/
└── JarvisTests/
```

---

## Integration Checklist

**Hermes (no changes required for Phase 6a MVP)**
- [x] `/api/audio/transcribe` (already exists)
- [x] `/api/audio/speak` (already exists)
- [x] Quality firewall gate (already exists)
- [ ] Optional: `/api/chat` WebSocket (Phase 6a polish, can fallback to polling)

**GBrain (no changes for Phase 6a, future enhancement)**
- [x] Memory persists (existing)
- [ ] Conversation history ingest (Phase 6b+)
- [ ] Dream cycle auto-link (Phase 6b+)

**Discord (no changes)**
- [x] Briefings (existing)
- [x] Approval gate (#corrections channel)
- [x] Fallback if voice fails

---

## Success Criteria (Phase 6a)

```
☐ Drew bubble at https://drew.yourdomain.com
☐ Click Drew → real Hermes conversation (not mock)
☐ Screensaver mode <0.1% CPU idle
☐ Conversation history in sidebar
☐ Task executor shows progress
☐ Omen Electron app boots + shows terminal pane
☐ Fallback to Discord if Hermes offline
☐ Quality firewall gate fires (Tier 2+, approval required)
☐ All E2E tests pass
☐ Documentation updated

Phase 6a DONE when all boxes checked ✅
```

---

## Known Risks & Mitigations

| Risk | Fix |
|------|-----|
| Hermes `/api/chat` WS not ready | Fallback: polling `/api/audio/speak` (simpler, works) |
| Electron crashes on Omen | Systemd `Restart=on-failure` |
| iOS battery drain (Phase 6b) | Use local Piper TTS instead of ElevenLabs |
| Screensaver breaks focus (Mac) | Detect active window, disable in IDE |

---

## Key Documents

1. **[jarvis-voice-interface-architecture.md](./jarvis-voice-interface-architecture.md)** ← Full design (110 KB)
2. **[phase-6-implementation-roadmap.md](./phase-6-implementation-roadmap.md)** ← Task breakdown (95 KB)
3. **[jarvis-architecture-decision-summary.md](./jarvis-architecture-decision-summary.md)** ← Options comparison (35 KB)
4. **[JARVIS_DESIGN_REPORT.md](./JARVIS_DESIGN_REPORT.md)** ← This report (executive summary)

---

## Costs

| Item | Phase 6a | Phase 6b | Total |
|------|----------|----------|-------|
| **Engineering hours** | ~160 (1 FE, 4w) | ~80 (1 iOS, 2w) | 240 hrs |
| **Infrastructure** | $0–20/mo (Vercel) | $0–20/mo | $0–240/yr |
| **Tools** | Free (VSCode, Node, Bun) | $99/yr (Apple Dev) | $99/yr |
| **Total** | $0–240/yr | $99/yr | **$99–340/yr** |

---

## Deployment Paths

### Path 1: Mac Only
```bash
cd drew-ui && npm run build && vercel deploy --prod
```
**Result:** Accessible at `drew.yourdomain.com` immediately.

### Path 2: Mac + Omen (Full 6a)
```bash
# Path 1 + Electron
cd omen-voice && npm run build
# scp dist/*.deb to Omen
ssh dhruva@omen 'sudo dpkg -i *.deb'
pm2 start omen-voice
```
**Result:** Floating bubble on Omen desktop, full task pane.

### Path 3: Add iOS (Phase 6b)
```bash
# New Xcode project, build with swift
xcodegen --spec project.yml
xcode build → TestFlight → App Store
```
**Result:** Lock-screen voice access, native feel.

---

## Starting This Week

1. **Branch:** `git checkout -b codex/phase-6a-mac-desktop`
2. **Refactor:** `lib/HermesAPI.ts` for real Hermes WebSocket
3. **Add:** `components/ConversationPanel.tsx`
4. **Test:** `npm run test`
5. **Deploy:** `vercel deploy --prod` (or `npm start` on Omen)

---

## Status & Next Steps

| Item | Status | Owner |
|------|--------|-------|
| Architecture decision | ✅ Option C approved | Dhruva |
| Design docs complete | ✅ 240 KB published | Claude |
| Hermes API contract | ✅ No changes needed | — |
| Phase 6a ready to start | ✅ Tasks defined | Dhruva |
| Phase 6b design | ✅ Ready (deferred) | — |

**Ready to start Phase 6a? Begin with task 6a.1.1 (Hermes API refactor).**

---

**Last updated:** June 8, 2026  
**Architect:** Claude (Haiku 4.5)  
**Review:** Pending Dhruva approval  
**Ship target:** 4 weeks (Phase 6a) + 2 weeks (Phase 6b) = 6 weeks total
