---
name: youtube-ingest
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Ingest a YouTube video: transcript → Sonnet synthesis → brain/resources/video/ → GBrain embed → connection-detector → #research."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - EXA_API_KEY
    - ANTHROPIC_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["resources/video/*"]
  writes: ["resources/video/YYYY-MM-DD-<title-slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Ingest, YouTube, Transcript, GBrain, Discord, Research, Command]
---

# YouTube Ingest

## Purpose
Turn a YouTube URL into a structured, searchable brain note — pulling the transcript directly when
available, synthesizing it into Dhruva-relevant insights, and chaining into the connection-detector
so the new note links into the rest of the brain.

## Context
- Trigger: `/ingest <youtube-url>` for any of the standard YouTube URL shapes (watch, shorts,
  youtu.be short links).
- Channels: `DISCORD_RESEARCH_CHANNEL_ID`.
- Data sources: the YouTube transcript API as the primary path; Exa contents and `yt-dlp` metadata
  as fallbacks; GBrain for deduplication.
- Tunables: transcript truncation strategy and relevance framing in
  `~/brain/config/content-goals.md` and `~/brain/config/content-guidelines.md`.
- Tools: GBrain search (dedup), `youtube_transcript_api`, Exa contents fallback, `yt-dlp` for
  metadata, Tier 1 model for synthesis, file write under `~/brain/resources/video/`, `gbrain` import
  under flock, `messaging`, and `hermes.run_skill("connection-detector", ...)`.

## Goal
At completion the video has a structured markdown note in `~/brain/resources/video/`, that note is
ingested into GBrain, the ingest is confirmed in #research, and `connection-detector` has been
triggered against the new file.

## Constraints
- Only accept valid YouTube URL shapes; anything else should explain the expected usage and stop.
- Always run the GBrain dedup check first — never re-ingest a video already in the brain.
- Prefer the transcript API; fall back to Exa contents of the video page only if no transcript is
  available, and stop with a clear error if both paths return nothing usable.
- Long transcripts must be truncated while preserving intro and conclusion context, not chopped at
  the tail.
- Tier 1 is sufficient here — YouTube captions are cleaner than podcast audio.
- Brain file path must resolve inside `~/brain/resources/video/`; reject anything that escapes.
- GBrain ingest runs under `flock -n ~/.gbrain/gbrain-write.lock`; a busy lock is not a failure —
  note it in Discord and move on, the file write is durable.
- Chain into `connection-detector` after the Discord confirmation; treat that step as best-effort.
- No outbound content and no approval gate — internal ingest confirmation only.

## Notes
- The Discord confirmation is the user-visible deliverable; the durable artifact is the brain file.
- If `yt-dlp` is missing, fall back to an Exa search for the video title rather than aborting.
