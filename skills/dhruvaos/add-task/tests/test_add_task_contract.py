from pathlib import Path


SKILL = Path(__file__).resolve().parents[1] / "SKILL.md"
TEXT = SKILL.read_text()


def test_add_task_uses_safe_notion_json_encoding():
    assert "json.dumps" in TEXT
    assert "TASK_PAYLOAD_B64" in TEXT
    assert "base64.b64decode" in TEXT
    assert "Do **not** substitute raw task text" in TEXT
    assert "urllib.request.Request" in TEXT
    assert "NOTION_TASKS_DB_ID" in TEXT
    assert "NOTION_API_KEY" in TEXT
    # Status is select type in actual DB schema (not status type)
    assert '"Status": {"select"' in TEXT


def test_add_task_preserves_existing_gbrain_inbox():
    assert "Do NOT overwrite" in TEXT
    assert "Always read first" in TEXT
    assert "tasks-inbox.md" in TEXT
    assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT


def test_add_task_is_internal_only():
    assert "outbound: false" in TEXT
    assert "No outbound approval is needed" in TEXT
    assert "frontmatter/runtime approval policy" in TEXT
    assert "#tasks" in TEXT
