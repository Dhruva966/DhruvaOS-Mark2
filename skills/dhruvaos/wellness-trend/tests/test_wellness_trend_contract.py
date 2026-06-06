from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestWellnessTrendContract:
    def test_required_name(self):
        assert "name: wellness-trend" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_gate(self):
        assert "requires_approval: false" in TEXT

    def test_briefings_channel_env_var(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT

    def test_reads_checkins(self):
        assert "checkin" in TEXT.lower()

    def test_sleep_metric(self):
        assert "sleep" in TEXT.lower()

    def test_exercise_metric(self):
        assert "exercise" in TEXT.lower()

    def test_energy_metric(self):
        assert "energy" in TEXT.lower()

    def test_weekly_comparison(self):
        assert "week" in TEXT.lower()

    def test_sunday_schedule(self):
        assert "Sunday" in TEXT or "0 20 * * 0" in TEXT

    def test_brain_write_path(self):
        assert "health" in TEXT.lower()

    def test_gbrain_ingest(self):
        assert "gbrain" in TEXT.lower()

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
