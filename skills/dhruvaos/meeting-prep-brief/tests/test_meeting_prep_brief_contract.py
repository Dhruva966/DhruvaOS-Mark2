from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: meeting-prep-brief" in TEXT
        assert "tier: 1" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
        assert "GOOGLE_CALENDAR_ID" in TEXT

    def test_posts_to_briefings_channel(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
        assert "DISCORD_TASKS_CHANNEL_ID" not in TEXT
        assert "DISCORD_ALERTS_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        assert "1507031063296217189" not in TEXT   # briefings channel ID

    def test_30_to_45_minute_window(self):
        assert "30" in TEXT and "45" in TEXT
        assert "minutes" in TEXT

    def test_silent_when_no_events_in_window(self):
        assert "silent exit" in TEXT.lower() or "Silent exit" in TEXT
        assert "TARGET_EVENT_COUNT" in TEXT or "TARGET_EVENT" in TEXT

    def test_silent_when_all_attendees_unknown(self):
        assert "no GBrain data" in TEXT
        assert "skip" in TEXT.lower()
        # Silence is better than noise with no data
        assert "Silence is better" in TEXT or "not useful" in TEXT

    def test_deduplication_within_2_hours(self):
        assert "2 hours" in TEXT or "2-hour" in TEXT
        assert "deduplic" in TEXT.lower() or "Deduplication" in TEXT

    def test_dedup_uses_gbrain(self):
        assert "gbrain call extract_facts" in TEXT or "gbrain search" in TEXT.lower() or "GBrain" in TEXT

    def test_skips_self_from_attendees(self):
        assert "self" in TEXT or "skip self" in TEXT.lower() or "Dhruva" in TEXT

    def test_brief_format_documented(self):
        assert "📋" in TEXT
        assert "👤" in TEXT
        assert "💬" in TEXT or "❓" in TEXT

    def test_all_day_events_skipped(self):
        assert "all-day" in TEXT or "all_day" in TEXT or "dateTime" in TEXT

    def test_google_calendar_helper_invoked(self):
        assert "google_api_helper.py" in TEXT
        assert "calendar" in TEXT

    def test_tier_1_model_used(self):
        assert "GPT-4o-mini" in TEXT or "gpt-4o-mini" in TEXT.lower()
        assert "Tier 1" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT
        assert "calendar unavailable" in TEXT.lower() or "Calendar API unavailable" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
