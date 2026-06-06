from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: birthday-reminder" in TEXT
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

    def test_silent_when_no_upcoming_birthdays(self):
        assert "Silent exit" in TEXT or "silent exit" in TEXT
        assert "Do NOT post" in TEXT

    def test_7_day_window_documented(self):
        assert "7 days" in TEXT or "7-day" in TEXT or "7-Day" in TEXT

    def test_brain_frontmatter_format_documented(self):
        assert "birthday: YYYY-MM-DD" in TEXT
        # Partial date support
        assert "--MM-DD" in TEXT or "partial" in TEXT.lower()

    def test_birthday_today_posts_today_message(self):
        assert "today" in TEXT.lower() or "TODAY" in TEXT
        assert "🎂" in TEXT

    def test_upcoming_birthday_includes_days_away(self):
        assert "days" in TEXT
        assert "days away" in TEXT or "days_away" in TEXT or "N> days" in TEXT or "<N> days" in TEXT

    def test_friend_tier_gets_suggested_message(self):
        assert "friend" in TEXT
        assert "Suggested message" in TEXT or "suggested message" in TEXT

    def test_age_omitted_when_birth_year_unknown(self):
        assert "year of birth is unknown" in TEXT or "birth_year" in TEXT

    def test_dual_source_gbrain_and_brain_files(self):
        assert "gbrain search" in TEXT.lower() or "GBrain search" in TEXT
        assert "brain/people/" in TEXT or "~/brain/people" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
