---
name: youtube-video-create
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Create a YouTube video: interview → research → script → thumbnail → upload. Approval required before every upload."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "resources/research-*.md"]
  writes: ["resources/youtube-scripts-{{date}}.md"]
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
    - YOUTUBE_CHANNEL_ID
    - FAL_KEY
metadata:
  hermes:
    tags: [YouTube, Outbound, ContentOS, Quality-Firewall, Phase5]
---

# YouTube Video Create

## Purpose
Take a seed idea from Discord through a short interview, research it against brain + web context, draft a brief and full script, generate a thumbnail, assemble a placeholder video, and upload to YouTube as unlisted — with explicit approval at brief, script, and upload stages.

## Context
- Trigger: `/video <seed idea>` in Discord
- Channels: interview, brief approval, script approval, and upload approval all flow through #corrections
- Data sources: GBrain (projects, goals, research notes) + Exa for external context; FAL FLUX for thumbnail; ffmpeg for placeholder video; YouTube Data API via local upload script
- Tunables: see `~/brain/config/content-guidelines.md` for voice and structure, `~/brain/config/content-goals.md` for cadence/audience; duration and format come from the interview
- Tools: Discord messaging + clarify, GBrain search + think, Exa search + contents, Claude Sonnet (Tier 2), FAL HTTP API, ffmpeg, `~/.hermes/scripts/youtube-upload.py`, XPosterOS `/platforms/youtube/published`

## Goal
After a three-stage human gate (brief → script → upload), a video lands on Dhruva's YouTube channel as unlisted, with thumbnail and description ready for manual final review on YouTube Studio. Any rejected stage discards the run cleanly.

## Constraints
- Tier 2 (Sonnet 4.6) mandatory for brief and script. Approval required at brief, script, and upload — three separate human gates, no exceptions.
- Reactor identity check enforced on every approval step; reactions from any account other than DISCORD_ALLOWED_USER are rejected.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- If a preview message is edited after posting, treat its approval as invalid.
- Videos always upload as `unlisted` — never directly public. Going public is a manual YouTube Studio action.
- Do not name private systems (DhruvaOS, Drew) in titles, descriptions, scripts, or thumbnails.
- If FAL thumbnail generation fails, continue without a thumbnail and disclose it in the upload preview; do not block the run.
- If the upload script fails (e.g. OAuth token expired), stop and report instructions; never retry uploads silently.
- Voice, structure, hook style, and CTA conventions follow `~/brain/config/content-guidelines.md`.
- Approved scripts are persisted to brain at `resources/youtube-scripts-{{date}}.md`; nothing else writes there.
- Any direct `gbrain import` / `embed` invocation must be wrapped in `flock -n ~/.gbrain/gbrain-write.lock` (single-writer rule). If this skill only writes brain files and lets the stale embed cycle pick them up, that's fine — but never call gbrain CLI write commands without the flock.

## Notes
- Placeholder video is a title-card render; this is intentional until real recording/editing is wired in a later phase.
- After upload, the skill notifies XPosterOS via `/platforms/youtube/published` so ContentOS can track distribution.
- YouTube OAuth scope must include `youtube.upload`; refresh via the Google OAuth setup script if it expires.
