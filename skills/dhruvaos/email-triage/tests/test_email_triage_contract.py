from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_email_triage_never_sends_replies():
    assert "NEVER reply" in TEXT
    assert "NEVER send" in TEXT
    assert "outbound: false" in TEXT


def test_email_triage_minimizes_discord_data():
    assert "Data minimization" in TEXT
    assert "Do not post full" in TEXT
    assert "DISCORD_TASKS_CHANNEL_ID" in TEXT
    assert "150703" not in TEXT
