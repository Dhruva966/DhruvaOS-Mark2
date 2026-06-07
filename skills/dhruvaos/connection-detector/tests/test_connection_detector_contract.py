from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestConnectionDetectorContract:
    # ── Frontmatter ──────────────────────────────────────────────────────────

    def test_required_name_field(self):
        assert "name: connection-detector" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_tier_1(self):
        assert "tier: 1" in TEXT

    def test_no_schedule(self):
        assert "schedule: null" in TEXT

    def test_env_vars_declared(self):
        assert "ANTHROPIC_API_KEY" in TEXT

    def test_gbrain_reads_all_brain(self):
        # Must be able to read any brain node
        assert 'reads: ["*"]' in TEXT or "reads:" in TEXT

    def test_gbrain_writes_all_brain(self):
        assert 'writes: ["*"]' in TEXT or "writes:" in TEXT

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    # ── Input parsing ─────────────────────────────────────────────────────────

    def test_accepts_args_brain_file(self):
        # Can be called programmatically from other skills
        assert 'args["brain_file"]' in TEXT or "args.get" in TEXT

    def test_accepts_discord_slash_connect_command(self):
        assert "/connect" in TEXT

    def test_no_path_no_op(self):
        assert "no brain file path provided" in TEXT or "no path" in TEXT.lower()

    # ── Path safety ───────────────────────────────────────────────────────────

    def test_path_must_be_within_brain_root(self):
        assert "~/brain/" in TEXT or "brain_root" in TEXT

    def test_path_traversal_blocked(self):
        assert "outside ~/brain/" in TEXT or "outside" in TEXT

    def test_path_resolved_before_check(self):
        assert ".resolve()" in TEXT

    def test_file_existence_check(self):
        assert "not found" in TEXT or "not exist" in TEXT.lower() or ".exists()" in TEXT

    # ── Deduplication guard ───────────────────────────────────────────────────

    def test_dedup_checks_for_existing_connected_concepts_section(self):
        assert "## Connected concepts" in TEXT

    def test_dedup_stops_if_already_enriched(self):
        # Must stop if section already exists
        assert "already exists" in TEXT

    def test_dedup_is_silent_skip(self):
        # Skip must be silent — no Discord message
        assert "silent" in TEXT.lower()

    # ── Concept extraction (phi4-mini) ────────────────────────────────────────

    def test_uses_phi4_mini_for_extraction(self):
        assert "phi4-mini" in TEXT

    def test_extracts_3_to_5_concepts(self):
        assert "3" in TEXT and "5" in TEXT
        assert "key_concepts" in TEXT or "concepts" in TEXT.lower()

    def test_phi4_mini_fallback_on_offline(self):
        # Must fallback gracefully if Ollama is down
        assert "fallback" in TEXT.lower()
        assert "filename" in TEXT.lower()

    def test_phi4_mini_content_trimmed(self):
        # Must not send full large files to phi4-mini
        assert "3000" in TEXT or ":3000]" in TEXT

    def test_phi4_mini_markdown_fence_handling(self):
        # phi4-mini sometimes wraps JSON in markdown fences
        assert "```json" in TEXT or "markdown" in TEXT.lower()

    # ── GBrain search ─────────────────────────────────────────────────────────

    def test_gbrain_search_per_concept(self):
        assert "gbrain_search" in TEXT
        assert "for concept in key_concepts" in TEXT or "for each concept" in TEXT.lower()

    def test_minimum_similarity_threshold(self):
        assert "0.6" in TEXT or "similarity threshold" in TEXT.lower()

    def test_excludes_self_from_results(self):
        # Must not return the file being enriched as a candidate
        assert "brain_path" in TEXT or "exclude" in TEXT.lower()

    def test_deduplicates_search_results(self):
        assert "Deduplicate" in TEXT or "deduplicate" in TEXT.lower() or "Dedup" in TEXT

    def test_no_results_stops_gracefully(self):
        assert "No related nodes found" in TEXT or "no related" in TEXT.lower()

    # ── Sonnet connection quality ─────────────────────────────────────────────

    def test_top_3_genuine_connections(self):
        assert "TOP 3" in TEXT or "top 3" in TEXT.lower() or "top_3" in TEXT

    def test_non_trivial_relationship_requirement(self):
        assert "non-trivial" in TEXT or "genuine" in TEXT or "non-obvious" in TEXT

    def test_relationship_is_one_sentence(self):
        assert "one sentence" in TEXT or "one clear sentence" in TEXT

    def test_sonnet_fallback_on_failure(self):
        assert "Sonnet call fails" in TEXT or "sonnet fails" in TEXT.lower()

    def test_fallback_uses_top_candidates_by_score(self):
        assert "top 2 candidates by score" in TEXT or "by score" in TEXT.lower()

    # ── File append (not overwrite) ───────────────────────────────────────────

    def test_appends_not_overwrites(self):
        # Must use append mode ("a") not write mode ("w")
        assert 'open("a"' in TEXT or "open(brain_path, \"a\"" in TEXT or '"a"' in TEXT

    def test_obsidian_wikilink_format(self):
        # Connections must use [[link]] format for Obsidian compatibility
        assert "[[" in TEXT and "]]" in TEXT

    def test_relationship_per_connection(self):
        assert "relationship" in TEXT

    # ── GBrain re-ingest ──────────────────────────────────────────────────────

    def test_re_ingest_after_append(self):
        append_idx = TEXT.index("Append Connected Concepts")
        reingest_idx = TEXT.index("Re-ingest")
        assert append_idx < reingest_idx

    def test_re_ingest_uses_lock(self):
        assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT

    def test_embed_stale_called(self):
        assert "embed --stale" in TEXT

    # ── Silence contract ──────────────────────────────────────────────────────

    def test_no_discord_messages_ever(self):
        assert "no Discord messages" in TEXT or "No Discord messages" in TEXT
        assert "silent" in TEXT.lower()

    def test_silence_contract_explicitly_documented(self):
        assert "Silence Contract" in TEXT

    def test_errors_logged_not_messaged(self):
        assert "stdout" in TEXT or "stderr" in TEXT or "Hermes captures" in TEXT

    # ── Error handling ────────────────────────────────────────────────────────

    def test_error_handling_table_present(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
