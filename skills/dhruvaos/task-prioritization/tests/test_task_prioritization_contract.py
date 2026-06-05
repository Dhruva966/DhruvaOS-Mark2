from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


def test_task_prioritization_is_only_tasks_writer():
    assert "ONLY skill authorized to write tasks.md" in TEXT
    assert "~/brain/projects/tasks.md" in TEXT
    assert "Do NOT modify any Notion pages" in TEXT


def test_task_prioritization_uses_env_channel_reference():
    assert "DISCORD_TASKS_CHANNEL_ID" in TEXT
    assert "150703" not in TEXT
