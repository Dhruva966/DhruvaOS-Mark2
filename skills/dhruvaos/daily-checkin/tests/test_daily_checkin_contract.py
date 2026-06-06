from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestDailyCheckinContract:
    def test_required_name(self):
        assert "name: daily-checkin" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_gate(self):
        assert "requires_approval: false" in TEXT

    def test_briefings_channel_env_var(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT

    def test_alerts_channel_env_var(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_clarify_tool_for_questions(self):
        assert "clarify" in TEXT

    def test_sleep_question_documented(self):
        assert "sleep" in TEXT.lower()

    def test_exercise_question_documented(self):
        assert "exercise" in TEXT.lower()

    def test_energy_question_documented(self):
        assert "energy" in TEXT.lower()

    def test_streak_tracking(self):
        assert "streak" in TEXT.lower()

    def test_brain_write_path(self):
        assert "health/checkins" in TEXT or "brain/health" in TEXT

    def test_nightly_prompt_cron(self):
        assert "22" in TEXT or "10pm" in TEXT or "0 22 * * *" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
