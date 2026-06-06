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
    - SITE_REPO
    - SITE_BRANCH
metadata:
  hermes:
    tags: [GitHub, PersonalSite, Outbound, Phase5, Quality-Firewall]
---

# Personal Site Update (Phase 5)

**Quality firewall: Tier 2 mandatory. Approval required on EVERY run. No exceptions.**

Triggered by Discord commands:
- `/site blog "<title>"` — draft + publish a blog post
- `/site project "<name>"` — add or update a project entry
- `/site about` — propose an update to the about/bio section

Uses GitHub MCP to commit content to the portfolio repo.
GitHub MCP is already wired from Phase 3 (P3.3c).

**SITE_REPO** env var must be set to the GitHub repo slug (e.g. `Dhruva966/portfolio`).

---

## Step 0 — Parse command and validate

```python
import os, re

SITE_REPO = os.environ.get("SITE_REPO")
SITE_BRANCH = os.environ.get("SITE_BRANCH", "main")
DISCORD_CORRECTIONS_CHANNEL_ID = os.environ.get("DISCORD_CORRECTIONS_CHANNEL_ID")

missing = [v for v in ["SITE_REPO", "DISCORD_CORRECTIONS_CHANNEL_ID"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")

# Parse SITE_REPO into owner/repo
if "/" not in SITE_REPO or len(SITE_REPO.split("/")) != 2:
    raise SystemExit(f"SITE_REPO must be 'owner/repo', got: {SITE_REPO!r}")
REPO_OWNER, REPO_NAME = SITE_REPO.split("/", 1)

# Parse command
# /site blog "Title" → content_type=blog, title="Title"
# /site project "Name" → content_type=project, name="Name"
# /site about → content_type=about
```

---

## Step 1 — Load context from GBrain

Search GBrain for context relevant to the update:

```python
content_type = "<blog | project | about>"
subject = "<title or name from command>"

results_1 = gbrain_search(f"{subject} details progress status")
results_2 = gbrain_search("recent accomplishments projects current work")
results_3 = gbrain_think("What is worth publishing about this topic right now?")

brain_context = "\n\n".join([
    results_1.get("answer", ""),
    results_2.get("answer", ""),
    results_3.get("answer", ""),
]).strip()
```

---

## Step 2 — Check existing site content via GitHub MCP

Before drafting, read what already exists in the repo to avoid duplication and
match the existing format:

**For blog posts:**
Use `get_file_contents` to read existing posts (e.g. `_posts/` or `content/blog/`).
Extract 2-3 recent post titles + their front matter to understand the format.

**For project entries:**
Use `get_file_contents` to read the projects file/directory to see existing entries.

**For about:**
Use `get_file_contents` to read `about.md` or `_pages/about.md`.

If the repo structure is unknown, use `get_file_contents` on `README.md` to understand
the project layout, then navigate from there.

---

## Step 3 — Draft content with Sonnet (Tier 2)

Using Sonnet reasoning, draft the site content. Match the repo's existing format
exactly (front matter fields, directory structure, date format, etc.).

**Blog post format (Jekyll-compatible — adjust if repo uses a different static site):**
```markdown
---
layout: post
title: "{title}"
date: {YYYY-MM-DD}
tags: [{relevant tags}]
excerpt: "{one-sentence summary}"
---

{post body — 300-600 words}
```

**Project entry format:**
```markdown
## {Project Name}

**Status:** {Active / Completed / Archived}
**Tech:** {comma-separated stack}
**Period:** {date range}

{2-3 sentences describing what it is and what you learned}

[GitHub]({repo_url}) | [Demo]({demo_url or omit})
```

**About update:**
Propose a specific edit as a diff — what line(s) to change and to what. Do not
rewrite the whole about page; make the smallest update that reflects the new info.

---

## Step 4 — Generate commit metadata

```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

content_type = "<blog|project|about>"
subject = "<title or name>"

if content_type == "blog":
    date_str = datetime.now().strftime("%Y-%m-%d")
    # Sanitize slug: only alphanumeric + hyphens, no path traversal characters
    slug = re.sub(r"[^a-z0-9-]", "-", subject.lower().replace(" ", "-"))[:40].strip("-")
    target_path = f"_posts/{date_str}-{slug}.md"
    commit_message = f"blog: {subject}"
elif content_type == "project":
    target_path = "projects.md"
    commit_message = f"projects: add/update {subject}"
else:
    target_path = "about.md"
    commit_message = "about: update bio"

approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(draft_content.encode()).hexdigest()[:16]
expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
```

---

## Step 5 — Post approval preview to Discord

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID` (#corrections):

```
📤 [APPROVAL REQUIRED] personal-site-update
Approval ID: {approval_id}
Repo: {SITE_REPO}
File: {target_path}
Commit: "{commit_message}"
Model: claude-sonnet-4-6 (Tier 2)
Content SHA-256: {content_hash}
Expires: {expires} (10 min)
---
{full draft content — exactly as it will be committed}
---
React 👍 to commit · Reply /deny {approval_id} to discard
```

**HARD STOP.** Use `clarify` to wait for reaction. Timeout: 10 minutes.

Validation before proceeding:
- Reaction MUST be 👍
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Current time MUST be before `expires`
- Preview message MUST NOT have been edited

If any check fails: post "❌ Approval rejected — [reason]. Re-run /site to try again." Stop.
If timeout: post "⏱ Site update draft expired — re-run /site if still needed." Stop.

---

## Step 6 — Commit via GitHub MCP (only after approval)

Use `REPO_OWNER` and `REPO_NAME` parsed from `SITE_REPO` in Step 0.

For **new files** (blog posts): use `create_or_update_file`:
```json
{
  "owner": "{REPO_OWNER}",
  "repo": "{REPO_NAME}",
  "path": "{target_path}",
  "message": "{commit_message}",
  "content": "{base64-encoded draft_content}",
  "branch": "{SITE_BRANCH}"
}
```

For **updates to existing files** (projects.md, about.md): first get the current
file's SHA via `get_file_contents`, then use `create_or_update_file` with the `sha`:
```json
{
  "owner": "{REPO_OWNER}",
  "repo": "{REPO_NAME}",
  "path": "{target_path}",
  "message": "{commit_message}",
  "content": "{base64-encoded updated_content}",
  "sha": "{current_file_sha}",
  "branch": "{SITE_BRANCH}"
}
```

---

## Step 7 — Confirm

Post to #corrections:
```
✅ Site update committed
Repo: {SITE_REPO}
File: {target_path}
Commit: {commit_sha[:8]} — "{commit_message}"
URL: {html_url from GitHub MCP response}
```

If GitHub Pages is configured on the repo, add:
```
🌐 Live in ~30s at: https://dhruva966.github.io/{repo_name}/{path}
```

---

## Error handling

| Failure | Action |
|---------|--------|
| SITE_REPO not set | Stop immediately, report which env var is missing |
| Repo not found (GitHub 404) | Post error to #corrections, check SITE_REPO + GITHUB_TOKEN permissions |
| File SHA mismatch (update conflict) | Re-fetch SHA and retry once; if still fails, post error |
| Draft not approved in 10min | Discard, post "Approval expired" |
| GitHub MCP error | Post exact error message to #corrections, do NOT retry silently |
| No posts/projects directory found | Post to #corrections: "Can't find site structure in {SITE_REPO} — reply with the correct path" |

---

## Prerequisites for first use

1. `SITE_REPO` in `~/.hermes/.env` on Omen (e.g. `SITE_REPO=Dhruva966/portfolio`)
2. `GITHUB_TOKEN` already set ✅ (wired in Phase 3)
3. GitHub MCP already registered ✅ (P3.3c)
4. Verify token has write access to SITE_REPO:
   `hermes mcp test github` → check `create_or_update_file` tool is available
5. P3.3 quality firewall gate must have passed before this skill goes live

---

## Site repo structure notes

The skill auto-detects structure by reading the repo README. Common layouts:
- Jekyll: `_posts/YYYY-MM-DD-title.md`, `_pages/about.md`, `projects.md`
- Astro: `src/content/blog/title.md`, `src/pages/about.astro`
- Hugo: `content/posts/title.md`, `content/about.md`

If the existing structure differs from the defaults above, read the repo README
in Step 2 and adjust `target_path` and `commit_message` format accordingly.
