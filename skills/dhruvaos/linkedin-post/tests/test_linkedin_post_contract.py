from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_linkedin_post_is_phase5_stub_with_firewall():
    assert "Phase 5 skill" in TEXT
    assert "outbound: true" in TEXT
    assert "requires_approval: true" in TEXT
    assert "Quality firewall" in TEXT


def test_linkedin_post_approval_is_replay_resistant():
    assert "Approval ID" in TEXT
    assert "Content SHA-256" in TEXT
    assert "Expires:" in TEXT
    assert "DISCORD_ALLOWED_USER" in TEXT
