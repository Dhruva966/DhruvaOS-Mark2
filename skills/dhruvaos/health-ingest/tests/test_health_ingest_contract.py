"""
Contract tests for health-ingest SKILL.md.

Run: uvx pytest skills/dhruvaos/health-ingest/tests/ -q
"""

from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: health-ingest" in TEXT
        assert "tier: 0" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT

    def test_no_hardcoded_credentials(self):
        assert "sk-" not in TEXT
        assert "ntn_" not in TEXT
        assert "Bearer " not in TEXT or "Bearer $" in TEXT  # only env-var references allowed

    def test_gbrain_writes_declared(self):
        assert 'writes: ["health/*"]' in TEXT or "writes:\n  - health/" in TEXT

    def test_env_vars_declared(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT

    def test_description_present(self):
        assert "description:" in TEXT


class TestParsingLogic:
    def test_uses_stdlib_xml_parser(self):
        # Must use stdlib only — no pip-installable XML libraries
        assert "xml.etree.ElementTree" in TEXT
        assert "lxml" not in TEXT
        assert "beautifulsoup" not in TEXT.lower()
        assert "bs4" not in TEXT

    def test_parses_all_five_required_types(self):
        assert "HKQuantityTypeIdentifierStepCount" in TEXT
        assert "HKCategoryTypeIdentifierSleepAnalysis" in TEXT
        assert "HKQuantityTypeIdentifierHeartRate" in TEXT
        assert "HKQuantityTypeIdentifierRestingHeartRate" in TEXT
        assert "HKQuantityTypeIdentifierActiveEnergyBurned" in TEXT

    def test_sleep_filters_asleep_records_only(self):
        # Must filter sleep to Asleep category only (not InBed, Awake)
        assert "Asleep" in TEXT

    def test_aggregates_weekly_not_daily(self):
        assert "week" in TEXT.lower()
        assert "iso_week_start" in TEXT or "weekly" in TEXT.lower()

    def test_computes_all_required_weekly_averages(self):
        assert "avg_sleep" in TEXT or "avg sleep" in TEXT.lower()
        assert "avg_steps" in TEXT or "steps/day" in TEXT.lower()
        assert "resting_hr" in TEXT or "resting HR" in TEXT.lower()
        assert "active_calories" in TEXT or "total active calories" in TEXT.lower()


class TestBrainFileOutput:
    def test_writes_one_file_per_week(self):
        assert "week-{week_start}.md" in TEXT or "week-YYYY-MM-DD.md" in TEXT or \
               'f"week-{week_start}.md"' in TEXT

    def test_writes_to_correct_brain_path(self):
        assert "~/brain/health" in TEXT

    def test_creates_directory_if_missing(self):
        assert "makedirs" in TEXT or "mkdir" in TEXT

    def test_overwrites_existing_week_files_safely(self):
        # Re-import should be safe — overwrites existing files
        assert "overwrite" in TEXT.lower() or "safe to run again" in TEXT.lower() or \
               '"w"' in TEXT or "mode='w'" in TEXT


class TestGBrainIngest:
    def test_ingests_each_file(self):
        assert "gbrain_ingest" in TEXT

    def test_ingest_failure_does_not_abort(self):
        assert "continue" in TEXT.lower() or "still" in TEXT.lower()

    def test_sequential_ingest_not_parallel(self):
        # GBrain DB writes must be sequential — no threading/parallel hints
        assert "parallel" not in TEXT.lower() or "not safe to parallelize" in TEXT.lower() or \
               "sequential" in TEXT.lower()


class TestDiscordSummary:
    def test_posts_to_research_channel(self):
        assert "DISCORD_RESEARCH_CHANNEL_ID" in TEXT
        assert "#research" in TEXT or "research" in TEXT.lower()

    def test_summary_includes_week_count(self):
        assert "weeks of data" in TEXT or "weeks" in TEXT.lower()

    def test_summary_includes_avg_sleep_and_steps(self):
        assert "avg sleep" in TEXT.lower() or "Avg sleep" in TEXT
        assert "avg steps" in TEXT.lower() or "Avg steps" in TEXT


class TestErrorHandling:
    def test_file_not_found_gives_scp_instruction(self):
        assert "scp" in TEXT

    def test_missing_env_var_stops_before_parsing(self):
        assert "Missing env vars" in TEXT or "missing" in TEXT.lower()

    def test_handles_no_records_parsed(self):
        assert "No health records" in TEXT or "no data" in TEXT.lower() or "no records" in TEXT.lower()

    def test_documents_xml_parse_error_handling(self):
        assert "XML parse error" in TEXT or "parse error" in TEXT.lower()
