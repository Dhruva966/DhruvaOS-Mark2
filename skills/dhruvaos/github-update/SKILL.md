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

Triggered by `/github <action>` in Discord #corrections.
Examples:
- `/github create issue "Bug: login fails on Safari" in Dhruva966/portfolio`
- `/github comment on PR #42 in Dhruva966/DhruvaOS-Mark2 "Looks good"`
- `/github list issues in Dhruva966/DhruvaOS-Mark2`

**Quality firewall:** EVERY write operation requires explicit 👍 approval from `DISCORD_ALLOWED_USER`.
Read operations (list, read diff, search) execute without approval.

## Step 1 — Parse Command

From the command text, determine:
- **Operation:** create-issue / comment / list-issues / read-pr / close-pr / create-release
- **Repo:** owner/repo (default: `Dhruva966/DhruvaOS-Mark2` if not specified)
- **Content:** title, body, or comment text

If the repo is not specified and the command is ambiguous, ask: "Which repo? (default: Dhruva966/DhruvaOS-Mark2)"

## Step 2 — Read Operations (no approval needed)

For `list issues`, `read PR`, `search code` — execute directly via GitHub MCP tools and return results to Discord. Skip to done.

Available GitHub MCP read tools: `list_issues`, `get_pull_request`, `search_repositories`, `get_file_contents`, `list_commits`.

## Step 3 — Write Operations: Build Approval Request

For any write operation, generate:

```python
import hashlib, secrets, datetime

approval_id = secrets.token_hex(8)   # e.g. "a3f7c21b"
content = "[EXACT text/title/body that will be written to GitHub]"
content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
expires = (datetime.datetime.utcnow() + datetime.timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
```

## Step 4 — Post Approval Request to Discord

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID` (#corrections):

```
📤 [APPROVAL REQUIRED] github-update
Approval ID: [approval_id]
Repo: [owner/repo]
Action: [create issue / comment / etc.]
Content hash: [content_hash]
Expires: [expires]
---
[EXACT content that will be written to GitHub — title + body or comment text]
---
React 👍 to execute · Reply /deny [approval_id] to discard
```

**HARD STOP.** Use the `clarify` tool to wait for a reaction or reply. Timeout: 10 minutes.

Validation before executing:
- Reaction MUST be 👍 (not any other emoji)
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Approval ID in any `/deny` reply MUST match `approval_id`
- Current time MUST be before `expires`
- The preview message MUST NOT have been edited

If any validation fails: post "❌ Approval rejected — [reason]. Discard. Re-run /github to try again." and stop.
If timeout: post "⏱ Approval expired. Discard." and stop.

## Step 5 — Execute via GitHub MCP

After valid approval, call the appropriate GitHub MCP write tool:

| Action | MCP Tool |
|--------|----------|
| Create issue | `create_issue` |
| Comment on PR/issue | `add_issue_comment` |
| Close issue | `update_issue` (state: closed) |
| Create release | `create_release` |

## Step 6 — Confirm

Post to #corrections:
```
✅ GitHub [action] complete
Repo: [owner/repo]
Link: [URL from GitHub MCP response]
```

## Error Handling

| Failure | Action |
|---------|--------|
| GitHub MCP returns error | Post error to #corrections, do NOT retry automatically |
| No approval in 10 min | Discard silently, post "Approval expired" |
| Wrong approver reacts | Ignore reaction, keep waiting until timeout |
| Clarify tool unavailable | Abort, post "Approval gate unavailable — not executing write" |
