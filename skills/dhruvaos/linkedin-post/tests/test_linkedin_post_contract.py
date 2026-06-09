from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


# ──────────────────────────────────────── Quality firewall

def test_linkedin_post_is_outbound_and_approval_bound():
    assert "outbound: true" in TEXT
    assert "requires_approval: true" in TEXT
    assert "Quality firewall" in TEXT
    assert "APPROVAL REQUIRED" in TEXT


def test_linkedin_post_approval_is_replay_resistant():
    assert "approval_id" in TEXT
    assert "content_hash" in TEXT
    assert "expires" in TEXT.lower()
    assert "DISCORD_ALLOWED_USER" in TEXT


def test_linkedin_post_hard_stop_before_browser():
    # Approval gate must appear BEFORE actual Playwright browser launch (chromium.launch)
    # Note: sync_playwright import check is in Step 0 prereqs (before drafting) — that's correct
    approval_pos = TEXT.find("HARD STOP")
    chromium_launch_pos = TEXT.find("chromium.launch")
    assert approval_pos != -1, "HARD STOP must be documented"
    assert chromium_launch_pos != -1, "chromium.launch must be documented"
    assert approval_pos < chromium_launch_pos, \
        "Approval gate must come before browser launch"


def test_linkedin_post_uses_local_playwright():
    # Browserbase was permanently dropped 2026-06-07; skill uses local Playwright on Omen
    assert "sync_playwright" in TEXT
    assert "linkedin_cookies.json" in TEXT
    assert "BROWSERBASE_API_KEY" not in TEXT
    assert "BROWSERBASE_PROJECT_ID" not in TEXT
    assert "browserbase_create_session" not in TEXT


def test_linkedin_post_verifies_login_before_posting():
    # Must check login state before attempting to post
    assert "not authenticated" in TEXT or "not logged in" in TEXT.lower() \
        or "authwall" in TEXT or "session_key" in TEXT


def test_linkedin_post_always_closes_browser():
    assert "browser.close()" in TEXT


def test_linkedin_post_does_not_retry_silently():
    assert "Never retry" in TEXT or "never retry" in TEXT.lower()


# ──────────────────────────────────────── Content quality

def test_linkedin_post_word_count_documented():
    assert "150" in TEXT and "300" in TEXT


def test_linkedin_post_no_hashtag_spam():
    assert "3" in TEXT and "hashtag" in TEXT.lower()


def test_linkedin_post_no_hardcoded_credentials():
    assert "sk-" not in TEXT
    assert "ntn_" not in TEXT


def test_linkedin_post_setup_instructions_present():
    assert "playwright" in TEXT.lower()
    assert "Authenticate LinkedIn" in TEXT or "log in" in TEXT.lower()
