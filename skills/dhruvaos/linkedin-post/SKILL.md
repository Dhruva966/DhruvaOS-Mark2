---
name: linkedin-post
version: 1.0.0
tier: 2
outbound: true
requires_approval: true
description: "Draft a LinkedIn post, preview in #corrections, post only after explicit Dhruva approval via local Playwright (headless Chromium on Omen)."
schedule: null
gbrain:
  reads: ["people/*", "projects/*", "goals/*"]
  writes: []
tests: tests/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
    - DISCORD_ALLOWED_USER
metadata:
  hermes:
    tags: [LinkedIn, Outbound, Phase5, Quality-Firewall, Playwright]
---

# LinkedIn Post (Phase 5)

**Quality firewall: Tier 2 mandatory. Approval required on EVERY run. No exceptions.**

Triggered by: `/linkedin <context or topic>` in Discord.
Example: `/linkedin Write about what I learned building DhruvaOS this summer`

This skill NEVER posts without explicit 👍 approval in #corrections.

---

## Step 0 — Prerequisites check

Verify required env vars and local Playwright are ready:
```python
import os, subprocess

missing = [v for v in ["ANTHROPIC_API_KEY", "DISCORD_CORRECTIONS_CHANNEL_ID",
                        "DISCORD_ALLOWED_USER"] if not os.environ.get(v)]
if missing:
    raise SystemExit(f"Missing env vars: {missing}. Add to ~/.hermes/.env and restart Hermes.")

# Verify Playwright + Chromium installed
pw_check = subprocess.run(
    ["python3", "-c", "from playwright.sync_api import sync_playwright; print('ok')"],
    capture_output=True, text=True, timeout=10,
)
if pw_check.returncode != 0:
    raise SystemExit(
        "Playwright not installed. Run: pip install playwright && playwright install chromium"
    )

# Verify LinkedIn session cookies file exists
cookies_file = os.path.expanduser("~/.hermes/linkedin_cookies.json")
if not os.path.exists(cookies_file):
    raise SystemExit(
        f"LinkedIn session not configured. "
        f"Run: python3 ~/.hermes/scripts/linkedin_login.py to authenticate once."
    )
```

---

## Step 1 — Load Context from GBrain

Search GBrain for relevant context before drafting:

```python
topic = "<topic from /linkedin command>"

# Three GBrain queries — combine results
results_1 = gbrain_search(topic)
results_2 = gbrain_search("recent projects accomplishments this month")
results_3 = gbrain_think("What has Dhruva been building or learning lately worth sharing publicly?")

brain_context = "\n\n".join([
    f"On topic:\n{results_1.get('answer', '')}",
    f"Recent work:\n{results_2.get('answer', '')}",
    f"Trajectory:\n{results_3.get('answer', '')}",
])
```

If GBrain returns nothing: draft from command context only, note in preview footer.

---

## Step 2 — Draft with Sonnet (Tier 2)

Using Sonnet quality reasoning, write a LinkedIn post:

**Rules for the draft:**
- 150-300 words (LinkedIn sweet spot for engagement)
- First-person voice, authentic — not corporate or promotional
- Lead with insight, story, or lesson — not announcement ("I'm excited to share...")
- No hashtag spam (max 3 relevant hashtags, at the end only)
- No emoji overdose (0-2 max, only if they fit naturally)
- End with a genuine question or insight that invites conversation
- Tone: thoughtful builder talking to builders — not self-promoter seeking validation
- Do NOT mention DhruvaOS, Drew, or personal AI systems by name (these are private)

```python
import hashlib, secrets
from datetime import datetime, timezone, timedelta

draft_text = "<generated LinkedIn post>"
approval_id = secrets.token_hex(8)
content_hash = hashlib.sha256(draft_text.encode()).hexdigest()[:16]
expires_dt = datetime.now(timezone.utc) + timedelta(minutes=10)
expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
```

---

## Step 3 — Post Preview for Approval

Use the `messaging` tool to post to `DISCORD_CORRECTIONS_CHANNEL_ID` (#corrections):

```
📤 [APPROVAL REQUIRED] linkedin-post
Approval ID: {approval_id}
Platform: LinkedIn (Dhruva's personal account)
Model: claude-sonnet-4-6 (Tier 2)
Topic: {topic}
Content SHA-256: {content_hash}
Expires: {expires} (10 min)
---
{draft_text}
---
React 👍 to post · Reply /deny {approval_id} to discard
```

**HARD STOP:** Use the `clarify` tool to wait. Timeout: 10 minutes.

Validate before proceeding:
- Reaction MUST be 👍 (not any other emoji)
- Reactor MUST be `DISCORD_ALLOWED_USER`
- Current time MUST be before `expires`
- Preview message MUST NOT have been edited

If any validation fails: post "❌ Approval rejected — [reason]. Re-run /linkedin to try again." Stop.
If timeout: post "⏱ LinkedIn draft expired — re-run /linkedin if still needed." Stop.

---

## Step 4 — Post to LinkedIn via Local Playwright

After valid 👍 approval, use headless Chromium on Omen to post to LinkedIn.

Use `terminal` to run the Playwright posting script:

```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:$PATH"

COOKIES_FILE="$HOME/.hermes/linkedin_cookies.json"
POST_TEXT='<APPROVED_DRAFT_TEXT_ESCAPED>'

python3 - <<'PLAYWRIGHT_EOF'
import json, sys, os
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

cookies_file = Path.home() / ".hermes" / "linkedin_cookies.json"
post_text = os.environ.get("LI_POST_TEXT", "")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 800},
        storage_state=str(cookies_file),
    )
    page = ctx.new_page()
    
    # Navigate to feed
    page.goto("https://www.linkedin.com/feed/", timeout=30_000)
    page.wait_for_load_state("networkidle", timeout=30_000)
    
    # Check if still logged in
    if "authwall" in page.url or page.locator("input[name='session_key']").count() > 0:
        print("AUTH_REQUIRED: LinkedIn session expired. Run linkedin_login.py to re-authenticate.")
        sys.exit(2)
    
    # Open post composer
    composer_selectors = [
        "[data-test-id='share-box-trigger']",
        "button[aria-label*='Start a post']",
        "button[aria-label*='Create a post']",
        ".share-box-feed-entry__trigger",
    ]
    opened = False
    for sel in composer_selectors:
        try:
            page.click(sel, timeout=5_000)
            opened = True
            break
        except PlaywrightTimeout:
            continue
    
    if not opened:
        print("ERROR: Could not open post composer — LinkedIn DOM may have changed")
        sys.exit(1)
    
    page.wait_for_timeout(1500)
    
    # Type post content
    editor_selectors = [
        "div[role='textbox'][aria-label*='text']",
        "[data-test-id='share-creation-state__editor']",
        ".ql-editor",
    ]
    typed = False
    for sel in editor_selectors:
        try:
            page.click(sel, timeout=5_000)
            page.keyboard.type(post_text)
            typed = True
            break
        except PlaywrightTimeout:
            continue
    
    if not typed:
        print("ERROR: Could not find post text editor")
        sys.exit(1)
    
    page.wait_for_timeout(1000)
    
    # Click Post button
    post_selectors = [
        "button[aria-label='Post']",
        "button.share-actions__primary-action",
        "button[data-test-id='share-form-update__submit-btn']",
    ]
    posted = False
    for sel in post_selectors:
        try:
            page.click(sel, timeout=5_000)
            posted = True
            break
        except PlaywrightTimeout:
            continue
    
    if not posted:
        print("ERROR: Could not click Post button")
        sys.exit(1)
    
    page.wait_for_timeout(3000)
    print("SUCCESS: LinkedIn post published")
    
    browser.close()

PLAYWRIGHT_EOF
```

Capture the exit code and stdout:
- Exit 0 with "SUCCESS": post was published
- Exit 2: session expired — stop, post auth instructions to #corrections
- Exit 1 with ERROR message: DOM changed or timing issue — post error to #corrections, do NOT retry

Save updated cookies (session refresh) after each successful run:
```bash
# Playwright storage_state auto-saves cookies; no manual step needed
```

---

## Step 5 — Confirm

Post success to Discord #corrections:
```
✅ LinkedIn post published
Topic: {topic}
Preview: {first 80 chars of draft_text}...
```

If Step 4 failed at any point: report exact failure step + screenshot description to #corrections.
Do NOT retry automatically. Let Dhruva decide.

---

## Error handling

| Failure | Action |
|---------|--------|
| Missing env vars | Stop before drafting, report which vars are missing |
| GBrain returns nothing | Draft from command context only, note "(no GBrain context)" in preview footer |
| Draft not approved in 10min | Discard, post "Approval expired" |
| LinkedIn not logged in | Stop, post authentication instructions, close browser |
| Composer not found | Try alternate selectors (see 4c); if still fails, post error + screenshot |
| Post button not found | Post error to #corrections with screenshot, do NOT guess-click |
| Playwright not installed | Step 0 stops with install instructions |
| LinkedIn session expired | Exit 2 — post auth instructions, stop |
| Composer not found | Exit 1 — post error + DOM note, do NOT retry |

**Never retry a failed post silently.** Always report to #corrections.

---

## Selector maintenance note

LinkedIn regularly updates its DOM. If selectors in Step 4 start failing, test via
a manual Playwright script and update the selector arrays in this SKILL.md.
The `data-test-id` attributes are most stable; `aria-label` second; class names drift.

---

## Prerequisites for first use

1. Install Playwright on Omen:
   ```bash
   source ~/.hermes/hermes-agent/venv/bin/activate
   pip install playwright
   playwright install chromium
   ```
2. Authenticate LinkedIn once to create the session file:
   ```bash
   python3 ~/.hermes/scripts/linkedin_login.py
   # Opens a headed browser window — log in manually, then close
   # Saves session to ~/.hermes/linkedin_cookies.json
   ```
3. Verify session: `python3 -c "from playwright.sync_api import sync_playwright; print('ok')"`
4. P3.3 quality firewall gate must have passed before this skill goes live
