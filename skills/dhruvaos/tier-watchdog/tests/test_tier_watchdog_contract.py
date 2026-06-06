"""
Contract tests for tier-watchdog skill.

Tests verify SKILL.md invariants:
- Correct frontmatter (tier 0, not outbound, no approval)
- Silent-if-no-escalations guarantee
- Escalation threshold is exactly >30% of runs in 7 days
- Both explicit tier-number logs and model-name logs are parsed
- Promotion recommendation references config.yaml and hermes skill config command
- Discord alert uses env var channel ID, not hardcoded
- Cron schedule documented

Run: uvx pytest skills/dhruvaos/tier-watchdog/tests/ -q
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
    def test_silent_if_no_escalations(self):
        assert "silent" in TEXT.lower()

    def test_explicit_exit_condition_for_no_escalations(self):
        assert "Exit silently" in TEXT or "exit silently" in TEXT

    def test_empty_stdout_means_no_discord_message(self):
        assert "no output" in TEXT.lower() or "silent exit" in TEXT.lower() or "no output" in TEXT.lower()


class TestEscalationThreshold:
    def test_threshold_is_30_percent(self):
        assert "30%" in TEXT or "> 30" in TEXT or ">30" in TEXT or "30.0" in TEXT

    def test_threshold_applies_to_7_day_window(self):
        assert "7 days" in TEXT or "7-day" in TEXT

    def test_escalation_rate_computed_per_skill(self):
        assert "escalation_rate" in TEXT or "escalation rate" in TEXT.lower()


class TestLogParsing:
    def test_reads_gateway_log(self):
        assert "gateway.log" in TEXT

    def test_reads_at_least_30000_lines(self):
        assert "30000" in TEXT or "30,000" in TEXT

    def test_uses_hermes_log_read_tool(self):
        assert "hermes_log_read" in TEXT

    def test_has_fallback_for_unavailable_log_read(self):
        assert "fall back" in TEXT.lower() or "fallback" in TEXT.lower()

    def test_parses_explicit_configured_and_actual_tier(self):
        # Must handle log lines with explicit configured_tier=N actual_tier=M
        assert "configured" in TEXT and "actual" in TEXT

    def test_parses_model_name_to_tier(self):
        # Must also parse model names (e.g. claude-sonnet → tier 2) for escalation detection
        assert "MODEL_TIER_MAP" in TEXT or "model_tier" in TEXT.lower() or "model name" in TEXT.lower()

    def test_parses_escalation_signal_keyword(self):
        # Must detect "escalated" or "escalation" keywords in log lines
        assert "escalat" in TEXT.lower()

    def test_tier_map_covers_all_four_tiers(self):
        # All 4 tiers must be representable
        assert "phi4-mini" in TEXT or "phi4" in TEXT
        assert "gpt-4o-mini" in TEXT or "gpt-4o" in TEXT
        assert "claude-sonnet" in TEXT or "sonnet" in TEXT.lower()
        assert "claude-opus" in TEXT or "opus" in TEXT.lower()


class TestAlertContent:
    def test_alert_shows_escalated_count(self):
        assert "escalated" in TEXT.lower()

    def test_alert_shows_total_run_count(self):
        assert "runs" in TEXT.lower()

    def test_alert_shows_escalation_rate_percentage(self):
        assert "%" in TEXT

    def test_alert_recommends_config_yaml_change(self):
        assert "config.yaml" in TEXT

    def test_alert_shows_hermes_skill_config_command(self):
        assert "hermes skill config" in TEXT

    def test_alert_references_model_routing_spec(self):
        # Ties alert back to MODEL_ROUTING.md rule
        assert "MODEL_ROUTING" in TEXT or "30% escalation" in TEXT

    def test_alert_emoji_present(self):
        assert "⚠️" in TEXT


class TestDiscordPosting:
    def test_no_hardcoded_channel_ids(self):
        import re
        hardcoded = re.findall(r"\b1[0-9]{15,17}\b", TEXT)
        assert hardcoded == [], f"Hardcoded channel IDs found: {hardcoded}"

    def test_posts_to_alerts_channel(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_discord_message_capped_to_avoid_truncation(self):
        assert "1950" in TEXT or "2000" in TEXT or "1900" in TEXT

    def test_logs_on_discord_post_failure(self):
        assert "skill-errors.log" in TEXT


class TestCronAndDoneCondition:
    def test_cron_schedule_is_daily_6am(self):
        assert "0 6 * * *" in TEXT

    def test_cron_setup_command_shown(self):
        assert "hermes cron create" in TEXT

    def test_done_condition_covers_silent_case(self):
        done_pos = TEXT.find("Done Condition")
        assert done_pos != -1, "Done Condition section missing"
        done_section = TEXT[done_pos:]
        assert "silent" in done_section.lower() or "no escalations" in done_section.lower()

    def test_done_condition_covers_alert_posted_case(self):
        done_pos = TEXT.find("Done Condition")
        done_section = TEXT[done_pos:]
        assert "DISCORD_ALERTS_CHANNEL_ID" in done_section or "posted" in done_section.lower()
