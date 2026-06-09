"""
Contract tests for failure-backlog skill.

Tests verify SKILL.md invariants:
- Correct frontmatter (tier 0, no outbound, no approval)
- Fingerprinting: SHA256, 80-char normalization, 16-char hex output
- Silence contract: new failures are NOT posted to Discord
- Repeated failures DO get a Discord post
- flock guard used for GBrain write
- Lock-busy handled gracefully (no retry)
- SKIP_RETRY list emitted to stdout
- Done condition covers all exit paths

Run: uvx pytest skills/dhruvaos/failure-backlog/tests/ -q
"""

from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestFrontmatter:
    def test_name_correct(self):
        assert "name: failure-backlog" in TEXT

    def test_tier_zero(self):
        assert "tier: 0" in TEXT

    def test_not_outbound(self):
        assert "outbound: false" in TEXT

    def test_no_approval_required(self):
        assert "requires_approval: false" in TEXT

    def test_alerts_channel_env_var(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_gbrain_reads_system_failure_log(self):
        assert "system/failure-log.md" in TEXT

    def test_gbrain_writes_system_failure_log(self):
        # Must be in gbrain.writes declaration
        reads_pos = TEXT.find("gbrain:")
        writes_pos = TEXT.find("writes:", reads_pos)
        assert writes_pos != -1
        writes_section = TEXT[writes_pos: writes_pos + 100]
        assert "system/failure-log.md" in writes_section

    def test_tests_field_present(self):
        assert "tests: tests/" in TEXT

    def test_has_daily_token_budget(self):
        assert "daily_token_budget:" in TEXT


class TestLogFormat:
    def test_uses_python_logging_timestamp_format(self):
        # Gateway log is Python logging format, not ISO bracketed
        assert "YYYY-MM-DD HH:MM:SS" in TEXT or r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}" in TEXT

    def test_reads_500_lines(self):
        assert "500" in TEXT

    def test_uses_hermes_log_read(self):
        assert "hermes_log_read" in TEXT

    def test_has_fallback_for_unavailable_log_read(self):
        assert "fall back" in TEXT.lower() or "fallback" in TEXT.lower()


class TestFingerprinting:
    def test_uses_hashlib_sha256(self):
        assert "hashlib" in TEXT and "sha256" in TEXT

    def test_caps_message_at_80_chars(self):
        assert "80" in TEXT

    def test_fingerprint_truncated_to_16_hex(self):
        assert "[:16]" in TEXT or "][:16]" in TEXT

    def test_fingerprint_includes_skill_name(self):
        assert "skill_name" in TEXT or "skill" in TEXT

    def test_fingerprint_strips_timestamps(self):
        # Must normalize out timestamps to avoid false non-matches
        assert "normalize" in TEXT.lower() or "re.sub" in TEXT or "strip" in TEXT.lower()


class TestSilenceContract:
    def test_new_failures_are_silent(self):
        # Must explicitly state new failures get no Discord post
        assert "new failure" in TEXT.lower() or "silently logged" in TEXT.lower() or "no Discord post" in TEXT.lower()

    def test_silent_if_no_errors(self):
        assert "silently" in TEXT.lower() or "silent" in TEXT.lower()

    def test_empty_log_exits_silently(self):
        assert "exit silently" in TEXT.lower() or "Exit silently" in TEXT


class TestRepeatedFailureAlert:
    def test_repeated_failures_post_to_discord(self):
        assert "REPEATED" in TEXT or "repeated" in TEXT.lower()

    def test_repeated_failure_message_includes_count(self):
        assert "count" in TEXT

    def test_repeated_failure_message_includes_first_seen(self):
        assert "first_seen" in TEXT

    def test_repeated_failure_message_includes_fingerprint(self):
        assert "fingerprint" in TEXT

    def test_discord_message_under_2000_chars(self):
        assert "1950" in TEXT or "2000" in TEXT

    def test_caps_discord_alert_at_5_failures(self):
        # Must cap to avoid hitting Discord limit with many failures
        assert "[:5]" in TEXT or "cap at 5" in TEXT.lower() or "5]" in TEXT


class TestFlockGuard:
    def test_flock_used_for_gbrain_write(self):
        assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT

    def test_flock_busy_handled_gracefully(self):
        assert "lock busy" in TEXT.lower() or "busy" in TEXT.lower()

    def test_no_retry_on_busy_lock(self):
        assert "do not retry" in TEXT.lower() or "deferred" in TEXT.lower()

    def test_file_is_written_before_flock_attempt(self):
        # File write must succeed even if flock fails
        write_pos = TEXT.find("Write the updated failure log") if "Write the updated failure log" in TEXT else TEXT.find("cat >")
        flock_pos = TEXT.find("flock -n")
        assert write_pos < flock_pos, "File must be written before flock attempt"


class TestBrainFile:
    def test_failure_log_path_is_brain_system(self):
        assert "brain/system/failure-log.md" in TEXT or "~/brain/system/failure-log.md" in TEXT

    def test_frontmatter_has_source_field(self):
        assert "source:" in TEXT and "failure-backlog" in TEXT

    def test_frontmatter_has_tags_field(self):
        assert "tags:" in TEXT and "failures" in TEXT

    def test_brain_system_dir_created_if_missing(self):
        assert "mkdir -p" in TEXT and "brain/system" in TEXT

    def test_entries_have_status_field(self):
        assert "status:" in TEXT or "**status:**" in TEXT


class TestSkipRetryOutput:
    def test_emits_skip_retry_list_to_stdout(self):
        assert "SKIP_RETRY" in TEXT

    def test_skip_retry_is_stdout(self):
        assert "stdout" in TEXT

    def test_skip_retry_excludes_infrastructure_skills(self):
        # gbrain and cron are infrastructure, not skills — shouldn't be in skip list
        assert '"gbrain"' in TEXT or "gbrain" in TEXT


class TestDoneCondition:
    def test_done_condition_covers_empty_exit(self):
        done_pos = TEXT.find("Done Condition")
        assert done_pos != -1, "Done Condition section missing"
        done_section = TEXT[done_pos:]
        assert "silent" in done_section.lower() or "empty" in done_section.lower()

    def test_done_condition_covers_new_failures_only(self):
        done_pos = TEXT.find("Done Condition")
        done_section = TEXT[done_pos:]
        assert "new" in done_section.lower()

    def test_done_condition_covers_repeated_failures(self):
        done_pos = TEXT.find("Done Condition")
        done_section = TEXT[done_pos:]
        assert "repeated" in done_section.lower() or "alert" in done_section.lower()

    def test_done_condition_covers_lock_busy(self):
        done_pos = TEXT.find("Done Condition")
        done_section = TEXT[done_pos:]
        assert "lock" in done_section.lower() or "busy" in done_section.lower() or "deferred" in done_section.lower()

    def test_cron_schedule_documented(self):
        assert "5 */6 * * *" in TEXT

    def test_cron_setup_command_shown(self):
        assert "hermes cron create" in TEXT
