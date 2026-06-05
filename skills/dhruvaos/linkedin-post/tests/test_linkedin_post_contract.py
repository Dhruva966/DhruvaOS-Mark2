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
    # Approval gate must appear BEFORE Browserbase session creation in the document
    approval_pos = TEXT.find("HARD STOP")
    browserbase_pos = TEXT.find("browserbase_create_session")
    assert approval_pos != -1, "HARD STOP must be documented"
    assert browserbase_pos != -1, "browserbase_create_session must be documented"
    assert approval_pos < browserbase_pos, \
        "Approval gate must come before browser automation"


def test_linkedin_post_requires_browserbase_env_vars():
    assert "BROWSERBASE_API_KEY" in TEXT
    assert "BROWSERBASE_PROJECT_ID" in TEXT


# ──────────────────────────────────────── Browserbase integration

def test_linkedin_post_uses_browserbase_create_session():
    assert "browserbase_create_session" in TEXT


def test_linkedin_post_verifies_login_before_posting():
    # Must check login state before attempting to post
    assert "not authenticated" in TEXT or "not logged in" in TEXT.lower() or "login form" in TEXT


def test_linkedin_post_always_closes_session():
    assert "browserbase_close_session" in TEXT
    assert "Always close" in TEXT or "always close" in TEXT.lower()


def test_linkedin_post_takes_screenshot_for_verification():
    assert "browserbase_screenshot" in TEXT


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
    assert "config.yaml" in TEXT
    assert "browserbase" in TEXT
    assert "Authenticate LinkedIn" in TEXT or "log in" in TEXT.lower()
