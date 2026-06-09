---
name: github-update
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Create GitHub issues, PRs, or comments via GitHub MCP. Requires approval before any write. Quality firewall test skill."
schedule: null
gbrain:
  reads: ["projects/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - GITHUB_TOKEN
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [GitHub, Outbound, Quality-Firewall, Phase5]
---

# GitHub Update

## Purpose
Perform GitHub operations — issues, comments, releases, lookups — via the GitHub MCP. Read operations run directly; any write requires explicit Discord approval before execution.

## Context
- Trigger: `/github <action>` in Discord #corrections
- Channels: preview + approval in #corrections
- Data sources: GBrain (projects) for context when drafting issue/comment bodies; live GitHub state via MCP
- Tunables: default repo, ambiguity resolution, and voice for issue/comment bodies live in `~/brain/config/content-guidelines.md`
- Tools: GitHub MCP (`list_issues`, `get_pull_request`, `search_repositories`, `get_file_contents`, `list_commits`, `create_issue`, `add_issue_comment`, `update_issue`, `create_release`), Discord messaging + clarify

## Goal
Read operations return useful results to Discord directly. Write operations only execute after a previewed, content-hashed approval is acknowledged by Dhruva with 👍 in #corrections; otherwise they are discarded.

## Constraints
- Outbound to GitHub requires approval (writes only; reads bypass the gate).
- Reactor identity check enforced on approval.
- Approval emoji must be 👍 exactly; any other reaction is treated as rejection.
- If the preview message is edited after posting, treat the approval as invalid.
- Always show the exact text that will be written to GitHub in the preview, with a content hash.
- Never retry a failed write silently; surface the GitHub MCP error verbatim.
- If the repo is ambiguous, ask before acting; never assume a default destructively.
- If the clarify/approval tool is unavailable, abort the write and report.

## Notes
- Read tools (`list_issues`, `get_pull_request`, `search_repositories`, `get_file_contents`, `list_commits`) require no approval gate.
- Write tools always go through the approval gate, regardless of how trivial the change looks.
