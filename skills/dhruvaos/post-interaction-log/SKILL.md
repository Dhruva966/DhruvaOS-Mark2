---
name: post-interaction-log
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Command: /met <person> <notes> — log an in-person or remote interaction to brain, update GBrain facts, update Notion People DB Last Contact date."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_TASKS_CHANNEL_ID
    - NOTION_API_KEY
    - NOTION_PEOPLE_DB_ID
gbrain:
  reads: ["people/*"]
  writes: ["people/*/interactions/YYYY-MM-DD.md"]
tests: tests/
metadata:
  hermes:
    tags: [Relationships, People, CRM, Logging, Command]
---

# Post Interaction Log

## Purpose
Capture a just-happened interaction with someone in a single command — write a durable interaction log to the brain, extract any new facts about the person, refresh "last contact" both in GBrain and in Notion, and confirm to Dhruva. Keeps the relationship graph current with minimal friction.

## Context
- Trigger: `/met <person-name> <notes>` posted in any Discord channel (quoted name supported for multi-word names).
- Channels: `DISCORD_TASKS_CHANNEL_ID` (#tasks) for the confirmation.
- Data sources: GBrain semantic search over `people/*` to resolve the person's existing entry/slug; phi4-mini (Ollama) for new-fact extraction from notes; Notion People DB (`NOTION_PEOPLE_DB_ID`) for `Last Contact` update.
- Tunables: Check `~/brain/config/relationship-windows.md` for current values (what fact categories matter, how "Last Contact" is named in Notion); use sensible defaults if missing.
- Tools: `code_execution`, `terminal`, `file` read/write, GBrain MCP (`gbrain search`, `gbrain call extract_facts`, `gbrain import`), Notion API via the Hermes venv, Discord `messaging`.

## Goal
A markdown interaction log exists at `~/brain/people/<slug>/interactions/<today>.md`, GBrain has the updated `last_contact_date` fact plus any new facts the notes implied, the Notion People row's `Last Contact` is set to today (or a clear "not found" is noted), and Dhruva sees a one-message confirmation in #tasks.

## Constraints
- Internal logging — no outbound approval gate, nothing sent to the contact.
- Person-name parsing should handle quoted multi-word names and reasonable unquoted heuristics; empty `/met` invocations get a usage hint and stop.
- Never overwrite an existing interaction file for today — append with a clear separator.
- All GBrain writes go through `flock -n ~/.gbrain/gbrain-write.lock`. If the lock is busy, the markdown file is the durable record and the next embed cycle indexes it.
- Notion update is best-effort: a missing person in the Notion DB is a note, not a fatal error. GBrain is the source of truth.
- Ollama unavailable → fact extraction yields zero new facts; the interaction log itself is still the durable artifact and the skill continues.
- Use Tier 0 (phi4-mini) for fact extraction — cheap, local, no API spend.

## Notes
- Slug derivation when GBrain has no existing entry: lowercased name with spaces hyphenated, apostrophes stripped.
- Confirmation message in #tasks should reflect what actually succeeded (fact count, Notion update vs not-found) — don't claim work that didn't happen.
