from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


# ──────────────────────────────────────── Quality firewall

def test_personal_site_is_outbound_and_approval_bound():
    assert "outbound: true" in TEXT
    assert "requires_approval: true" in TEXT
    assert "APPROVAL REQUIRED" in TEXT
    assert "Quality firewall" in TEXT


def test_approval_is_replay_resistant():
    assert "approval_id" in TEXT
    assert "content_hash" in TEXT
    assert "expires" in TEXT.lower()
    assert "DISCORD_ALLOWED_USER" in TEXT


def test_hard_stop_before_github_commit():
    # Approval gate must appear before GitHub MCP write in the document
    approval_pos = TEXT.find("HARD STOP")
    commit_pos = TEXT.find("create_or_update_file")
    assert approval_pos != -1, "HARD STOP must be documented"
    assert commit_pos != -1, "create_or_update_file must be documented"
    assert approval_pos < commit_pos, \
        "Approval gate must appear before the GitHub commit step"


# ──────────────────────────────────────── GitHub MCP integration

def test_uses_github_mcp_create_or_update_file():
    assert "create_or_update_file" in TEXT


def test_handles_file_update_sha():
    # Updating existing files requires fetching the current SHA first
    assert "sha" in TEXT.lower()
    assert "get_file_contents" in TEXT


def test_uses_site_repo_env_var():
    assert "SITE_REPO" in TEXT


def test_no_hardcoded_repo_path():
    # Repo must be configurable — owner/repo must be parsed from SITE_REPO at runtime
    assert "SITE_REPO" in TEXT
    assert "REPO_OWNER" in TEXT
    assert "REPO_NAME" in TEXT
    # GitHub MCP calls must reference parsed vars, not hardcoded owner
    assert '"owner": "Dhruva966"' not in TEXT


def test_requires_github_token():
    assert "GITHUB_TOKEN" in TEXT


def test_github_mcp_already_wired_note():
    # Skill should note that GitHub MCP is already set up from Phase 3
    assert "Phase 3" in TEXT or "already" in TEXT.lower()


# ──────────────────────────────────────── Command parsing

def test_supports_blog_command():
    assert "blog" in TEXT.lower()


def test_supports_project_command():
    assert "project" in TEXT.lower()


def test_supports_about_command():
    assert "about" in TEXT.lower()


def test_commit_message_matches_content_type():
    assert "commit_message" in TEXT
    assert "blog:" in TEXT or "blog post" in TEXT.lower()


# ──────────────────────────────────────── Content quality

def test_reads_existing_repo_structure():
    # Must read existing content before writing to match the format
    assert "get_file_contents" in TEXT
    assert "existing" in TEXT.lower() or "format" in TEXT.lower()


def test_no_silent_retry():
    assert "NOT retry silently" in TEXT or "do NOT retry" in TEXT or "do not retry" in TEXT.lower()


def test_error_handling_covers_repo_not_found():
    assert "404" in TEXT or "not found" in TEXT.lower()


def test_site_repo_required_not_defaulted():
    # SITE_REPO must be required, not silently defaulted
    assert 'os.environ.get("SITE_REPO")' in TEXT or "SITE_REPO" in TEXT
    # Must not silently fall back to a hardcoded repo
    assert 'os.environ.get("SITE_REPO", "Dhruva966/portfolio")' not in TEXT


def test_slug_is_sanitized():
    # Slug must sanitize path traversal characters, not just replace spaces
    assert "re.sub" in TEXT or "sanitize" in TEXT.lower()
    assert "path traversal" in TEXT or "alphanumeric" in TEXT.lower()


def test_no_hardcoded_credentials():
    assert "sk-" not in TEXT
    assert "ntn_" not in TEXT
    assert "ghp_" not in TEXT
