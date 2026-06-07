from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestWeeklyLearningSynthesisContract:
    # ── Frontmatter ──────────────────────────────────────────────────────────

    def test_required_name_field(self):
        assert "name: weekly-learning-synthesis" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_tier_2_sonnet(self):
        assert "tier: 2" in TEXT

    def test_cron_schedule_sunday_9pm(self):
        assert 'schedule: "0 21 * * 0"' in TEXT

    def test_briefings_channel_env_var(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT

    def test_anthropic_api_key_env_var(self):
        assert "ANTHROPIC_API_KEY" in TEXT

    def test_gbrain_writes_weekly(self):
        assert "weekly/" in TEXT

    def test_gbrain_reads_all_resource_types(self):
        assert "resources/papers/" in TEXT
        assert "resources/video/" in TEXT
        assert "resources/media/" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    # ── Week boundary computation ─────────────────────────────────────────────

    def test_7_day_window(self):
        assert "7" in TEXT
        assert "timedelta(days=7)" in TEXT or "7 full days" in TEXT or "7 days" in TEXT

    def test_week_start_and_end_variables(self):
        assert "week_start" in TEXT
        assert "week_end" in TEXT

    def test_timezone_aware(self):
        assert "America/Los_Angeles" in TEXT or "pytz" in TEXT

    # ── GBrain queries ────────────────────────────────────────────────────────

    def test_queries_for_papers(self):
        assert "papers_result" in TEXT or ("paper" in TEXT and "gbrain_search" in TEXT)

    def test_queries_for_videos_podcasts(self):
        assert "video" in TEXT.lower() and "podcast" in TEXT.lower()
        assert "media_result" in TEXT or "gbrain_search" in TEXT

    def test_queries_for_research_notes(self):
        assert "research" in TEXT.lower()

    def test_at_least_4_gbrain_searches(self):
        # 4 main searches + 2 theme/questions searches = 6 total
        count = TEXT.count("gbrain_search(")
        assert count >= 4, f"Expected at least 4 gbrain_search calls, found {count}"

    def test_deduplication_of_results(self):
        assert "deduplicate" in TEXT.lower() or "Deduplicate" in TEXT

    # ── Empty week handling ───────────────────────────────────────────────────

    def test_handles_empty_week_gracefully(self):
        assert "Nothing was added to brain this week" in TEXT or "nothing" in TEXT.lower()

    def test_empty_week_posts_to_briefings_channel(self):
        # Even the empty-week message uses DISCORD_BRIEFINGS_CHANNEL_ID
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT

    # ── Synthesis structure ───────────────────────────────────────────────────

    def test_key_learnings_3_to_5_bullets(self):
        assert "key_learnings" in TEXT
        assert "3" in TEXT and "5" in TEXT

    def test_top_connection_field(self):
        assert "top_connection" in TEXT

    def test_open_question_field(self):
        assert "open_question" in TEXT

    def test_brain_stats_field(self):
        assert "brain_stats" in TEXT
        assert "papers" in TEXT
        assert "total_new_notes" in TEXT

    def test_synthesis_uses_tier2_rationale(self):
        assert "Tier 2" in TEXT
        assert "Sonnet" in TEXT

    # ── Brain file ────────────────────────────────────────────────────────────

    def test_brain_weekly_path(self):
        assert "brain/weekly" in TEXT

    def test_weekly_filename_format(self):
        assert "week-{today_str}" in TEXT or "week-YYYY-MM-DD" in TEXT

    def test_path_traversal_guard(self):
        assert "Unsafe" in TEXT or "unsafe" in TEXT

    def test_brain_file_includes_week_range(self):
        assert "week_start" in TEXT and "week_end" in TEXT

    # ── GBrain ingest of synthesis ────────────────────────────────────────────

    def test_synthesis_itself_ingested_into_gbrain(self):
        # The weekly synthesis file must be ingested so future queries can find it
        assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT

    def test_embed_stale_called(self):
        assert "embed --stale" in TEXT

    # ── Discord post format ───────────────────────────────────────────────────

    def test_posts_to_briefings_channel(self):
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" in TEXT
        assert "#briefings" in TEXT

    def test_discord_learning_emoji(self):
        assert "📚" in TEXT

    def test_discord_message_under_1800_chars(self):
        assert "1800" in TEXT

    def test_discord_includes_brain_growth_stats(self):
        assert "Brain growth" in TEXT or "brain growth" in TEXT.lower()
        assert "notes" in TEXT

    def test_connection_arrow_format(self):
        assert "↔" in TEXT

    # ── Error handling ────────────────────────────────────────────────────────

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT

    def test_synthesis_api_failure_fallback(self):
        # Must have a fallback if Sonnet call fails
        assert "Synthesis API call fails" in TEXT or "synthesis fails" in TEXT.lower()

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
