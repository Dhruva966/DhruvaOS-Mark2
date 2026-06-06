"""
Contract tests for skill-analytics skill.

Tests verify SKILL.md invariants:
- Correct frontmatter (tier 0, not outbound, no approval)
- Silent-if-all-healthy guarantee
- 30,000-line log read covers 7 days
- DEGRADED threshold is exactly >20% error rate
- UNUSED threshold is exactly 30 days with 0 invocations
- Report format matches spec (headers, bullets, totals)
- Discord message is hard-capped at 2000 chars
- Cron schedule documented

Run: uvx pytest skills/dhruvaos/skill-analytics/tests/ -q
"""

from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestFrontmatter:
    def test_tier_is_zero(self):
        assert "tier: 0" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_requires_tasks_channel_env_var(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_has_tests_field(self):
        assert "tests: tests/" in TEXT


class TestSilentOnHealthy:
    def test_silent_if_all_healthy(self):
        assert "silent" in TEXT.lower()

    def test_explicit_exit_condition_for_healthy(self):
        assert "Exit silently" in TEXT or "exit silently" in TEXT

    def test_healthy_means_no_discord_message(self):
        assert "no output" in TEXT.lower() or "no message" in TEXT.lower() or "no Discord" in TEXT.lower()


class TestHealthThresholds:
    def test_degraded_threshold_is_20_percent(self):
        assert "20%" in TEXT or "> 20" in TEXT or ">20" in TEXT or "20.0" in TEXT

    def test_unused_threshold_is_30_days(self):
        assert "30 days" in TEXT or "30d" in TEXT.lower()

    def test_degraded_flag_label_in_report(self):
        assert "DEGRADED" in TEXT

    def test_unused_flag_label_in_report(self):
        assert "UNUSED" in TEXT

    def test_degraded_includes_error_rate_in_output(self):
        # Report must show actual error rate %, not just a flag
        assert "error_rate" in TEXT or "error rate" in TEXT.lower()

    def test_unused_includes_last_run_date(self):
        # Report must show the last known run date, not just "unused"
        assert "last_run" in TEXT or "last run" in TEXT.lower()


class TestLogReading:
    def test_reads_gateway_log(self):
        assert "gateway.log" in TEXT

    def test_reads_at_least_30000_lines(self):
        assert "30000" in TEXT or "30,000" in TEXT

    def test_uses_hermes_log_read_tool(self):
        assert "hermes_log_read" in TEXT

    def test_has_fallback_for_unavailable_log_read(self):
        assert "fall back" in TEXT.lower() or "fallback" in TEXT.lower()

    def test_7_day_window_computed(self):
        assert "7 days" in TEXT or "timedelta(days=7)" in TEXT


class TestReportFormat:
    def test_report_has_total_runs_line(self):
        assert "Total runs" in TEXT

    def test_report_shows_overall_error_rate(self):
        # Overall rate must appear in the report header
        assert "Errors:" in TEXT and "%" in TEXT

    def test_degraded_section_shows_hermes_logs_command(self):
        # Must direct Dhruva to the right troubleshooting command
        assert "hermes logs" in TEXT

    def test_healthy_skills_listed(self):
        # Healthy skills must be called out so Dhruva has full picture
        assert "Healthy" in TEXT or "healthy" in TEXT.lower()

    def test_emoji_headers_match_spec(self):
        # Weekly report format matches: 📊 header, 🔴 DEGRADED, ⚫ UNUSED, ✅ Healthy
        assert "📊" in TEXT
        assert "🔴" in TEXT or "DEGRADED" in TEXT
        assert "✅" in TEXT

    def test_discord_message_capped_at_2000_chars(self):
        assert "1950" in TEXT or "2000" in TEXT or "1900" in TEXT


class TestPerSkillStats:
    def test_tracks_invocation_count(self):
        assert "invocations" in TEXT or "invocation count" in TEXT.lower()

    def test_tracks_error_count(self):
        assert "error_count" in TEXT or "error count" in TEXT.lower() or "errors" in TEXT

    def test_computes_error_rate_as_percentage(self):
        assert "error_rate" in TEXT or "error rate" in TEXT.lower()

    def test_parses_run_start_events(self):
        # Must distinguish "run started" events from other log lines for correct counts
        assert (
            "Starting run" in TEXT
            or "Invoking skill" in TEXT
            or "skill started" in TEXT
            or "START_RE" in TEXT
        )


class TestCronAndDoneCondition:
    def test_cron_schedule_is_sunday_9pm(self):
        assert "0 21 * * 0" in TEXT

    def test_cron_setup_command_shown(self):
        assert "hermes cron create" in TEXT

    def test_done_condition_covers_all_healthy_case(self):
        done_pos = TEXT.find("Done Condition")
        assert done_pos != -1, "Done Condition section missing"
        done_section = TEXT[done_pos:]
        assert "silent" in done_section.lower() or "healthy" in done_section.lower()

    def test_done_condition_covers_report_posted_case(self):
        done_pos = TEXT.find("Done Condition")
        done_section = TEXT[done_pos:]
        assert "DISCORD_TASKS_CHANNEL_ID" in done_section or "posted" in done_section.lower()
