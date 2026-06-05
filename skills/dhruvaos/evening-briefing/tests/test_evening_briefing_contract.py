from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_evening_briefing_posts_separate_messages():
    assert "3 separate messages" in TEXT
    assert "Do NOT combine" in TEXT
    assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
    assert "150703" not in TEXT


def test_evening_briefing_has_missing_morning_guard():
    assert "No morning briefing found" in TEXT
    assert "Then stop" in TEXT
