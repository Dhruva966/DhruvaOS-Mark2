---
name: personal-site-update
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a personal site update (blog post or project entry), preview in #corrections, commit to portfolio repo only after Dhruva approval via GitHub MCP."
schedule: null
gbrain:
  reads: ["projects/*", "goals/*", "people/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - GITHUB_TOKEN
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
    - SITE_REPO
    - SITE_BRANCH
metadata:
  hermes:
    tags: [GitHub, PersonalSite, Outbound, Phase5, Quality-Firewall]
---

# Personal Site Update

## Purpose
Draft an update to Dhruva's personal site — blog post, project entry, or about edit — match the repo's existing format, and commit only after Discord approval via GitHub MCP. Also acts as the publishing target for blog-draft.

## Context
- Trigger: `/site blog "<title>"`, `/site project "<name>"`, `/site about` in Discord
- Channels: preview + approval in #corrections
- Data sources: GBrain (projects, goals, people) plus the live repo contents (read via GitHub MCP) to match existing structure
- Tunables: see `~/brain/config/content-guidelines.md` for voice, length, and structure; repo conventions detected from the site itself
- Tools: GBrain search + think, Claude Sonnet (Tier 2), GitHub MCP (`get_file_contents`, `create_or_update_file`), Discord messaging + clarify

## Goal
A site update is drafted in the repo's existing format, previewed in #corrections, and — on explicit 👍 from Dhruva — committed to `SITE_REPO` on `SITE_BRANCH`. Without approval, nothing is committed.

## Constraints
- Tier 2 (Sonnet 4.6) mandatory. Approval required on every run, no exceptions.
- Outbound to GitHub requires approval.
- Reactor identity check enforced on approval.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- If the preview message is edited after posting, treat the approval as invalid.
- Always read existing site content first to match front matter, directory layout, and tone before drafting.
- For updates to existing files, fetch current SHA via GitHub MCP before writing; do not bypass conflict checks.
- Slugs must be sanitized (alphanumeric + hyphens only) — never allow path traversal characters.
- Never retry a failed commit silently; report the exact GitHub MCP error.
- Voice, length, and structure follow `~/brain/config/content-guidelines.md`.
- Do not name private systems in outbound copy.

## Notes
- Site structure auto-detects against common static-site layouts (Jekyll, Astro, Hugo); when the repo differs, read the README and adjust paths from there.
- When invoked downstream from blog-draft, the title and approved body are passed in directly and no re-drafting happens.
