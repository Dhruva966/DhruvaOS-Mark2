from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_github_update_is_outbound_and_approval_bound():
    assert "outbound: true" in TEXT
    assert "requires_approval: true" in TEXT
    assert "APPROVAL REQUIRED" in TEXT
    assert "DISCORD_ALLOWED_USER" in TEXT


def test_github_update_approval_is_replay_resistant():
    assert "approval_id" in TEXT
    assert "content_hash" in TEXT
    assert "expires" in TEXT


def test_github_update_hard_stop_before_execute():
    assert "HARD STOP" in TEXT
    assert "clarify" in TEXT


def test_github_update_reads_need_no_approval():
    assert "no approval" in TEXT.lower()


def test_github_update_uses_github_token():
    # GITHUB_TOKEN in .env; mapped to GITHUB_PERSONAL_ACCESS_TOKEN in MCP config
    assert "GITHUB_TOKEN" in TEXT
