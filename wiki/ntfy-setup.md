# ntfy.sh Setup Guide (Phase 3.5) ✅ CONFIGURED June 5, 2026

**Topic:** `dhruva-alerts-14a313f0dbe1` — already in `~/.hermes/.env` on Omen.
**Still needed:** Install ntfy iPhone app → subscribe to `ntfy.sh/dhruva-alerts-14a313f0dbe1`

Free push notifications to phone. No install needed on server — just HTTP POSTs.

## Setup (5 minutes)

### 1. Pick a random secret topic

```bash
# Generate unpredictable topic string (this IS your "password"):
openssl rand -hex 8
# Example output: a3f2c891d4e5b670
# Your topic: dhruva-alerts-a3f2c891d4e5b670
```

### 2. Test from Omen

```bash
ssh dhruva@<TAILSCALE_IP> "curl -s -d 'DhruvaOS test notification' ntfy.sh/dhruva-alerts-YOURSTRING"
```

Should appear on iPhone immediately.

### 3. iPhone setup

1. Install ntfy app (App Store — free)
2. Open app → Subscribe to topic
3. Server: `ntfy.sh` (default)
4. Topic: `dhruva-alerts-YOURSTRING`

### 4. Add to Omen .env

```bash
ssh dhruva@<TAILSCALE_IP> "echo 'NTFY_TOPIC=dhruva-alerts-YOURSTRING' >> ~/.hermes/.env"
# Restart Hermes so it picks up the new env var:
ssh dhruva@<TAILSCALE_IP> "systemctl --user restart hermes-gateway"
```

## Usage patterns

```bash
# Simple alert from Omen:
curl -d "message here" ntfy.sh/$NTFY_TOPIC

# With title and priority:
curl -H "Title: DhruvaOS Alert" -H "Priority: high" -d "Dream cycle FAILED" ntfy.sh/$NTFY_TOPIC

# Add to dream cron for failure alerts:
0 3 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain dream \
  || curl -s -d "GBrain dream cycle FAILED at $(date)" ntfy.sh/$NTFY_TOPIC
```

## Self-hosted option (optional, later)

If you want private notifications (no third-party server):
1. Run ntfy server on Omen: `docker run -p 80:80 binwiederhier/ntfy serve`
2. Expose via Cloudflare Tunnel
3. Change server in iPhone app to your Cloudflare URL
4. All notifications stay on your infrastructure

This is optional — ntfy.sh is trustworthy and the topic string IS the auth.

## What to notify

Add ntfy alerts for:
- Dream cycle failures
- Hermes gateway crashes (systemd can trigger on failure)
- Disk space > 85%
- Any skill error in skill-errors.log

Zero-LLM bash pattern (per BUILD_PLAN.md):
```bash
#!/usr/bin/env bash
# Zero-LLM cron: alert if Hermes is down
systemctl --user is-active --quiet hermes-gateway \
  || curl -s -H "Title: HERMES DOWN" -H "Priority: urgent" \
     -d "Hermes gateway stopped on Omen — restart: systemctl --user start hermes-gateway" \
     ntfy.sh/$NTFY_TOPIC
```
