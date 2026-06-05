---
name: github-update
version: 0.1.0
tier: 2
outbound: true
requires_approval: true
description: "Create GitHub issues, PRs, or comments via GitHub MCP. Requires approval before any write operation. Phase 5 skill."
schedule: null
gbrain:
  reads: ["projects/*"]
  writes: []
tests: tests/github-update/
platforms: [linux]
prerequisites:
  env_vars:
    - GITHUB_TOKEN
    - DISCORD_CORRECTIONS_CHANNEL_ID
metadata:
  hermes:
    tags: [GitHub, Outbound, Phase5, Quality-Firewall]
---

# GitHub Update (Phase 5)

**STATUS: Phase 5 skill — requires GitHub MCP configured + quality firewall test passed.**

Triggered by: `/github <action>` in Discord.
Examples:
- `/github create issue "Bug: login fails on Safari" in Dhruva966/portfolio`
- `/github comment on PR #42 in Dhruva966/dhruvaos with "This looks good, merging."`

Quality firewall: Tier 2 minimum, approval for EVERY write operation. Reads are auto-approved.

## GitHub MCP Setup (needed before using this skill)

Add to `~/.hermes/config.yaml`:
```yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
    enabled: true
```

Verify: `hermes mcp test github` → should show repos, issues, PRs tools.

## Supported Operations

**Read-only (no approval needed):**
- List issues/PRs
- Read PR diff
- Search code

**Write (requires approval in #corrections):**
- Create issue
- Create PR comment
- Close/merge PR
- Create release

## Step 1 — Parse Command

Determine:
- Target repo (default: Dhruva966/DhruvaOS-Mark2)
- Action type (create issue / comment / close / etc.)
- Content

## Step 2 — For Read Operations

Execute directly via GitHub MCP tools. Return results to Discord.

## Step 3 — For Write Operations: Draft + Approve

Draft the exact GitHub action:
```
📤 [APPROVAL REQUIRED] github-update
Repo: [owner/repo]
Action: [create issue / comment / etc.]
---
[EXACT CONTENT that will be written to GitHub]
---
React 👍 to execute · Reply /deny to discard
```

Post to #corrections. Wait for approval (up to 10 min).

## Step 4 — Execute via GitHub MCP

After approval, use GitHub MCP tools to execute the operation.

## Step 5 — Confirm

Post success to #corrections: `✅ GitHub [action] complete: [link]`

## Important

GITHUB_TOKEN must have appropriate permissions:
- `repo` scope for private repos
- `public_repo` scope for public repos only
- Fine-grained PAT recommended (limit to specific repos)
