#!/usr/bin/env bash
# DhruvaOS health check — run from Mac or Omen
# Usage: ./scripts/health-check.sh [--omen-only] [--local-only]
# From Mac: ssh dhruva@omen 'bash -s' < scripts/health-check.sh

set -uo pipefail

# Fix PATH for non-login SSH sessions (pm2, gbrain, hermes need node/bun paths)
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:$PATH"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo "=============================================="
echo " DhruvaOS Health Check — $(date '+%Y-%m-%d %H:%M %Z')"
echo "=============================================="

# Hermes gateway
if systemctl --user is-active --quiet hermes-gateway 2>/dev/null; then
    pass "Hermes gateway: active"
else
    fail "Hermes gateway: INACTIVE — run: systemctl --user start hermes-gateway"
fi

# GBrain MCP
if pm2 list 2>/dev/null | grep "gbrain-mcp" | grep -q "online"; then
    MEM=$(pm2 list 2>/dev/null | grep gbrain-mcp | grep -o '[0-9.]*mb' | head -1)
    pass "GBrain MCP: online ($MEM)"
elif pm2 list 2>/dev/null | grep -q "gbrain-mcp"; then
    pass "GBrain MCP: running (check pm2 list for exact status)"
else
    fail "GBrain MCP: NOT FOUND — run: pm2 start gbrain-mcp"
fi

# Ollama
if systemctl is-active --quiet ollama 2>/dev/null; then
    pass "Ollama: active"
    # Check phi4-mini model
    if ollama list 2>/dev/null | grep -q "phi4-mini"; then
        pass "phi4-mini: loaded"
    else
        warn "phi4-mini: not in ollama list — run: ollama pull phi4-mini"
    fi
else
    warn "Ollama: not active (non-critical if using cloud models only)"
fi

# Tailscale
if command -v tailscale >/dev/null 2>&1; then
    TSIP=$(tailscale ip -4 2>/dev/null | head -1)
    if [ -n "$TSIP" ]; then
        pass "Tailscale: connected ($TSIP)"
    else
        warn "Tailscale: installed but not authenticated — run: sudo tailscale up"
    fi
else
    warn "Tailscale: not installed"
fi

# UFW
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    pass "UFW: active"
else
    warn "UFW: not active"
fi

# auditd
if systemctl is-active --quiet auditd 2>/dev/null; then
    pass "auditd: active"
else
    warn "auditd: not active"
fi

# GBrain database
if [ -d "$HOME/.gbrain/brain.pglite" ]; then
    DB_SIZE=$(du -sh "$HOME/.gbrain/brain.pglite" 2>/dev/null | cut -f1)
    pass "GBrain DB: exists ($DB_SIZE)"
else
    fail "GBrain DB: missing — run: gbrain init"
fi

# .env file
if [ -f "$HOME/.hermes/.env" ]; then
    KEY_COUNT=$(grep -c "^[A-Z_]*=." "$HOME/.hermes/.env" 2>/dev/null || echo "0")
    pass ".hermes/.env: $KEY_COUNT keys present"
    # Check critical keys
    for KEY in ANTHROPIC_API_KEY DISCORD_BOT_TOKEN GMAIL_REFRESH_TOKEN NOTION_API_KEY EXA_API_KEY; do
        if grep -q "^${KEY}=." "$HOME/.hermes/.env" 2>/dev/null; then
            pass "  $KEY: set"
        else
            fail "  $KEY: MISSING"
        fi
    done
else
    fail ".hermes/.env: NOT FOUND"
fi

# Google API credentials test
if [ -f "$HOME/.hermes/scripts/google_api_helper.py" ]; then
    VENV="$HOME/.hermes/hermes-agent/venv/bin/python"
    if [ -f "$VENV" ]; then
        RESULT=$(set -a; source "$HOME/.hermes/.env" 2>/dev/null; set +a; "$VENV" "$HOME/.hermes/scripts/google_api_helper.py" test 2>&1 | head -2)
        if echo "$RESULT" | grep -q "OK"; then
            pass "Google API: credentials valid"
        else
            warn "Google API: $RESULT"
        fi
    fi
fi

# Cron jobs
MORNING=$(crontab -l 2>/dev/null | grep "morning\|briefing" | wc -l | tr -d ' ')
DREAM=$(crontab -l 2>/dev/null | grep "gbrain dream" | wc -l | tr -d ' ')
if [ "$MORNING" -gt 0 ] || [ -f "$HOME/.hermes/cron/jobs.json" ]; then
    pass "Hermes cron: jobs.json exists"
else
    warn "Morning briefing cron: check ~/.hermes/cron/jobs.json"
fi
if [ "$DREAM" -gt 0 ]; then
    pass "Dream cron: set (3am)"
else
    warn "Dream cron: not in crontab"
fi

# Skills count
SKILL_COUNT=$(ls -d "$HOME/.hermes/skills/dhruvaos/"*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$SKILL_COUNT" -ge 8 ]; then
    pass "DhruvaOS skills: $SKILL_COUNT deployed"
else
    warn "DhruvaOS skills: only $SKILL_COUNT found (expected 8)"
fi

# Hermes logs — recent errors
ERRORS=$(tail -50 "$HOME/.hermes/logs/gateway.log" 2>/dev/null | grep -c "ERROR\|CRITICAL" 2>/dev/null || echo "0")
ERRORS=$(echo "$ERRORS" | head -1 | tr -d '[:space:]')
if [ "${ERRORS:-0}" = "0" ]; then
    pass "Hermes logs: no recent errors"
else
    warn "Hermes logs: $ERRORS errors in last 50 lines — check: tail -50 ~/.hermes/logs/gateway.log"
fi

echo "=============================================="
echo " Done. SSH to omen: ssh dhruva@100.119.229.11"
echo "=============================================="
