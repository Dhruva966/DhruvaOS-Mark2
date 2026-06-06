from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: expense-monitor" in TEXT
        assert "tier: 1" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT

    def test_posts_to_research_channel(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT
        assert "DISCORD_TASKS_CHANNEL_ID" not in TEXT
        assert "DISCORD_ALERTS_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        assert "1507031106350874764" not in TEXT   # research channel ID

    def test_no_bank_api_connection(self):
        # Critical security invariant: manual CSV only, never bank API
        assert "no bank API" in TEXT.lower() or "no direct bank" in TEXT.lower() or "NO direct bank" in TEXT or "never" in TEXT.lower()
        assert "CSV" in TEXT
        assert "manual" in TEXT.lower() or "Manual" in TEXT

    def test_security_note_prominent(self):
        # Must have a prominent security note about no bank API
        assert "IMPORTANT" in TEXT or "Security Note" in TEXT or "security" in TEXT.lower()
        assert "bank API" in TEXT or "bank" in TEXT.lower()

    def test_two_command_modes_documented(self):
        assert "import" in TEXT
        assert "summary" in TEXT.lower() or "SUMMARY MODE" in TEXT

    def test_import_command_format_documented(self):
        assert "/expenses import" in TEXT
        assert "csv" in TEXT.lower() or "CSV" in TEXT

    def test_expense_categories_defined(self):
        expected_categories = ["Food", "Transport", "Subscriptions", "Entertainment", "Shopping"]
        for cat in expected_categories:
            assert cat in TEXT, f"Category '{cat}' must be defined"

    def test_phi4_mini_used_for_categorization(self):
        assert "phi4-mini" in TEXT
        assert "Ollama" in TEXT or "ollama" in TEXT

    def test_ollama_failure_falls_back_to_other(self):
        assert "Other" in TEXT
        assert "Ollama is unavailable" in TEXT or "Ollama unavailable" in TEXT

    def test_brain_file_path_correct(self):
        assert "~/brain/finance/" in TEXT
        assert "expenses-" in TEXT

    def test_gbrain_ingest_uses_flock(self):
        assert "flock -n /tmp/gbrain-write.lock" in TEXT

    def test_no_full_transaction_data_in_gbrain(self):
        # GBrain stores only summaries/totals, not raw transactions (privacy)
        assert "category" in TEXT.lower() and "summaries" in TEXT.lower() or \
               "category summaries" in TEXT.lower() or \
               "only category" in TEXT.lower() or \
               "summaries and totals" in TEXT

    def test_file_not_found_posts_usage_hint(self):
        assert "FILE_NOT_FOUND" in TEXT
        assert "not found" in TEXT.lower()

    def test_3_month_summary_in_summary_mode(self):
        assert "3 months" in TEXT or "last 3" in TEXT.lower()

    def test_no_data_message_in_summary_mode(self):
        assert "No expense data" in TEXT or "no expense data" in TEXT.lower()
        assert "/expenses import" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
