"""
Contract tests for error-detection skill.

Tests verify SKILL.md invariants:
- Correct frontmatter (tier 0, no outbound, no approval needed)
- Reads only via hermes_log_read — no shell execution for reading
- Alerting is conditional on errors found (silent-if-clean guarantee)
- Error grouping covers all required categories
- Discord alert uses env var, not hardcoded channel ID
- Error excerpts are hard-capped at 100 chars
- Cron schedule documented

Run: uvx pytest skills/dhruvaos/error-detection/tests/ -q
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

    def test_requires_alerts_channel_env_var(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_has_tests_field(self):
        assert "tests: tests/" in TEXT


class TestSilentOnClean:
    def test_silent_if_no_errors(self):
        # Skill MUST stay quiet when no errors found — empty stdout = no Discord message
        assert "silently" in TEXT.lower() or "silent" in TEXT.lower()

    def test_exit_condition_documented_for_no_errors(self):
        # Must explicitly document the no-errors exit path
        assert "Exit silently" in TEXT or "exit silently" in TEXT

    def test_no_errors_means_no_discord_message(self):
        # Confirm the skill knows empty stdout = no message
        assert "empty stdout" in TEXT or "no output" in TEXT.lower()


class TestErrorCategories:
    def test_detects_exception_keyword(self):
        assert "EXCEPTION" in TEXT

    def test_detects_error_keyword(self):
        assert "ERROR" in TEXT

    def test_detects_failed_keyword(self):
        assert "FAILED" in TEXT

    def test_detects_traceback(self):
        assert "Traceback" in TEXT or "traceback" in TEXT

    def test_detects_gbrain_connection_failures(self):
        assert "gbrain" in TEXT.lower() and (
            "connection" in TEXT.lower() or "refused" in TEXT.lower() or "timeout" in TEXT.lower()
        )

    def test_detects_cron_failures(self):
        assert "cron" in TEXT.lower() and "fail" in TEXT.lower()

    def test_high_error_threshold_is_three(self):
        # Skills with >3 errors get a special HIGH flag
        assert ">3" in TEXT or "3 error" in TEXT.lower() or "HIGH" in TEXT


class TestLogReading:
    def test_reads_gateway_log_path(self):
        assert "gateway.log" in TEXT

    def test_reads_500_lines(self):
        assert "500" in TEXT

    def test_uses_hermes_log_read_tool(self):
        assert "hermes_log_read" in TEXT

    def test_has_fallback_for_missing_log_read_tool(self):
        # Must document fallback when hermes_log_read is unavailable
        assert "fall back" in TEXT.lower() or "fallback" in TEXT.lower()


class TestAlertFormat:
    def test_posts_to_alerts_channel_via_env_var(self):
        # Channel must be referenced by env var name, never hardcoded
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT
        # Must NOT contain hardcoded channel IDs (16-18 digit strings)
        import re
        hardcoded_ids = re.findall(r"\b1[0-9]{15,17}\b", TEXT)
        assert hardcoded_ids == [], f"Hardcoded channel ID(s) found: {hardcoded_ids}"

    def test_error_excerpt_capped_at_100_chars(self):
        assert "100" in TEXT and ("chars" in TEXT.lower() or "char" in TEXT.lower() or "[:100]" in TEXT)

    def test_alert_includes_hermes_logs_command(self):
        # Must tell Dhruva how to get the full trace
        assert "hermes logs" in TEXT

    def test_discord_message_stays_under_2000_chars(self):
        # Discord hard limit must be respected
        assert "1950" in TEXT or "2000" in TEXT or "1900" in TEXT

    def test_groups_errors_by_skill_name(self):
        assert "by_skill" in TEXT or "errors_by_skill" in TEXT or "group" in TEXT.lower()


class TestCronAndDoneCondition:
    def test_cron_schedule_documented(self):
        assert "0 */6 * * *" in TEXT

    def test_cron_setup_command_shown(self):
        assert "hermes cron create" in TEXT

    def test_done_condition_covers_silent_exit(self):
        # Done condition section must mention the silent-exit case
        done_pos = TEXT.find("Done Condition")
        assert done_pos != -1, "Done Condition section missing"
        done_section = TEXT[done_pos:]
        assert "silent" in done_section.lower() or "no output" in done_section.lower()

    def test_no_shell_execution_for_log_reading(self):
        # Skill must not use shell to tail the log — hermes_log_read only
        # (shell would need approval, but requires_approval: false)
        assert "tail -n" not in TEXT
        assert "tail -500" not in TEXT
