from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_github_update_is_outbound_and_approval_bound():
    assert "outbound: true" in TEXT
    assert "requires_approval: true" in TEXT
    assert "Approval ID" in TEXT
    assert "Content SHA-256" in TEXT
    assert "DISCORD_ALLOWED_USER" in TEXT


def test_github_update_prefers_fine_grained_pat():
    assert "Fine-grained PAT recommended" in TEXT
