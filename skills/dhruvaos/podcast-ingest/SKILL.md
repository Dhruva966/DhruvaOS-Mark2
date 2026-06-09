---
name: podcast-ingest
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Ingest a podcast/audio URL or file: download → local Whisper STT → Sonnet synthesis → brain/resources/media/ → GBrain embed → connection-detector → #research."
schedule: null
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_RESEARCH_CHANNEL_ID
gbrain:
  reads: ["resources/media/*"]
  writes: ["resources/media/YYYY-MM-DD-<title-slug>.md"]
tests: tests/
metadata:
  hermes:
    tags: [Ingest, Podcast, Audio, Whisper, STT, GBrain, Discord, Research, Command]
---

# Podcast Ingest

## Purpose
Turn an audio source (podcast URL or local audio file) into a structured, searchable brain note —
transcribed locally for cost and privacy, synthesized with Tier 2 reasoning because audio is messy
and benefits from real interpretation, and then linked into the rest of the brain via the
connection-detector chain.

## Context
- Trigger: `/ingest <audio-url-or-file-path>` from any Discord channel. YouTube URLs are routed
  to `youtube-ingest` instead.
- Channels: `DISCORD_RESEARCH_CHANNEL_ID`.
- Data sources: the audio source itself; GBrain for deduplication before downloading.
- Tunables: max download size, transcript truncation strategy, and per-platform tone live in
  `~/brain/config/content-goals.md`; relevance framing in `~/brain/config/content-guidelines.md`.
- Tools: GBrain search (dedup), HTTP download for URLs, local Whisper STT (`whisper_transcribe`),
  Tier 2 Claude Sonnet for synthesis, file write under `~/brain/resources/media/`, `gbrain` import
  under flock, `messaging`, and `hermes.run_skill("connection-detector", ...)`.

## Goal
At completion the audio is transcribed, synthesized into a structured markdown note under
`~/brain/resources/media/`, ingested into GBrain, confirmed in #research, and queued through
connection-detector — without leaving temp audio behind in `/tmp`.

## Constraints
- Refuse YouTube URLs and tell Dhruva to use `youtube-ingest`.
- Always run the GBrain dedup check before downloading; if a confident match is found, report and
  stop without re-downloading or re-transcribing.
- Transcription must use the local Whisper provider — never ship audio to an external STT API.
- Cap the input audio size so a stray giant URL cannot fill the disk; treat HTML responses as
  invalid audio.
- Truncate long transcripts to keep the synthesis prompt within budget; preserve intro and
  conclusion when truncating rather than chopping the tail.
- Tier 2 (Sonnet) is required for synthesis — podcast transcripts are noisier than video captions
  and need stronger reasoning.
- Brain file path must resolve inside `~/brain/resources/media/`; reject anything that escapes.
- Always clean up the downloaded temp file, even if a later step fails.
- GBrain ingest runs under `flock -n ~/.gbrain/gbrain-write.lock`; a busy lock is not a failure —
  note it in Discord and move on.
- Chain into `connection-detector` after the Discord confirmation; treat that step as best-effort.
- No outbound content and no approval gate — this is an internal ingest confirmation.

## Notes
- The Discord confirmation is the user-visible deliverable; the durable artifact is the brain file.
- If synthesis fails, surface that to Discord (do not silently swallow) and still attempt cleanup.
