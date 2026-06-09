# Gojo for DhruvaOS — Voice Code Agent Integration Plan

## Goal

Build `Gojo` as the first DhruvaOS phone persona: a voice-first code agent that you can call to request code changes, hear what it is doing in real time, and watch the work through a local dashboard.

This plan intentionally **does not** port the Insforge codebase wholesale. It reuses the proven ideas from `/Users/dhruvavutukury/Insforge` while making the implementation DhruvaOS-native:

- phone call in
- persona-specific voice + prompt
- live task narration
- coding-agent execution in isolated worktrees
- visible terminal/diff/event stream
- later: outbound incident calling

Day 1 wedge:

- one persona: `Gojo`
- one job: `code changes / refactors`
- one primary direction: **you call Gojo**
- outbound alert calling is explicitly deferred until the inbound coding loop is trustworthy

## Why This Shape

The Insforge repo already proves several useful product patterns:

- Twilio call entry and media streaming
- a sharp, human phone persona prompt
- live dashboard telemetry
- agent spawning and status broadcasting
- alert-triggered call setup

DhruvaOS already has the safety and operating model that Gojo should inherit:

- Hermes as the central runtime
- explicit trust and approval conventions
- worktree-friendly workflow
- local-first infrastructure on Omen
- future Phase 6 voice/mobile direction already documented

The right move is to **merge principles, not product identity**:

- keep DhruvaOS as the system
- add `Gojo` as a persona/surface
- make the code-editing loop repo-scoped and worktree-scoped
- delay multi-persona orchestration and incident calling until the first loop is stable

## Non-Goals for V1

Do not build these in the first merge sequence:

- full “Jarvis” animated monitor experience
- multi-persona switching in one call
- location-aware behavior
- outbound incident calling
- autonomous production remediation
- PR creation / GitHub push from phone by default
- broad “talk to all of Hermes” access

## Architecture Decision

### Adopt from Gojo conceptually

Use the Insforge repo as a reference for:

- route layout (`/voice`, `/media-stream`, dashboard event feed)
- session lifecycle
- persona prompt construction
- live telemetry shape
- phone UX pacing

Do **not** directly depend on Insforge-specific concepts:

- InsForge SDK
- Gemini infra tool schema
- sponsor branding / hackathon UI
- Devin-specific assumptions

### DhruvaOS-native target

Create a new top-level runtime surface inside this repo:

```text
voice/
  README.md
  package.json
  tsconfig.json
  public/index.html
  src/
    config.ts
    server.ts
    routes/
      voice.ts
      mediaStream.ts
      events.ts
    personas/
      gojo.ts
      registry.ts
    sessions/
      store.ts
      events.ts
      transcript.ts
      artifacts.ts
    coding/
      repoRegistry.ts
      worktree.ts
      taskParser.ts
      codexRunner.ts
      statusWatcher.ts
    audio/
      liveSession.ts
      stt.ts
      tts.ts
```

Design intent:

- `voice/` is a self-contained Node service
- Hermes remains the system of record for skills and policy
- Gojo is a specialized surface over a narrower code-agent workflow

## Product Contract for V1

### User flow

1. Dhruva calls the Gojo phone number.
2. Gojo greets in persona and asks which repo if not already resolved.
3. Gojo restates the requested change in one sentence.
4. Gojo creates a fresh isolated worktree on a new branch.
5. Gojo inspects the repo and gives short spoken checkpoints.
6. Gojo makes local code changes through a controlled runner.
7. Gojo runs targeted verification.
8. Gojo summarizes outcome, branch, worktree path, and next step.
9. Dashboard shows transcript, terminal/status stream, diffs, and verification results.

### Repo selection

V1 should use a pre-registered repo registry instead of arbitrary spoken paths.

Reason:

- safer than free-form local path access
- better phone UX
- enables nicknames like `DhruvaOS`, `Insforge`, `XPosterOS`
- keeps the coding runner scoped

### Worktree rule

Every phone-initiated coding task runs in a fresh isolated worktree by default.

Reason:

- preserves the current checkout
- avoids conflicts with active local work
- gives each phone session a durable artifact
- makes merge/review later much cleaner

### Permission model

For V1, the phone call itself authorizes:

- repo inspection
- worktree creation
- local code edits
- local test/build verification

Separate confirmation is still required for:

- destructive commands
- migrations against real infra
- service restarts on Omen
- git push
- PR creation
- any third-party-visible output

## Exact Files to Create or Modify

### New runtime surface

Create:

- `voice/README.md`
- `voice/package.json`
- `voice/tsconfig.json`
- `voice/public/index.html`
- `voice/src/config.ts`
- `voice/src/server.ts`
- `voice/src/routes/voice.ts`
- `voice/src/routes/mediaStream.ts`
- `voice/src/routes/events.ts`
- `voice/src/personas/gojo.ts`
- `voice/src/personas/registry.ts`
- `voice/src/sessions/store.ts`
- `voice/src/sessions/events.ts`
- `voice/src/sessions/transcript.ts`
- `voice/src/sessions/artifacts.ts`
- `voice/src/coding/repoRegistry.ts`
- `voice/src/coding/worktree.ts`
- `voice/src/coding/taskParser.ts`
- `voice/src/coding/codexRunner.ts`
- `voice/src/coding/statusWatcher.ts`
- `voice/src/audio/liveSession.ts`
- `voice/src/audio/stt.ts`
- `voice/src/audio/tts.ts`

### DhruvaOS docs/contracts

Modify:

- `ARCHITECTURE.md`
- `BUILD_PLAN.md`
- `HANDOFF.md`
- `DEPLOYMENT.md`
- `README.md`
- `SKILLS.md`

### New DhruvaOS docs

Create:

- `docs/superpowers/plans/gojo-dhruvaos-voice-plan.md` (this file)
- `docs/voice-repo-registry.md`

### Optional future skill specs

Create later, not in the first runtime merge:

- `skills/dhruvaos/gojo-session-log/SKILL.md`
- `skills/dhruvaos/gojo-incident-call/SKILL.md`

## Task Plan

### Task 1 — Contracts and docs foundation

Goal:

Add Gojo as an explicit Phase 6 subproject in repo docs before implementation starts.

Files:

- `ARCHITECTURE.md`
- `BUILD_PLAN.md`
- `HANDOFF.md`
- `DEPLOYMENT.md`
- `README.md`
- `SKILLS.md`
- `docs/voice-repo-registry.md`

Changes:

- define `Gojo` as a DhruvaOS persona, not a separate system
- define the `voice/` service boundary
- add repo-registry concept
- add worktree-per-call policy
- add rollout sequence and future outbound-alert phase
- document env vars and process model

Verify with:

- doc review for internal consistency
- `rg -n "Gojo|voice/|repo registry|worktree" ARCHITECTURE.md BUILD_PLAN.md HANDOFF.md DEPLOYMENT.md README.md SKILLS.md docs/voice-repo-registry.md`

### Task 2 — Service scaffold

Goal:

Create the `voice/` service with bootable local structure and no telephony dependency yet.

Files:

- all base files under `voice/`

Changes:

- initialize package metadata
- add TypeScript build/check scripts
- boot Express server
- expose `/health` and `/api/events`
- serve a minimal local dashboard shell

Verify with:

- `cd voice && npm run check`
- `cd voice && npm run dev`
- open local dashboard and confirm health/event endpoints respond

### Task 3 — Repo registry + worktree engine

Goal:

Teach Gojo how to resolve approved repos and create isolated worktrees.

Files:

- `voice/src/coding/repoRegistry.ts`
- `voice/src/coding/worktree.ts`
- `docs/voice-repo-registry.md`

Changes:

- registry format for repo nickname → absolute path → default base branch
- worktree creation helper
- branch naming convention for phone sessions
- artifact return shape: repo, branch, worktree path, base branch

Branch naming rule:

- `codex/gojo-<repo-slug>-<timestamp>`

Worktree location rule:

- prefer repo-local convention where it already exists
- DhruvaOS: `.claude/worktrees/gojo-<session-id>`
- other repos: create or reuse `.claude/worktrees/`

Verify with:

- dry-run worktree creation against DhruvaOS and Insforge
- `git worktree list`
- `git status --short --branch` in main checkout and new worktree

### Task 4 — Coding runner

Goal:

Create a controlled execution path for “inspect repo, make local changes, report status.”

Files:

- `voice/src/coding/codexRunner.ts`
- `voice/src/coding/statusWatcher.ts`
- `voice/src/sessions/events.ts`
- `voice/src/sessions/artifacts.ts`

Changes:

- session object lifecycle
- command/status event streaming
- transcript-to-task normalization
- artifact capture: branch, worktree, touched files, verification commands, summary

Important constraint:

V1 should stop at local changes plus verification summary. No automatic push/PR.

Verify with:

- mock session run using a local scripted task
- confirm dashboard receives ordered status events
- confirm artifacts persisted to session store

### Task 5 — Voice loop

Goal:

Enable the actual phone conversation loop for Gojo.

Files:

- `voice/src/routes/voice.ts`
- `voice/src/routes/mediaStream.ts`
- `voice/src/audio/liveSession.ts`
- `voice/src/audio/stt.ts`
- `voice/src/audio/tts.ts`
- `voice/src/personas/gojo.ts`
- `voice/src/personas/registry.ts`

Changes:

- Twilio-compatible voice route
- persona-specific greeting + style
- short spoken checkpoints
- voice turn → coding task handoff
- coding progress → spoken summaries

No-spend-first rule:

- first build against a local text-mode or mocked audio loop
- only wire paid PSTN/voice provider after the task loop works locally

Verify with:

- local simulated session
- then Twilio test call if credentials already exist
- confirm transcript, spoken summaries, and event stream all line up

### Task 6 — Dashboard

Goal:

Give the phone session a visual surface that makes the work legible.

Files:

- `voice/public/index.html`
- `voice/src/routes/events.ts`
- `voice/src/sessions/events.ts`

Dashboard sections:

- current session status
- transcript
- current repo / branch / worktree
- command/status timeline
- touched files
- verification results
- final summary

V1 dashboard requirement:

- useful, not cinematic
- terminal/status-first
- diff-aware if practical

Verify with:

- open local dashboard during a mock coding session
- confirm refresh/reconnect behavior
- confirm no event ordering regressions

### Task 7 — Phase 6 documentation sync

Goal:

Fold the implementation back into the canonical DhruvaOS docs so Phase 6 is no longer abstract.

Files:

- `BUILD_PLAN.md`
- `HANDOFF.md`
- `ARCHITECTURE.md`
- `DEPLOYMENT.md`
- `README.md`

Changes:

- split Phase 6 into `6a Gojo voice code agent` and later `6b incident calling / mobile context`
- replace generic “Twilio → Whisper → Hermes → TTS” language with the actual service boundary
- document repo registry and worktree policy

Verify with:

- doc consistency pass
- grep all Phase 6 references and resolve contradictions

## Branch and Worktree Plan

This work should be built in **separate worktrees** and merged in narrow slices.

### Worktree 1 — docs/contracts

- branch: `codex/gojo-docs-contracts`
- purpose: architecture, handoff, deployment, build plan, repo registry docs

Merge gate:

- docs internally consistent
- no runtime code yet

### Worktree 2 — runtime scaffold

- branch: `codex/gojo-runtime-scaffold`
- purpose: `voice/` package, server boot, dashboard shell, event API

Merge gate:

- `npm run check` passes in `voice/`
- local server boots

### Worktree 3 — repo registry + worktree engine

- branch: `codex/gojo-worktree-engine`
- purpose: safe repo resolution + isolated worktree creation

Merge gate:

- dry-run and real worktree creation tested
- no edits to user-active checkout

### Worktree 4 — coding runner

- branch: `codex/gojo-coding-runner`
- purpose: session lifecycle, controlled execution, artifact capture

Merge gate:

- mock session completes end to end
- status events emitted correctly

### Worktree 5 — voice loop

- branch: `codex/gojo-voice-loop`
- purpose: phone/text voice interaction and spoken status updates

Merge gate:

- local simulated loop works
- PSTN test only if credentials already exist

### Worktree 6 — dashboard polish

- branch: `codex/gojo-dashboard`
- purpose: watch surface for sessions

Merge gate:

- dashboard useful during a live run
- no blocking UI regressions

### Deferred worktree — incident calling

- branch: `codex/gojo-incident-calls`
- purpose: outbound high-severity call flow

Do not start until:

- inbound coding loop is trusted
- severity policy is explicit
- dedupe/anti-spam rules are defined

## Merge Sequence

Merge order should be:

1. docs/contracts
2. runtime scaffold
3. repo registry + worktree engine
4. coding runner
5. voice loop
6. dashboard
7. later: incident calling

Why this order:

- docs first prevents architectural drift
- scaffold before behavior keeps diffs reviewable
- worktree engine is the safety foundation for all code-edit sessions
- dashboard after runner avoids UI being built against imaginary events

## Verification Matrix

### Repo safety

Checks:

- worktree created under expected path
- branch names match convention
- main checkout remains untouched

Commands:

- `git worktree list`
- `git status --short --branch`
- targeted test repo mutation in worktree only

### Session correctness

Checks:

- one spoken task becomes one session record
- repo, branch, and worktree path recorded
- artifacts survive call end

### Dashboard correctness

Checks:

- transcript updates live
- status events stay ordered
- verification results visible

### Voice UX

Checks:

- greeting is short and persona-specific
- no spammy chatter during long tasks
- blockers become explicit spoken questions

### Safety

Checks:

- no push/PR by default
- no arbitrary repo path access
- no destructive commands without explicit confirmation

## Operational Constraints

### Spend constraint

Do not design V1 around new paid dependencies.

Approach:

- build the coding loop locally first
- use mocked or text-mode audio locally
- only wire Twilio or another paid call transport if already available
- do not introduce Browserbase, Devin, or additional paid agent platforms into V1

### Runtime ownership

Gojo should not bypass Hermes’ worldview; it should complement it.

Practical rule:

- Gojo owns the phone session and coding loop
- Hermes remains the broader DhruvaOS orchestration/runtime layer
- future shared preferences can live in DhruvaOS docs/skills, not hard-coded per persona

### Security posture

V1 should assume:

- only Dhruva can call/use the system once auth is configured
- repo access is allowlisted
- phone sessions create local artifacts, not external side effects by default

## Risks and Dangerous Assumptions

### Risk 1 — Over-coupling Gojo to Hermes internals

If the first version tries to expose all Hermes skills by voice, scope will explode.

Mitigation:

- keep V1 code-agent only

### Risk 2 — Treating the call as sufficient for all permissions

That is too broad for production-affecting steps.

Mitigation:

- split local edits from privileged actions

### Risk 3 — Copying Insforge architecture too literally

Insforge is a demo product for infra control; DhruvaOS needs a narrower operator workflow.

Mitigation:

- reuse patterns, not branding or assumptions

### Risk 4 — Building incident calling too early

This will create spam and trust damage before the inbound loop is even good.

Mitigation:

- explicitly defer incident calling to a later worktree

### Risk 5 — No repo registry

Free-form spoken paths are an avoidable safety footgun.

Mitigation:

- pre-registered repo nicknames only in V1

## Strongest Next Step

Implement **Worktree 1: docs/contracts** and **Worktree 2: runtime scaffold** first.

That gets DhruvaOS from “idea” to a stable integration boundary without prematurely committing to telephony or voice-provider details.

After that, the first truly meaningful demo is:

1. start local `voice/` service
2. open dashboard
3. trigger a mock Gojo session
4. choose `DhruvaOS`
5. create a fresh worktree
6. run a tiny code-edit task
7. see transcript, status, branch, and verification on screen

That is the smallest version that already feels like the beginning of Jarvis instead of just another chatbot wrapper.
