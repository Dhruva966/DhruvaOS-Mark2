---
date: 2026-06-08
type: findings-report
session: deep-review-jarvis-autonomy
---

# DhruvaOS Mark 2 — June 8 Deep Review: Findings & Fixes

Adversarial review across security, reliability, proactivity, and code quality.
40-skill system, 686 contract tests, 4-tier model routing on HP Omen Ubuntu 24.04.

---

## Fixes Implemented (this session)

### P0 — Critical Security

**1. drew-ui API routes unauthenticated** _(fixed)_
- All `/api/voice/*` and `/api/drew/*` routes had zero auth. Anyone with the URL could invoke Claude/Whisper/Hermes on Dhruva's API keys.
- Fix: `drew-ui/lib/auth.ts` — `requireAuth()` with `timingSafeEqual` (timing-attack-resistant). Applied to 7 routes.
- Files: [drew-ui/lib/auth.ts](drew-ui/lib/auth.ts), all `app/api/` route handlers.

**2. VoiceInterface stuck states** _(fixed)_
- `transcribe → chat → speak` pipeline had no timeouts. Any hanging API call left UI permanently in `thinking` or `speaking` state with no escape.
- Fix: `AbortSignal.timeout(30_000)` on all 3 fetch calls.
- File: [drew-ui/components/VoiceInterface.tsx](drew-ui/components/VoiceInterface.tsx)

### P1 — Active Production Failures

**3. Hermes cron batch failure (8am + 9am)** _(fixed)_
- morning-briefing, contact-health-check, birthday-reminder: "Unknown provider 'openai'" at 8am
- api-cost-watchdog, content-calendar, content-idea-engine: HTTP 404 at 9am (deprecated model shut down June 2026)
- Root cause: global config referenced a deprecated model (shut down June 2026); morning-briefing cron had a deprecated model override that Hermes routes via OpenAI-compat endpoint (not configured).
- Fix: updated global default to `gemini-3.1-flash-lite` (already done); cleared deprecated model override from jobs.json.
- **Lesson: Gemini model IDs ALWAYS require live verification at ai.google.dev. Never trust training data.**

**4. api-cost-watchdog blind to Gemini** _(fixed)_
- Gemini is the CURRENT primary model. Watchdog grep and MODEL_PATTERNS only matched claude/gpt/phi4. Daily cost report was always $0.
- Fix: added `|gemini` to grep, added `gemini-3.1-flash-lite` and `gemini` entries to MODEL_PATTERNS + COSTS.

**5. paper-monitor silently keeping all papers** _(fixed)_
- phi4-mini returns JSON in markdown fences. `json.loads()` fails on fenced JSON; skill defaulted to score=5 (keep all). No papers were ever filtered.
- Fix: fence-stripping before `json.loads()` in `score_batch()`. Applies to any tier-0 JSON parse.

### P2 — Proactivity Gap (Jarvis north star)

**6. ambient-discord-listener skill** _(new, deployed)_
- Biggest gap between DhruvaOS and real Jarvis: Drew only responded to `/commands`. Every casual Discord message was lost context.
- Fix: new `on_message` trigger skill. phi4-mini classifies: task/goal/person/project/research/correction/context. Silent by default (replies only if `is_question_for_drew`). Writes to `daily/ambient-{{date}}.md`, feeds dream cycle.
- Files: [skills/dhruvaos/ambient-discord-listener/SKILL.md](skills/dhruvaos/ambient-discord-listener/SKILL.md), [tests/](skills/dhruvaos/ambient-discord-listener/tests/) (16 tests)

### P3 — Self-Healing Infrastructure

**7. Zero-LLM heartbeat monitor** _(new, deployed)_
- No independent watchdog existed that could survive a Hermes crash. Hermes monitoring itself = crash-blind.
- Fix: `drew-heartbeat.sh` in system crontab (`*/15 * * * *`). Checks: Hermes systemd, GBrain :3131, PM2 gbrain-mcp, morning briefing ran today, dream cycle ran last night, OAuth expiry <14 days. Alerts via ntfy.sh. Zero LLM calls.
- File: [scripts/drew-heartbeat.sh](scripts/drew-heartbeat.sh)
- **Install on Omen:** `*/15 * * * * /home/dhruva/.hermes/scripts/drew-heartbeat.sh >> ~/.hermes/logs/heartbeat.log 2>&1`

### P4 — Dev Operations

**8. dev-error-log skill** _(new, deployed)_
- No system for documenting what broke, what didn't work, and what actually fixed it across sessions.
- Fix: manual skill `dev-error-log`. Records: error description, failed fixes, working fix, root cause, tags. Reverse-chronological in `~/brain/dev/error-log.md`. GBrain ingest for high-severity.
- Files: [skills/dhruvaos/dev-error-log/SKILL.md](skills/dhruvaos/dev-error-log/SKILL.md), [tests/](skills/dhruvaos/dev-error-log/tests/) (16 tests)
- First entry already written: [brain/dev/error-log.md](brain/dev/error-log.md)

---

## Remaining Risks (not fixed this session)

### High

| Risk | Impact | Fix |
|------|--------|-----|
| **Cloudflare tunnels unauthenticated** | `api.dhruvavutukury.org` and `gbrain.dhruvavutukury.org` are open internet — anyone can hit Hermes API and GBrain MCP | Add Cloudflare Zero Trust email OTP at dash.cloudflare.com before enabling any new tunnel routes |
| **paper-monitor truncation** | Job hits `output length limit`, Discord send fails with `interpreter shutdown`. Papers aren't processed at all. | Chunk arxiv batch into ≤50 papers per llm_call; add retry on truncation |
| **Auth cookie = raw password** | `site-auth` cookie stores plaintext SITE_PASSWORD. httpOnly+secure mitigates for personal use. | Full fix: generate session token on login, store hash server-side |

### Medium

| Risk | Impact | Fix |
|------|--------|-----|
| **AppArmor in complain mode** | Profile loaded but not enforcing — Hermes can still do anything | `aa-enforce /etc/apparmor.d/dhruvaos-hermes` after verifying no denials in audit log |
| **drew-heartbeat.sh not in system crontab yet** | Deployed to Omen but not activated — no heartbeat running | SSH to Omen: `sudo crontab -e`, add `*/15 * * * * /home/dhruva/.hermes/scripts/drew-heartbeat.sh >> ~/.hermes/logs/heartbeat.log 2>&1` |
| **ambient-discord-listener needs Hermes `on_message` trigger config** | Deployed skill but Hermes needs `trigger: on_message` supported | Verify `hermes triggers list` or equivalent; may need Hermes config update to enable |
| **GBrain OAuth token expiry Sept 5 2026** | Auto-refresh script runs Aug 5 but hasn't been verified yet | Monitor refresh-gbrain-token.sh log on Aug 5 |
| **jarvis-voice direct Vercel URL unprotected** | `jarvis-voice-umber.vercel.app` bypasses the drew-ui `/jarvis` proxy auth | Add `middleware.ts` to jarvis-voice project or enable Vercel password protection |

### Low

| Risk | Impact | Fix |
|------|--------|-----|
| **failure-backlog reads skill-errors.log** | `~/brain/system/failure-log.md` missing; backlog errors on every run | Create the file: `touch ~/brain/system/failure-log.md` |
| **Braindump questions mostly unanswered** | GBrain only knows what Dhruva told it in 5/85 questions | Fill out `wiki/braindump-questions.md` and run `gbrain import` |
| **X credentials absent** | XPosterOS in dry-run forever; no social posting | Add `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` to `~/xposteros/.env` |

---

## Architecture Observations

### What's Strong
- **4-tier routing** works well. phi4-mini handling local classification is real cost savings.
- **GBrain dream cycle** is genuinely novel — nightly self-synthesis is the right architecture for compounding memory.
- **XPosterOS + approval gate** properly separates "write" from "publish".
- **YOLO mode disabled** — `require_approval_always: true` is the right default and was never breached.
- **Tier 0 skills for monitoring** (error-detection, failure-backlog, tier-watchdog) are exactly right — no LLM cost for deterministic checks.

### What Needs Work
1. **Proactivity is the biggest gap.** Before `ambient-discord-listener`, Drew was a command-response system — not an ambient AI. Jarvis notices things; Drew didn't. The new skill partially closes this but needs the `on_message` trigger to actually fire in Hermes.

2. **Model routing is fragile.** Any model name change breaks 3-5 crons simultaneously. The system needs a `hermes model verify` check in the heartbeat, not just after the fact in logs.

3. **Contract tests test structure, not behavior.** All 686 tests are string-match on SKILL.md. None test that phi4-mini actually classifies correctly, that GBrain actually ingests, or that Discord messages actually arrive. This is deliberate (Hermes --mock-tools doesn't exist) but means bugs like "phi4-mini wraps JSON in fences" go undetected for weeks.

4. **No skill versioning.** When a skill is updated locally and scp'd to Omen, there's no record of which version is deployed. The `version: 1.0.0` in frontmatter isn't checked by anything. Git + CI for skill deployment would fix this.

---

## Deployment Status (Omen)

All fixes deployed to `~/.hermes/skills/dhruvaos/` on Omen:
- `ambient-discord-listener/SKILL.md` + tests ✅
- `dev-error-log/SKILL.md` + tests ✅
- `api-cost-watchdog/SKILL.md` (gemini fix) ✅
- `paper-monitor/SKILL.md` (fence-strip fix) ✅
- `drew-heartbeat.sh` at `~/.hermes/scripts/` ✅

Pending on Omen (manual steps):
- [ ] Add `drew-heartbeat.sh` to system crontab
- [ ] Add `brain/dev/error-log.md` via `scp brain/dev/error-log.md dhruva@100.119.229.11:~/brain/dev/`
- [ ] Deploy drew-ui auth changes (`git push` + Vercel redeploy)
- [ ] Register `ambient-discord-listener` with Hermes if `on_message` trigger requires explicit config

---

## Model Reference (verified June 8, 2026 at ai.google.dev)

| Model ID | Use |
|----------|-----|
| `gemini-3.5-flash` | Best intelligence at Flash cost |
| `gemini-3.1-flash-lite` | Current default — cost-efficient ✅ |

> ⚠️ Always verify current model IDs at https://ai.google.dev/gemini-api/docs/models before configuring. Never use model names from memory — Gemini model IDs change frequently.
