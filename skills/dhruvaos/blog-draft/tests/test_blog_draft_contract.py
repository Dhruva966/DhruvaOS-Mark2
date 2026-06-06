from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestBlogDraftContract:
    def test_required_name(self):
        assert "name: blog-draft" in TEXT

    def test_outbound_requires_approval(self):
        assert "outbound: true" in TEXT
        assert "requires_approval: true" in TEXT

    def test_tier_2_for_outbound(self):
        assert "tier: 2" in TEXT

    def test_quality_firewall_documented(self):
        assert "APPROVAL REQUIRED" in TEXT or "approval" in TEXT.lower()

    def test_hard_stop_present(self):
        assert "HARD STOP" in TEXT or "hard stop" in TEXT.lower()

    def test_corrections_channel_env_var(self):
        assert "DISCORD_CORRECTIONS_CHANNEL_ID" in TEXT

    def test_allowed_user_env_var(self):
        assert "DISCORD_ALLOWED_USER" in TEXT

    def test_word_count_range_documented(self):
        assert "600" in TEXT or "900" in TEXT

    def test_clarify_tool_for_approval(self):
        assert "clarify" in TEXT

    def test_timeout_documented(self):
        assert "timeout" in TEXT.lower() or "10 min" in TEXT.lower()

    def test_deny_path_documented(self):
        assert "deny" in TEXT.lower() or "discard" in TEXT.lower()

    def test_personal_site_update_integration(self):
        assert "personal-site-update" in TEXT

    def test_gbrain_context_loaded(self):
        assert "gbrain" in TEXT.lower()

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
