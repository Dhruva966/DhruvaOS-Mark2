from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestContentCalendarContract:
    def test_required_name(self):
        assert "name: content-calendar" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_gate(self):
        assert "requires_approval: false" in TEXT

    def test_tasks_channel_env_var(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_alerts_channel_env_var(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_linkedin_target_documented(self):
        assert "LinkedIn" in TEXT or "linkedin" in TEXT.lower()

    def test_x_target_documented(self):
        assert "Twitter" in TEXT or "X/" in TEXT or "x-thread" in TEXT.lower()

    def test_monday_schedule(self):
        assert "Monday" in TEXT or "50 8 * * 1" in TEXT

    def test_runs_before_idea_engine(self):
        assert "8:50" in TEXT or "50 8" in TEXT or "content-idea-engine" in TEXT

    def test_missed_target_alert(self):
        assert "alert" in TEXT.lower() or "#alerts" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
