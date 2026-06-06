from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestYouTubeIngestContract:
    # ── Frontmatter ──────────────────────────────────────────────────────────

    def test_required_name_field(self):
        assert "name: youtube-ingest" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_correct_tier(self):
        assert "tier: 1" in TEXT

    def test_no_schedule(self):
        assert "schedule: null" in TEXT

    def test_env_vars_declared(self):
        assert "EXA_API_KEY" in TEXT
        assert "ANTHROPIC_API_KEY" in TEXT
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT

    def test_gbrain_writes_declared(self):
        assert "resources/video/" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    # ── URL validation ────────────────────────────────────────────────────────

    def test_accepts_youtube_com_urls(self):
        assert "youtube.com/watch" in TEXT

    def test_accepts_youtu_be_short_urls(self):
        assert "youtu.be" in TEXT

    def test_accepts_shorts_urls(self):
        assert "youtube.com/shorts" in TEXT

    def test_rejects_invalid_url(self):
        # Must post a usage error for non-YouTube URLs
        assert "Not a valid YouTube URL" in TEXT or "not a valid YouTube" in TEXT.lower()

    def test_video_id_extraction(self):
        assert "video_id" in TEXT
        assert "[A-Za-z0-9_-]{11}" in TEXT

    # ── Deduplication ─────────────────────────────────────────────────────────

    def test_deduplication_check_before_ingest(self):
        dedup_idx = TEXT.index("Deduplication")
        fetch_idx = TEXT.index("Fetch Transcript")
        assert dedup_idx < fetch_idx, "Dedup check must happen before transcript fetch"

    def test_dedup_searches_by_video_id(self):
        assert "gbrain_search" in TEXT
        assert "video_id" in TEXT

    def test_dedup_already_in_brain_message(self):
        assert "Already in brain" in TEXT

    def test_dedup_failure_does_not_block(self):
        assert "search fails" in TEXT.lower() or "search failure" in TEXT.lower()

    # ── Transcript fetching ───────────────────────────────────────────────────

    def test_uses_youtube_transcript_api(self):
        assert "youtube_transcript_api" in TEXT
        assert "YouTubeTranscriptApi" in TEXT

    def test_transcript_handles_disabled_transcripts(self):
        assert "TranscriptsDisabled" in TEXT

    def test_transcript_handles_no_transcript(self):
        assert "NoTranscriptFound" in TEXT

    def test_exa_fallback_for_no_transcript(self):
        assert "exa_contents" in TEXT or "Exa fallback" in TEXT

    def test_transcript_length_cap(self):
        # Must cap to avoid token overflow
        assert "12,000" in TEXT or "12000" in TEXT

    def test_transcript_truncation_strategy(self):
        # Must keep beginning and end (intro + conclusion)
        assert "first" in TEXT.lower() or "[:8000]" in TEXT
        assert "last" in TEXT.lower() or "[-4000:]" in TEXT

    # ── Metadata fetching ─────────────────────────────────────────────────────

    def test_uses_yt_dlp_for_metadata(self):
        assert "yt-dlp" in TEXT

    def test_extracts_title_channel_duration(self):
        assert "title" in TEXT
        assert "channel" in TEXT
        assert "duration" in TEXT

    def test_upload_date_formatting(self):
        assert "upload_date" in TEXT

    def test_yt_dlp_fallback(self):
        assert "not installed" in TEXT.lower() or "fallback" in TEXT.lower()

    # ── Sonnet synthesis ─────────────────────────────────────────────────────

    def test_five_key_points(self):
        assert "5" in TEXT or "five" in TEXT.lower()
        assert "key_points" in TEXT

    def test_three_notable_quotes(self):
        assert "notable_quotes" in TEXT

    def test_main_takeaway_field(self):
        assert "main_takeaway" in TEXT

    def test_relevance_field(self):
        assert "relevance" in TEXT

    # ── Brain path safety ─────────────────────────────────────────────────────

    def test_brain_video_path(self):
        assert "brain/resources/video" in TEXT

    def test_slug_normalization(self):
        assert 're.sub(r"[^a-z0-9]+"' in TEXT

    def test_path_traversal_guard(self):
        assert "Unsafe" in TEXT or "unsafe" in TEXT

    # ── GBrain ingest ─────────────────────────────────────────────────────────

    def test_gbrain_ingest_uses_lock(self):
        assert "flock -n /tmp/gbrain-write.lock" in TEXT

    def test_gbrain_embed_stale(self):
        assert "embed --stale" in TEXT

    # ── Discord post ──────────────────────────────────────────────────────────

    def test_posts_to_research_channel(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT
        assert "#research" in TEXT

    def test_discord_video_emoji(self):
        assert "📹" in TEXT

    def test_discord_message_under_1800_chars(self):
        assert "1800" in TEXT

    # ── connection-detector integration ──────────────────────────────────────

    def test_connection_detector_triggered_after_ingest(self):
        # connection-detector fires as the last step (after brain write and Discord post)
        # Find the last mention of connection-detector in the skill body steps
        last_conn_idx = TEXT.rfind("connection-detector")
        discord_idx = TEXT.index("Post to #research")
        assert last_conn_idx > discord_idx

    def test_connection_detector_is_best_effort(self):
        assert "best-effort" in TEXT or "best effort" in TEXT.lower()

    # ── Error handling ────────────────────────────────────────────────────────

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
