from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_calendar_read_is_read_only():
    assert "outbound: false" in TEXT
    assert "requires_approval: false" in TEXT
    assert "READ-ONLY" in TEXT
    assert "Do not modify any calendar events" in TEXT


def test_calendar_read_uses_env_channel_reference():
    assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
    assert "150703" not in TEXT
