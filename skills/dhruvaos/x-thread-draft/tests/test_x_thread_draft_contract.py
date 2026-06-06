from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestXThreadDraftContract:
    def test_required_name(self):
        assert "name: x-thread-draft" in TEXT

    def test_outbound_requires_approval(self):
        assert "outbound: true" in TEXT
        assert "requires_approval: true" in TEXT

    def test_tier_2_for_outbound(self):
        assert "tier: 2" in TEXT

    def test_hard_stop_present(self):
        assert "HARD STOP" in TEXT or "hard stop" in TEXT.lower()

    def test_corrections_channel_env_var(self):
        assert "DISCORD_CORRECTIONS_CHANNEL_ID" in TEXT

    def test_allowed_user_env_var(self):
        assert "DISCORD_ALLOWED_USER" in TEXT

    def test_xposteros_integration(self):
        assert "XPosterOS" in TEXT or "xposteros" in TEXT.lower()

    def test_xposteros_api_url_env_var(self):
        assert "XPOSTEROS_API_URL" in TEXT

    def test_tweet_count_documented(self):
        assert "5" in TEXT and ("tweet" in TEXT.lower() or "thread" in TEXT.lower())

    def test_approval_preview_format(self):
        assert "APPROVAL REQUIRED" in TEXT or "approval" in TEXT.lower()

    def test_clarify_for_gate(self):
        assert "clarify" in TEXT

    def test_deny_path_documented(self):
        assert "deny" in TEXT.lower() or "discard" in TEXT.lower()

    def test_no_hashtag_spam_policy(self):
        assert "hashtag" in TEXT.lower() or "#" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT
