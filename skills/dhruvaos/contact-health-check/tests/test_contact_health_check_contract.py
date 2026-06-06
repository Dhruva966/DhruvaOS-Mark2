from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: contact-health-check" in TEXT
        assert "tier: 0" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        # outbound: false means no approval required — invariant holds
        assert "outbound: false" in TEXT
        # If this were outbound: true, requires_approval: true would be mandatory
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT
        assert "NOTION_API_KEY" in TEXT
        assert "NOTION_PEOPLE_DB_ID" in TEXT

    def test_posts_only_to_alerts_channel(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT
        # Must not reference other channels by name or env var
        assert "DISCORD_TASKS_CHANNEL_ID" not in TEXT
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" not in TEXT
        assert "DISCORD_RESEARCH_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        # Channel IDs must come from env vars, not hardcoded
        assert "1507031132724531392" not in TEXT   # alerts channel ID
        assert "1507031086226735236" not in TEXT   # tasks channel ID

    def test_silent_when_no_overdue_contacts(self):
        assert "OVERDUE_COUNT" in TEXT
        assert "stop here" in TEXT
        assert "Silent" in TEXT or "silent" in TEXT

    def test_tier_thresholds_documented(self):
        assert "30 days" in TEXT or "30-day" in TEXT or "> 30" in TEXT
        assert "60 days" in TEXT or "60-day" in TEXT or "> 60" in TEXT
        assert "90 days" in TEXT or "90-day" in TEXT or "> 90" in TEXT

    def test_dual_source_gbrain_and_notion(self):
        assert "gbrain search" in TEXT.lower() or "gbrain_search" in TEXT.lower() or "GBrain search" in TEXT
        assert "Notion" in TEXT
        assert "NOTION_PEOPLE_DB_ID" in TEXT

    def test_no_contact_missing_date_causes_error(self):
        # Contacts with no last_contact_date should be skipped, not crash
        assert "skip" in TEXT.lower()
        assert "no last_contact_date" in TEXT or "no date on file" in TEXT or "if not last_raw" in TEXT

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT
        assert "GBrain" in TEXT
        assert "Notion" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT

    def test_uses_flock_or_equivalent_for_gbrain(self):
        # GBrain writes use mutex to avoid races — reads-only skill uses search not import
        # This skill only reads, so no flock needed; verify no write operations claimed
        assert "writes: []" in TEXT
