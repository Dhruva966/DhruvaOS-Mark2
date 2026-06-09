from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: gbrain-health-monitor" in TEXT
        assert "tier: 0" in TEXT
        assert "outbound: false" in TEXT
        assert "requires_approval: false" in TEXT
        assert "description:" in TEXT

    def test_no_outbound_without_approval(self):
        assert "outbound: false" in TEXT
        assert "outbound: true" not in TEXT

    def test_declares_required_env_vars(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT

    def test_posts_only_to_alerts_channel(self):
        assert "DISCORD_ALERTS_CHANNEL_ID" in TEXT
        assert "DISCORD_TASKS_CHANNEL_ID" not in TEXT
        assert "DISCORD_BRIEFINGS_CHANNEL_ID" not in TEXT

    def test_no_hardcoded_channel_ids(self):
        import re
        # channel IDs are 17-19 digit numbers
        ids = re.findall(r'\b\d{17,19}\b', TEXT)
        assert ids == [], f"Hardcoded channel IDs found: {ids}"

    def test_checks_health_endpoint(self):
        assert "127.0.0.1:3131/health" in TEXT
        assert "HTTP_STATUS" in TEXT

    def test_silent_when_healthy(self):
        assert "STOP" in TEXT or "silent" in TEXT.lower() or "Do NOT post" in TEXT

    def test_uses_pm2_auto_recovery(self):
        assert "pm2" in TEXT.lower() or "PM2" in TEXT
        assert "restart gbrain-mcp" in TEXT

    def test_retry_after_restart(self):
        assert "sleep 10" in TEXT or "HTTP_STATUS_RETRY" in TEXT

    def test_failure_counter_tracked(self):
        assert "health-failures.count" in TEXT
        assert "FAILURE_COUNT" in TEXT or "PREV_FAILURES" in TEXT

    def test_alert_spam_prevention(self):
        assert "every 3" in TEXT.lower() or "divisible by 3" in TEXT.lower() or "COUNT divisible" in TEXT

    def test_recovery_notification(self):
        assert "recovered" in TEXT.lower() or "RECOVERED" in TEXT

    def test_logs_status_line(self):
        assert "gbrain-health-monitor" in TEXT
        assert "STATUS=" in TEXT

    def test_gbrain_path_uses_source_repo(self):
        assert "gbrain-src" not in TEXT  # health check only pings HTTP — no direct gbrain binary call

    def test_connect_timeout_set(self):
        assert "connect-timeout" in TEXT or "max-time" in TEXT

    def test_hourly_described(self):
        assert "every hour" in TEXT.lower() or "Hourly" in TEXT or "hourly" in TEXT.lower()
