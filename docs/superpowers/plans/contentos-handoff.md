# ContentOS — New Chat Handoff Prompt

Paste everything below the line into a new Claude Code session opened in `/Users/dhruvavutukury/DhruvaOS Mark 2`.

---

## HANDOFF PROMPT (paste into new chat)

You are picking up a DhruvaOS build session. DhruvaOS Mark 2 is Dhruva's 24/7 autonomous personal AI OS — a real Jarvis running on an HP Omen laptop (Ubuntu 24.04, GTX 1660 Ti, 32GB RAM, user: dhruva) at Tailscale IP `100.119.229.11`.

**First: read these files to contextualize yourself before doing anything else.**

```
/Users/dhruvavutukury/DhruvaOS Mark 2/CLAUDE.md          # full system overview + tech stack
/Users/dhruvavutukury/DhruvaOS Mark 2/HANDOFF.md         # subsystem contracts (read fully)
/Users/dhruvavutukury/DhruvaOS Mark 2/BUILD_PLAN.md      # phase status
/Users/dhruvavutukury/DhruvaOS Mark 2/skills/CLAUDE.md   # skill authoring rules
/Users/dhruvavutukury/DhruvaOS Mark 2/hermes/CLAUDE.md   # Hermes patterns
```

After reading those, SSH to Omen and read:
```bash
ssh dhruva@100.119.229.11
# PATH fix (always needed for non-login sessions):
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"

cat ~/xposteros/README.md
cat ~/xposteros/build_plan.md
ls ~/xposteros/
```

---

## YOUR TASK: Build ContentOS

ContentOS is a unified content creation platform extending XPosterOS. It handles:
- **X (Twitter)** — already built via XPosterOS (needs integration into unified system)
- **LinkedIn** — ✅ BUILT (`skills/dhruvaos/linkedin-post/SKILL.md` v1.0.0, 13 tests, Browserbase MCP, deploy pending credentials)
- **YouTube** — ✅ BUILT (`skills/dhruvaos/youtube-video-create/SKILL.md` v1.0.0, 40 tests, 3-approval flow, deploy pending credentials)

All three platforms share one approval workflow, one Vercel portal, and one brain-dump interface.

---

## The Approval Workflow (mirror XPosterOS exactly)

XPosterOS workflow (what already works for X):
```
1. Dhruva sends /content <seed idea> in Discord
2. Drew (Hermes) asks 3-5 targeted interview questions in Discord
3. Dhruva answers
4. Drew researches topic (Exa + GBrain search)
5. Drew generates content brief → posts preview in #corrections with [APPROVAL REQUIRED]
6. Dhruva reacts 👍
7. Drew generates full draft (script/post/video) → posts preview in #corrections
8. Dhruva reacts 👍
9. Drew publishes to platform + cross-posts
```

Key endpoints in XPosterOS (already built, at http://127.0.0.1:8081 on Omen):
- `POST /events/brain-dump` — triggers content pipeline
- `POST /approvals/draft` — approves draft, queues for posting (PRIMARY — use this one)
- `POST /events/draft-approved` — simpler bridge, no queue (do NOT use for main flow)
- `GET /drafts` — list pending drafts
- `GET /system/health` — health check

Get the API token:
```bash
ssh dhruva@100.119.229.11 "grep '^API_AUTH_TOKEN=' ~/xposteros/.env"
# That value = XPOSTEROS_API_TOKEN in ~/.hermes/.env
```

---

## What to Build

### Phase A: LinkedIn Integration

1. **LinkedIn Hermes skill** (`~/.hermes/skills/dhruvaos/linkedin-post/SKILL.md`)
   - Triggered by `/linkedin <topic>` in Discord
   - Uses same interview → research → draft → approve → publish flow
   - LinkedIn posting via LinkedIn API v2 (OAuth 2.0, same pattern as Gmail)
   - OR via browser automation if API quota is restrictive (Browserbase fallback)
   - Long-form professional posts, NOT short tweets

2. **LinkedIn OAuth setup on Omen**
   - Create LinkedIn Developer App at developer.linkedin.com
   - Scopes needed: `w_member_social` (post), `r_liteprofile` (identity)
   - OAuth desktop flow on Mac, copy token to Omen (same pattern as Gmail)
   - Store in `~/.hermes/.env`: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

3. **Add LinkedIn to XPosterOS backend** OR wire LinkedIn directly through Hermes skill
   - Recommendation: add LinkedIn as a new platform in XPosterOS (it's already a FastAPI service)
   - New endpoint: `POST /platforms/linkedin/post`
   - Reuse existing approval flow (`/approvals/draft` with `platform: "linkedin"`)

### Phase B: YouTube Integration

1. **YouTube channel** — create at youtube.com (manual step, Dhruva does this)

2. **YouTube OAuth setup on Omen**
   - Google Cloud Project already exists (from Gmail/Calendar OAuth in Phase 2)
   - Enable YouTube Data API v3 in same project
   - Add scope `https://www.googleapis.com/auth/youtube.upload` to existing OAuth credentials
   - Re-run OAuth flow to get updated `token.json` with YouTube scope
   - Store in `~/.hermes/.env`: `YOUTUBE_CHANNEL_ID`

3. **ContentOS video pipeline** (new FastAPI service OR extend XPosterOS)
   - `POST /content/youtube/ideate` — interview + research, returns content brief
   - `POST /content/youtube/script` — brief → full script + title/description/tags
   - `POST /content/youtube/thumbnail` — title → fal.ai FLUX image (512x512 → 1280x720)
   - `POST /content/youtube/render` — script → audio (defer TTS to later) + video assembly
   - `POST /content/youtube/upload` — video file → YouTube Data API v3

   **TTS voice**: Defer voice cloning for now. Leave TTS as a pluggable module.
   For initial builds: text-based or screen-recording style videos are fine.
   When ready: ElevenLabs API or Gemini 2.5 Flash for voice.

4. **Video assembly stack** (on Omen, uses Python):
   ```
   Script → ffmpeg + MoviePy → voiceover audio + images/screenshots + text overlays
   ```
   Install on Omen (in Hermes venv):
   ```bash
   source ~/.hermes/.venv/bin/activate
   pip install moviepy imageio-ffmpeg pillow
   ```

5. **fal.ai for thumbnails**:
   - Sign up at fal.ai, get API key
   - Store in `~/.hermes/.env`: `FAL_KEY`
   - Use FLUX model for thumbnail generation
   - The `fal-ai-media` skill in gstack has patterns for this

6. **YouTube Hermes skill** (`~/.hermes/skills/dhruvaos/youtube-control/SKILL.md`)
   - Triggered by `/video <seed idea>` in Discord
   - Orchestrates: ideate → script → thumbnail → render → upload → cross-post

### Phase C: Unified Vercel Portal

The XPosterOS Next.js frontend is already built and deployed on Vercel. Extend it:

1. **SSH to Omen** and read the existing frontend:
   ```bash
   cat ~/xposteros/frontend/package.json
   ls ~/xposteros/frontend/src/
   ```

2. **Add platform tabs** to the existing dashboard:
   - Current: X drafts approval queue
   - Add: LinkedIn drafts queue
   - Add: YouTube queue (ideation → script → render → upload stages)
   - Add: Content Calendar view (all pending + scheduled across platforms)

3. **Unified approval UI**: single queue, filter by platform. Each item shows:
   - Platform badge (X / LinkedIn / YouTube)
   - Draft content preview
   - Approve / Edit / Reject buttons
   - Status (draft → approved → queued → published)

4. **Deploy**: push to GitHub → Vercel auto-deploys from repo

---

## Credentials Checklist for New Chat

Before building, verify these exist on Omen in `~/.hermes/.env`:

| Key | Status | How to get |
|-----|--------|-----------|
| `XPOSTEROS_API_TOKEN` | ✅ exists | `grep API_AUTH_TOKEN ~/xposteros/.env` |
| `LINKEDIN_ACCESS_TOKEN` | ⬜ needed | LinkedIn Developer App OAuth |
| `LINKEDIN_CLIENT_ID` | ⬜ needed | LinkedIn Developer App |
| `LINKEDIN_CLIENT_SECRET` | ⬜ needed | LinkedIn Developer App |
| `YOUTUBE_CHANNEL_ID` | ⬜ needed | After channel creation |
| `FAL_KEY` | ⬜ needed | fal.ai dashboard |
| `EAI_API_KEY` (ElevenLabs) | ⬜ defer | Skip TTS for now |
| `BROWSERBASE_API_KEY` | ⬜ needed | browserbase.com → API keys |
| `BROWSERBASE_PROJECT_ID` | ⬜ needed | browserbase.com → project settings |

---

## Important Gotchas (will save hours)

**Omen SSH PATH fix** — always run this in non-login SSH sessions:
```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
```

**Hermes cron syntax** — trips up every time:
```bash
# --script takes FILENAME ONLY, not full path. File must be in ~/.hermes/scripts/
hermes cron add --name my-job --deliver discord \
  --script my-script.sh --workdir /home/dhruva/myrepo \
  '0 */2 * * *' 'description of job'
```

**GBrain MCP** — HTTP mode, not stdio:
```yaml
# ~/.hermes/config.yaml
mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"
```

**Notion MCP token** — use env var, not hardcoded:
```yaml
  notion:
    env:
      NOTION_TOKEN: "${NOTION_API_KEY}"   # NOT hardcoded
```

**Two WorkerResult classes in XPosterOS**:
- `workers/base.py` — dataclass, used by workers internally
- `api/schemas.py` — Pydantic, used by API responses
- `dhruvaos_client.py` uses `dataclasses.asdict()` — only workers call this

**XPosterOS worker script locations**:
- `/home/dhruva/xposteros/deploy/run-workers.sh` — original
- `~/.hermes/scripts/xposteros-run-workers.sh` — Hermes cron uses THIS one

**uv path on Omen**: `/home/dhruva/.hermes/bin/uv` (not in default PATH)

**Two approval endpoints** — do NOT confuse:
- `POST /approvals/draft` — PRIMARY. Supports `edited_text`, queues the post.
- `POST /events/draft-approved` — simpler bridge, no queue. Wrong one for main flow.

**XPosterOS dry-run mode**: `XPOSTER_DRY_RUN=true` in `~/xposteros/.env` — all Notion writes blocked until X credentials arrive.

---

## Build Order

1. Read all context files (this doc + CLAUDE.md files listed above)
2. SSH to Omen, read XPosterOS codebase
3. Check current health: `curl -s http://127.0.0.1:8081/system/health`
4. Plan LinkedIn integration first (simpler than YouTube, no video)
5. Build LinkedIn OAuth + XPosterOS platform extension + Hermes skill
6. Test LinkedIn approval flow end-to-end
7. Extend Vercel portal for LinkedIn
8. Build YouTube pipeline (ideation → script → thumbnail → upload)
9. YouTube OAuth + Hermes skill
10. Extend Vercel portal for YouTube
11. Unified content calendar view

---

## Quality Firewall (absolute, never skip)

From CLAUDE.md — this is non-negotiable:
> Any text that another human will read goes through Tier 2+ (Claude Sonnet 4.6)
> AND requires Dhruva's explicit Discord approval before send.
> Cost never overrides this.

Every outbound post (X, LinkedIn, YouTube description) must:
1. Be generated by Claude Sonnet 4.6 minimum
2. Preview in Discord #corrections with [APPROVAL REQUIRED] header
3. Wait for Dhruva's 👍 reaction
4. Only then publish

---

## Context Restore

Run `/context-restore` at the start of this session to load the latest checkpoint from the previous session. The most recent checkpoint file is at:
```
~/.gstack/projects/Dhruva966-DhruvaOS-Mark2/checkpoints/20260605-083346-xposteros-integration-complete.md
```

Key context from that checkpoint is embedded in this document. The checkpoint has full XPosterOS state details.
