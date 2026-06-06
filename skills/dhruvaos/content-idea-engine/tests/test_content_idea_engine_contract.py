from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestContentIdeaEngineContract:
    def test_required_name(self):
        assert "name: content-idea-engine" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_gate(self):
        assert "requires_approval: false" in TEXT

    def test_tasks_channel_env_var(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_platforms_present(self):
        assert "linkedin" in TEXT.lower() or "LinkedIn" in TEXT

    def test_blog_platform_present(self):
        assert "Blog" in TEXT or "blog" in TEXT

    def test_x_platform_present(self):
        assert "Twitter" in TEXT or "X-thread" in TEXT or "x-thread" in TEXT.lower()

    def test_no_auto_post(self):
        assert "does not" in TEXT.lower() or "does NOT" in TEXT or "no auto" in TEXT.lower()

    def test_gbrain_context_step(self):
        assert "gbrain" in TEXT.lower()

    def test_idea_count_documented(self):
        assert "3" in TEXT and "5" in TEXT

    def test_monday_schedule(self):
        assert "Monday" in TEXT or "0 9 * * 1" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
