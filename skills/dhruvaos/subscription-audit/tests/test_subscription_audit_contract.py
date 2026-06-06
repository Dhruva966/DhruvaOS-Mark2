from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: subscription-audit" in TEXT
        assert "tier: 1" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_posts_to_tasks_channel(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT
        assert "DISCORD_ALERTS_CHANNEL_ID" not in TEXT
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        assert "1507031086226735236" not in TEXT   # tasks channel ID

    def test_gbrain_multi_query(self):
        # Must make multiple searches to cover different memory paths
        text_lower = TEXT.lower()
        assert "subscriptions" in text_lower
        assert "gbrain search" in text_lower or "gbrain_search" in text_lower or "GBrain search" in TEXT

    def test_brain_file_also_checked(self):
        assert "~/brain/" in TEXT
        assert "subscriptions.md" in TEXT or "subscriptions" in TEXT

    def test_tier_1_model_used(self):
        assert "GPT-4o-mini" in TEXT or "gpt-4o-mini" in TEXT.lower()

    def test_review_flag_for_low_usage(self):
        assert "rare" in TEXT or "rarely" in TEXT
        assert "review" in TEXT.lower()
        assert "cancel" in TEXT.lower()

    def test_monthly_total_calculated(self):
        assert "monthly" in TEXT.lower() or "Monthly" in TEXT
        assert "total" in TEXT.lower() or "Total" in TEXT
        assert "$" in TEXT

    def test_unknown_cost_handled(self):
        assert "unknown" in TEXT.lower()
        assert "cost" in TEXT.lower()

    def test_no_data_handled_gracefully(self):
        assert "no subscription data" in TEXT.lower() or "No subscription data" in TEXT
        assert "subscriptions.md" in TEXT   # tells user where to add data

    def test_categories_defined(self):
        # Audit output has category breakdown
        assert "category" in TEXT.lower() or "Category" in TEXT

    def test_message_length_bounded(self):
        assert "1800" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
