#!/usr/bin/env bash
# Zero-LLM heartbeat monitor — runs every 15 min via system cron on Omen.
# Checks Hermes, GBrain, dream cycle, and morning briefing.
# Alerts phone via ntfy.sh if anything is wrong.
# No LLM calls. No Hermes dependency. Runs independently as a safety net.
#
# Install:
#   scp scripts/drew-heartbeat.sh dhruva@100.119.229.11:~/.hermes/scripts/
#   ssh dhruva@100.119.229.11 "chmod +x ~/.hermes/scripts/drew-heartbeat.sh"
#   Then add to system crontab (not Hermes cron — system crontab survives Hermes crashes):
#   */15 * * * * /home/dhruva/.hermes/scripts/drew-heartbeat.sh >> /home/dhruva/.hermes/logs/heartbeat.log 2>&1

set -euo pipefail

PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"

NTFY_TOPIC="${NTFY_TOPIC:-}"
LOG_DIR="$HOME/.hermes/logs"
GATEWAY_LOG="$LOG_DIR/gateway.log"
HEARTBEAT_LOG="$LOG_DIR/heartbeat.log"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date +"%Y-%m-%d")
HOUR=$(date +"%H")
FAILURES=()

# Load env vars (ntfy topic lives here)
if [ -f "$HOME/.hermes/.env" ]; then
    # shellcheck disable=SC1091
    set -a; source "$HOME/.hermes/.env" 2>/dev/null || true; set +a
fi
NTFY_TOPIC="${NTFY_TOPIC:-}"

send_alert() {
    local msg="$1"
    echo "[$NOW] ALERT: $msg" | tee -a "$HEARTBEAT_LOG"
    if [ -n "$NTFY_TOPIC" ]; then
        curl -s --max-time 5 \
            -H "Title: DhruvaOS Alert" \
            -H "Priority: high" \
            -H "Tags: warning,robot" \
            -d "$msg" \
            "https://ntfy.sh/$NTFY_TOPIC" > /dev/null 2>&1 || true
    fi
}

# ── Check 1: Hermes systemd service ──────────────────────────
if ! systemctl --user is-active --quiet hermes-gateway 2>/dev/null; then
    FAILURES+=("Hermes gateway is NOT running (systemd)")
fi

# ── Check 2: GBrain MCP HTTP endpoint ────────────────────────
if ! curl -sf --max-time 3 "http://localhost:3131/health" > /dev/null 2>&1; then
    # Try the root path as some versions use /
    if ! curl -sf --max-time 3 "http://localhost:3131/" > /dev/null 2>&1; then
        FAILURES+=("GBrain MCP not responding on :3131")
    fi
fi

# ── Check 3: PM2 has gbrain-mcp running ──────────────────────
if command -v pm2 &>/dev/null; then
    if ! pm2 list --no-color 2>/dev/null | grep -q "gbrain-mcp.*online"; then
        FAILURES+=("gbrain-mcp PM2 process is not online")
    fi
fi

# ── Check 4: Morning briefing ran today (only check after 9am) ─
if [ "$HOUR" -ge 9 ] && [ -f "$GATEWAY_LOG" ]; then
    if ! grep -q "morning.briefing\|morning_briefing" "$GATEWAY_LOG" 2>/dev/null | grep -q "$TODAY" 2>/dev/null; then
        # More permissive check — look for today's date near any briefing mention
        if ! grep "$TODAY" "$GATEWAY_LOG" 2>/dev/null | grep -qi "briefing"; then
            FAILURES+=("Morning briefing may not have run today ($TODAY)")
        fi
    fi
fi

# ── Check 5: Dream cycle ran last night (only check after 4am) ─
if [ "$HOUR" -ge 4 ] && [ "$HOUR" -le 10 ]; then
    YESTERDAY=$(date -d "yesterday" +"%Y-%m-%d" 2>/dev/null || date -v-1d +"%Y-%m-%d")
    DREAM_LOG="$LOG_DIR/gbrain-dream.log"
    if [ -f "$DREAM_LOG" ]; then
        if ! grep -q "$YESTERDAY\|$TODAY" "$DREAM_LOG" 2>/dev/null; then
            FAILURES+=("Dream cycle may not have run last night")
        fi
    fi
fi

# ── Check 6: GBrain OAuth token expiry warning ───────────────
# Token expires ~Sept 5, 2026. Warn 14 days before.
EXPIRY_EPOCH=1757030400  # 2026-09-05 00:00 UTC
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
if [ "$DAYS_LEFT" -le 14 ] && [ "$DAYS_LEFT" -ge 0 ]; then
    FAILURES+=("GBrain OAuth token expires in ${DAYS_LEFT} days — run refresh script NOW")
fi

# ── Report ────────────────────────────────────────────────────
echo "[$NOW] heartbeat: ${#FAILURES[@]} failure(s)" >> "$HEARTBEAT_LOG"

if [ ${#FAILURES[@]} -eq 0 ]; then
    echo "[$NOW] OK — all checks passed" >> "$HEARTBEAT_LOG"
    exit 0
fi

# Build alert message
ALERT_BODY="DhruvaOS heartbeat failed at $NOW:"$'\n'
for f in "${FAILURES[@]}"; do
    ALERT_BODY+="  • $f"$'\n'
done

send_alert "$ALERT_BODY"
exit 1
