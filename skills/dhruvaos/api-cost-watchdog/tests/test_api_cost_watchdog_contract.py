from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: api-cost-watchdog" in TEXT
        assert "tier: 0" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_posts_only_to_alerts_channel(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT
        assert "DISCORD_TASKS_CHANNEL_ID" not in TEXT
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" not in TEXT
        assert "DISCORD_RESEARCH_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        assert "1507031132724531392" not in TEXT   # alerts channel ID

    def test_silent_when_within_normal_bounds(self):
        assert "do NOT post" in TEXT.lower() or "Do NOT post" in TEXT or "silent" in TEXT.lower()
        assert "2.00" in TEXT or "$2" in TEXT

    def test_daily_cost_threshold_documented(self):
        assert "$2.00" in TEXT or "2.00" in TEXT
        assert "Tier 2" in TEXT

    def test_monthly_projection_threshold_documented(self):
        assert "$30" in TEXT or "30.00" in TEXT or "30/" in TEXT
        assert "monthly" in TEXT.lower() or "Monthly" in TEXT

    def test_all_model_tiers_covered(self):
        assert "claude-sonnet" in TEXT
        assert "claude-opus" in TEXT
        assert "gpt-4o-mini" in TEXT
        assert "phi4-mini" in TEXT

    def test_cost_estimates_documented(self):
        assert "$0.003" in TEXT
        assert "$0.015" in TEXT
        assert "$0.0001" in TEXT

    def test_reads_gateway_log(self):
        assert "gateway.log" in TEXT
        assert "~/.hermes/logs" in TEXT

    def test_24_hour_window(self):
        assert "24" in TEXT
        assert "hours" in TEXT

    def test_log_missing_handled_gracefully(self):
        assert "LOG_MISSING" in TEXT or "not found" in TEXT.lower()

    def test_gbrain_checked_for_budget(self):
        assert "gbrain" in TEXT.lower()
        assert "budget" in TEXT.lower()

    def test_monthly_projection_in_alert(self):
        assert "projection" in TEXT.lower() or "Projection" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
