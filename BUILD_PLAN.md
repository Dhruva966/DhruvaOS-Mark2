# DhruvaOS Mark 2 — Build Plan

## Philosophy

Mark 1 planned 7 phases. Mark 2 uses the same phase structure, re-scoped for Hermes + GBrain.
The custom infrastructure (FastAPI, Mem0, Qdrant, Graphify) is gone — replaced by Hermes and
GBrain that are installed, not built. This means Phase 0 (infrastructure) is now an install
script, not a build task.

Actual build effort concentrates in Phase 2+ (skills) and Phase 4 (self-improving loop).

---

## Phase 0: Infrastructure (SEQUENTIAL — everything depends on this)

All tasks sequential. No parallelism. Phase 1 cannot start until all P0 tasks are complete.

| Task | Command / Action | Done condition |
|------|-----------------|----------------|
| P0.1 | Create `dhruvaos` non-root user | `id dhruvaos` returns user |
| P0.2 | Install Python 3.11+ | `python3.11 --version` ≥3.11 |
| P0.3 | Install Bun | `bun --version` ≥1.3.10 |
| P0.4 | Install Node v24 via nvm | `node --version` = v24.x |
| P0.5 | Install pm2 | `pm2 --version` returns |
| P0.6 | Install Ollama | `ollama --version` returns |
| P0.7 | Pull phi4-mini | `ollama list` shows phi4-mini |
| P0.8 | Install Hermes Agent | `python -c "import hermes"` succeeds |
| P0.9 | Install GBrain | `gbrain --version` ≥0.42.1.0 |
| P0.10 | Scaffold `~/brain/` structure | 8 subdirs exist in ~/brain/ |
| P0.11 | Initialize GBrain | `gbrain onboard --check --json` green |
| P0.12 | Create Discord bot + server | Bot token obtained, 6 channels created |
| P0.13 | Create `~/.config/dhruvaos/.env` (chmod 600) | File exists, permissions 600 |
| P0.14 | Write `~/.hermes/config.yaml` | See MODEL_ROUTING.md for full content |
| P0.15 | Write `~/.gbrain/config.json` | See MEMORY.md for content |
| P0.16 | Set up Cloudflare Tunnel | `cloudflared tunnel list` shows dhruvaos |
| P0.17 | Security hardening | Discord allowlist set, YOLO=false, AppArmor installed |
| P0.18 | PM2 startup config | `pm2 list` shows gbrain-mcp + hermes, both online |

---

## Phase 1: Alive

**Goal:** Hermes is running, responds in Discord, GBrain is connected, brain has initial content.

```
P1.1  [parallel] Hermes Discord end-to-end test
P1.2  [parallel] phi4-mini Tier 0 routing verified
P1.3  [parallel] Claude Sonnet Tier 2 verified
P1.4  [parallel] Claude Opus Tier 3 verified
P1.5  [SEQUENTIAL] GBrain MCP connected (Hermes can call gbrain search)
P1.6  [SEQUENTIAL after P1.5] Obsidian vault imported into GBrain
P1.7  [after P1.6] signal-detector + brain-ops GBrain skills active
P1.8  [after P1.7] Morning briefing fires (even if stubbed) at 8am
```

**P1.1-P1.4 are parallel-safe** (different providers, no shared state).
**P1.5 + P1.6 are sequential** — both write to GBrain PGLite DB.
**P1.6 blocks P1.7** — signal-detector needs an initialized brain.

**Done condition:** Dhruva sends "hello" in #briefings → Hermes responds.

---

## Phase 2: Inbox

**Goal:** email triage works, calendar is read, morning briefing has real content.

```
P2.1  [parallel] email-triage skill: implement + test
P2.2  [parallel] calendar skill: implement + test
P2.3  [parallel] morning-briefing skill: stub → full implementation
P2.4  [parallel] evening-briefing skill: stub → full implementation
P2.5  [after P2.1-P2.4] task-prioritization skill: implement + test
P2.6  [after P2.5] Morning briefing fires with real email + calendar data
```

**Parallel worktree safety:**
P2.1-P2.4 each work on different skill YAML files — fully parallel-safe.
Any task that writes to GBrain (P2.5 writes `projects/tasks.md`) must not run concurrently
with another GBrain write. Stagger by >5 minutes if running in parallel worktrees.

**Done condition:** 8am briefing includes today's calendar + top 5 email action items + tasks.

---

## Phase 3: Menial Tasks

**Goal:** agent handles routine requests, quality firewall is enforced end-to-end.

```
P3.1  [parallel] research-synthesis skill: implement + test
P3.2  [parallel] correction-handler skill: implement + test
P3.3  [SEQUENTIAL] Quality firewall enforcement tested end-to-end:
       - Send outbound text task to Hermes
       - Verify Tier 2 (Sonnet) is used
       - Verify #corrections preview appears
       - Verify Hermes blocks until approval
       - Approve → verify message sent
P3.4  [after P3.3] All 8 starting skills verified working
```

**P3.3 is a mandatory sequential gate.** No outbound skill may be enabled before this test passes.

**Done condition:** agent handles email triage, calendar queries, task prioritization, and
research requests without intervention. Outbound approval gate fires without fail.

---

## Phase 4: Self-Improving

**Goal:** dream cycle running nightly, agent can author and promote new skills autonomously.

```
P4.1  [sequential] Dream cycle crontab installed + verified
       - crontab -l shows 2am sync and 3am dream entries
       - gbrain dream --dry-run succeeds
P4.2  [sequential] Skill authoring end-to-end test:
       - Give Hermes a novel task it has no skill for
       - Verify it executes via tools
       - Verify it writes a skill YAML to ~/.hermes/skills/
       - Verify quality gate runs (tests pass)
       - Verify trust gate fires (Discord DM if write/shell)
P4.3  [after P4.2] Tiered trust gate verified:
       - Read-only skill → auto-promoted, no DM
       - Shell skill → DM arrives with code preview
P4.4  [after P4.3] Braindump questionnaire completed (see MEMORY.md)
       Brain has meaningful content across all 10 categories
P4.5  [after P4.4] First dream cycle with real content verified
       gbrain think "my goals" returns coherent trajectory
```

**Done condition:** agent successfully authors a new skill from a novel task AND dream cycle
runs nightly producing non-trivial consolidation output.

---

## Phase 5: Network Integration

**Goal:** agent can draft and post to LinkedIn, GitHub, personal site — all gated by firewall.

Each skill in this phase: `outbound: true`, Tier 2 mandatory, approval required always.

```
P5.1  LinkedIn skill:
       - Read LinkedIn MCP / browser automation setup
       - Draft post → Tier 2 → #corrections preview → approval → post
P5.2  GitHub skill:
       - Comment, PR description, issue creation
       - Tier 2, approval, post only on /approve
P5.3  Personal site update skill:
       - Draft content → Tier 2 → #corrections → approval → deploy
```

**Done condition:** each skill fires quality firewall, requires approval, and sends only after
Dhruva explicitly approves. Test with a "this is a test post" content first.

---

## Phase 6: Voice + Mobile (future, post-UCLA move-in)

Not in current build scope. Extension points are already in the architecture.

```
P6.1  TTS: Piper (local) or ElevenLabs (cloud)
P6.2  STT: faster-whisper (local, GPU-accelerated on RTX 2060)
P6.3  Mobile: iPhone geofencing for context-aware triggers
P6.4  Wake word: always-listening local detection
```

---

## Parallel Build Safety Rules

### SEQUENTIAL (never parallelize — collision risk)

| Resource | Why |
|----------|-----|
| GBrain PGLite DB (`~/.gbrain/brain.db`) | Single-writer embedded DB; concurrent writes corrupt |
| `gbrain import`, `gbrain embed`, `gbrain dream` | All write to same DB |
| `~/.hermes/config.yaml` | Single config file; concurrent edits = merge conflicts |
| Hermes process restarts | `pm2 restart hermes` must be atomic |
| Crontab edits | `crontab -e` is not concurrent-safe |

### PARALLEL-SAFE

| Resource | Why |
|----------|-----|
| Individual skill YAML files (`skills/*.yaml`) | Different files, no shared state |
| `~/brain/**` markdown files | Different files; GBrain ingests after, not during |
| Discord channel config (`discord/*.md`) | Documentation only |
| Env var setup (`.env` — different keys) | Append-only, different variables |
| Documentation files (`*.md` in project root) | Pure writes, no shared state |
| Provider API key testing | Each tests a different provider |

### When using parallel git worktrees for BUILD_PLAN phases
- Each worktree can work on a different skill file simultaneously
- Any worktree that needs to run `gbrain import/embed/dream` → coordinate with others
- Any worktree that edits `config.yaml` → serialize, then reload Hermes

---

## Task Decomposition Template (for 15-minute units)

Each phase task should decompose to this pattern:
```
Task: <one verb + one noun>
Dominant risk: <what can go wrong>
Done condition: <verifiable test>
GBrain touch: <yes/no — if yes, coordinate with other worktrees>
Hermes config touch: <yes/no — if yes, serialize>
```

Example:
```
Task: Implement email-triage skill
Dominant risk: Gmail MCP auth fails
Done condition: `pytest tests/email-triage/ --mock-tools` passes; /email in Discord returns triage
GBrain touch: reads only (people/)
Hermes config touch: no
```

---

## Verification Before Phase Advance

Before advancing from one phase to the next, run:

```bash
# Phase 0 → Phase 1
pm2 list                          # hermes + gbrain-mcp both online
gbrain onboard --check --json     # all green
ollama list                       # phi4-mini present

# Phase 1 → Phase 2
# Send "hello" in Discord #briefings → Hermes responds
gbrain search "test"              # returns results (brain is searchable)

# Phase 2 → Phase 3
# 8am briefing fires with real calendar + email data
# /tasks in Discord → returns prioritized list

# Phase 3 → Phase 4
# Quality firewall test (see P3.3 above) — MUST PASS before Phase 4

# Phase 4 → Phase 5
# gbrain dream --dry-run succeeds
# Novel task → skill authored → trust gate fires

# Phase 5 → done
# Each outbound skill: test post → approval gate fires → approve → verify sent
```
