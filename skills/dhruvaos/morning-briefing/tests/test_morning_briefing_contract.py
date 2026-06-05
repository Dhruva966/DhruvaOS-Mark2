from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_morning_briefing_posts_four_separate_messages():
    assert "4 separate messages" in TEXT
    assert "Do NOT combine" in TEXT
    assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
    assert "150703" not in TEXT


def test_morning_briefing_degrades_gracefully():
    assert "Never abort early due to a single data source failure" in TEXT
    assert "calendar unavailable" in TEXT
    assert "inbox unavailable" in TEXT
