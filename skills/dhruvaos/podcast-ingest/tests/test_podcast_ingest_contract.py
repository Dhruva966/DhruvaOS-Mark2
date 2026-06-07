from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestPodcastIngestContract:
    # ── Frontmatter ──────────────────────────────────────────────────────────

    def test_required_name_field(self):
        assert "name: podcast-ingest" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_tier_2_for_sonnet_audio(self):
        # Audio transcripts need Tier 2 Sonnet (more nuanced than video captions)
        assert "tier: 2" in TEXT

    def test_no_schedule(self):
        assert "schedule: null" in TEXT

    def test_env_vars_declared(self):
        assert "ANTHROPIC_API_KEY" in TEXT
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT

    def test_gbrain_writes_declared(self):
        assert "resources/media/" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    # ── YouTube URL rejection ─────────────────────────────────────────────────

    def test_rejects_youtube_urls(self):
        assert "youtube-ingest" in TEXT
        assert "youtube.com" in TEXT.lower() or "YouTube" in TEXT

    def test_youtube_redirect_message_posted_to_discord(self):
        assert "youtube-ingest skill" in TEXT or "youtube-ingest" in TEXT

    # ── URL vs file routing ───────────────────────────────────────────────────

    def test_accepts_http_urls(self):
        assert "http://" in TEXT or "https://" in TEXT

    def test_accepts_local_file_paths(self):
        assert "Path(source).expanduser().exists()" in TEXT or "local file" in TEXT.lower()

    def test_invalid_input_error_message(self):
        assert "Not a valid URL or file path" in TEXT or "not a valid" in TEXT.lower()

    # ── Deduplication ─────────────────────────────────────────────────────────

    def test_deduplication_before_download(self):
        dedup_idx = TEXT.index("Deduplication")
        download_idx = TEXT.index("Download Audio")
        assert dedup_idx < download_idx

    def test_dedup_already_in_brain_message(self):
        assert "Already in brain" in TEXT

    def test_dedup_failure_does_not_block(self):
        assert "search fails" in TEXT.lower()

    # ── Download ──────────────────────────────────────────────────────────────

    def test_url_hash_for_tmp_filename(self):
        assert "hashlib" in TEXT
        assert "/tmp/podcast-" in TEXT

    def test_500mb_size_cap(self):
        assert "500" in TEXT
        assert "MB" in TEXT

    def test_html_content_type_rejected(self):
        assert "text/html" in TEXT

    def test_cleanup_after_download(self):
        assert "unlink" in TEXT
        assert "cleanup" in TEXT.lower() or "Clean Up" in TEXT

    def test_cleanup_on_failure_too(self):
        assert "attempt cleanup" in TEXT.lower() or "attempt cleanup" in TEXT

    # ── Whisper transcription ─────────────────────────────────────────────────

    def test_uses_local_whisper_stt(self):
        assert "whisper_transcribe" in TEXT
        assert "stt.provider: local" in TEXT

    def test_transcript_length_cap(self):
        assert "12,000" in TEXT or "12000" in TEXT

    def test_transcript_truncation_strategy(self):
        assert "[:8000]" in TEXT or "first 8,000" in TEXT or "first" in TEXT.lower()
        assert "[-4000:]" in TEXT or "last 4,000" in TEXT or "last" in TEXT.lower()

    def test_duration_formatted(self):
        assert "duration_str" in TEXT
        assert "duration_s" in TEXT

    # ── Synthesis uses Sonnet (Tier 2) ───────────────────────────────────────

    def test_synthesis_uses_tier2_rationale(self):
        # Skill must explain WHY Tier 2 is used for audio vs Tier 1 for video
        assert "Tier 2" in TEXT
        assert "nuanced" in TEXT.lower() or "speech" in TEXT.lower() or "informal" in TEXT.lower()

    def test_five_key_points_in_synthesis(self):
        assert "key_points" in TEXT

    def test_three_notable_quotes(self):
        assert "notable_quotes" in TEXT

    def test_main_takeaway_in_synthesis(self):
        assert "main_takeaway" in TEXT

    def test_relevance_field_in_synthesis(self):
        assert "relevance" in TEXT

    # ── Brain path ────────────────────────────────────────────────────────────

    def test_brain_media_path(self):
        assert "brain/resources/media" in TEXT

    def test_slug_normalization(self):
        assert 're.sub(r"[^a-z0-9]+"' in TEXT

    def test_path_traversal_guard(self):
        assert "Unsafe" in TEXT or "unsafe" in TEXT

    # ── Brain file includes source metadata ───────────────────────────────────

    def test_source_url_in_brain_file(self):
        assert "Source:" in TEXT and "source" in TEXT

    def test_duration_in_brain_file(self):
        assert "Duration:" in TEXT or "duration_str" in TEXT

    def test_ingested_date_in_brain_file(self):
        assert "Ingested:" in TEXT

    # ── GBrain ingest ─────────────────────────────────────────────────────────

    def test_gbrain_ingest_uses_lock(self):
        assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT

    def test_gbrain_embed_stale(self):
        assert "embed --stale" in TEXT

    # ── Discord post ──────────────────────────────────────────────────────────

    def test_posts_to_research_channel(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT
        assert "#research" in TEXT

    def test_podcast_emoji_in_message(self):
        assert "🎙️" in TEXT

    def test_discord_message_under_1800_chars(self):
        assert "1800" in TEXT

    # ── connection-detector integration ──────────────────────────────────────

    def test_connection_detector_triggered(self):
        assert "connection-detector" in TEXT

    def test_connection_detector_is_best_effort(self):
        assert "best-effort" in TEXT or "best effort" in TEXT.lower()

    # ── Error handling ────────────────────────────────────────────────────────

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT

    def test_cleanup_mentioned_in_error_table(self):
        assert "cleanup" in TEXT.lower()
