from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: post-interaction-log" in TEXT
        assert "tier: 0" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT
        assert "NOTION_API_KEY" in TEXT
        assert "NOTION_PEOPLE_DB_ID" in TEXT

    def test_posts_to_tasks_channel(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT
        # Must not post to other channels
        assert "DISCORD_ALERTS_CHANNEL_ID" not in TEXT
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        assert "1507031086226735236" not in TEXT   # tasks channel ID

    def test_interaction_log_file_path_correct(self):
        assert "~/brain/people/" in TEXT
        assert "interactions/" in TEXT
        assert "YYYY-MM-DD.md" in TEXT or "today_str" in TEXT

    def test_log_file_markdown_frontmatter(self):
        assert "date:" in TEXT
        assert "person:" in TEXT

    def test_no_overwrite_if_file_exists(self):
        assert "EXISTS" in TEXT
        assert "append" in TEXT.lower()

    def test_gbrain_last_contact_fact_updated(self):
        assert "extract_facts" in TEXT
        assert "Last interacted with" in TEXT

    def test_phi4_mini_used_for_fact_extraction(self):
        assert "phi4-mini" in TEXT
        assert "Ollama" in TEXT or "ollama" in TEXT

    def test_notion_last_contact_updated(self):
        assert "Last Contact" in TEXT
        assert "NOTION_PEOPLE_DB_ID" in TEXT
        assert "PATCH" in TEXT or "update" in TEXT.lower()

    def test_notion_not_found_is_not_fatal(self):
        assert "NOTION_NOT_FOUND" in TEXT or "not found in Notion" in TEXT.lower() or "Not found in Notion" in TEXT

    def test_gbrain_ingest_uses_flock(self):
        assert "flock -n /tmp/gbrain-write.lock" in TEXT

    def test_ollama_failure_is_not_fatal(self):
        assert "Ollama is unavailable" in TEXT or "Ollama unavailable" in TEXT
        assert "connection refused" in TEXT.lower() or "unavailable" in TEXT.lower()

    def test_usage_hint_on_empty_person_name(self):
        assert "Usage:" in TEXT or "/met" in TEXT
        assert "person name" in TEXT.lower() or "person-name" in TEXT

    def test_confirms_new_facts_count(self):
        assert "new fact" in TEXT.lower()
        assert "✅" in TEXT

    def test_error_handling_documented(self):
        assert "Error Handling" in TEXT

    def test_done_condition_documented(self):
        assert "Done Condition" in TEXT
