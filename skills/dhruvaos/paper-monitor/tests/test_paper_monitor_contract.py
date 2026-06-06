from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestPaperMonitorContract:
    # ── Frontmatter ──────────────────────────────────────────────────────────

    def test_required_name_field(self):
        assert "name: paper-monitor" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_correct_tier(self):
        # Tier 1 (GPT-4o-mini for summaries) — phi4-mini is Tier 0 but Sonnet path elevates
        assert "tier: 1" in TEXT

    def test_cron_schedule_daily_7am(self):
        assert 'schedule: "0 7 * * *"' in TEXT

    def test_env_vars_declared(self):
        assert "EXA_API_KEY" in TEXT
        assert "ANTHROPIC_API_KEY" in TEXT
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT

    def test_gbrain_writes_declared(self):
        assert "resources/papers/" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    # ── Feed sources ─────────────────────────────────────────────────────────

    def test_arxiv_feeds_all_four_cs_categories(self):
        assert "cs.AI" in TEXT
        assert "cs.LG" in TEXT
        assert "cs.CL" in TEXT
        assert "cs.NE" in TEXT

    def test_arxiv_rss_base_url(self):
        assert "https://rss.arxiv.org/rss/" in TEXT

    def test_hn_rss_feed_present(self):
        assert "news.ycombinator.com/rss" in TEXT

    def test_24h_window_filter(self):
        assert "24" in TEXT
        assert "cutoff" in TEXT.lower()

    # ── Phi4-mini relevance filter ────────────────────────────────────────────

    def test_tier0_phi4_mini_scoring(self):
        assert "phi4-mini" in TEXT
        assert "score" in TEXT.lower()

    def test_relevance_threshold_is_7(self):
        assert ">= 7" in TEXT

    def test_phi4_mini_batch_scoring(self):
        assert "BATCH_SIZE" in TEXT or "batch" in TEXT.lower()

    def test_phi4_mini_fallback_on_offline(self):
        assert "offline" in TEXT.lower() or "fallback" in TEXT.lower()

    def test_interest_areas_documented(self):
        assert "LLM" in TEXT
        assert "UCLA ECE" in TEXT
        assert "edge" in TEXT.lower()

    # ── Sonnet summarization ─────────────────────────────────────────────────

    def test_three_bullet_key_insights(self):
        assert "key_insights" in TEXT
        assert "insight 1" in TEXT

    def test_one_liner_per_paper(self):
        assert "one_liner" in TEXT

    def test_relevance_field_in_summary(self):
        assert "relevance" in TEXT

    # ── Brain path safety ─────────────────────────────────────────────────────

    def test_brain_papers_path(self):
        assert "~/brain/resources/papers" in TEXT or "brain/resources/papers" in TEXT

    def test_slug_normalization(self):
        assert 're.sub(r"[^a-z0-9]+"' in TEXT

    def test_path_traversal_guard(self):
        assert "Unsafe" in TEXT or "unsafe" in TEXT

    # ── GBrain ingest ─────────────────────────────────────────────────────────

    def test_gbrain_ingest_uses_lock(self):
        assert "flock -n /tmp/gbrain-write.lock" in TEXT

    def test_gbrain_embed_stale_called(self):
        assert "embed --stale" in TEXT

    # ── Discord output ────────────────────────────────────────────────────────

    def test_posts_to_research_channel(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT
        assert "#research" in TEXT

    def test_discord_message_format(self):
        assert "📄 Papers worth reading" in TEXT

    def test_message_length_cap(self):
        assert "1800" in TEXT

    def test_silent_when_zero_keepers(self):
        # Must stay silent and not post if no papers pass the filter
        assert "0" in TEXT
        assert "silent" in TEXT.lower() or "stop" in TEXT.lower()
        assert "No Discord post" in TEXT or "no Discord post" in TEXT.lower()

    # ── Error handling ────────────────────────────────────────────────────────

    def test_single_feed_failure_does_not_abort(self):
        assert "continue" in TEXT.lower()
        assert "warning" in TEXT.lower() or "WARN" in TEXT

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
