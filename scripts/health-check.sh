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

MODE="auto"
case "${1:-}" in
    --omen-only) MODE="omen" ;;
    --local-only) MODE="local" ;;
    "") ;;
    *) warn "Unknown option: $1 (expected --omen-only or --local-only)" ;;
esac

OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
if [ "$MODE" = "auto" ] && [ "$OS_NAME" = "Darwin" ]; then
    MODE="local"
elif [ "$MODE" = "auto" ]; then
    MODE="omen"
fi

if [ "$MODE" = "local" ]; then
    pass "Mode: local repo check ($OS_NAME)"
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || pwd)"
    if [ -f "$ROOT/CLAUDE.md" ] && [ -f "$ROOT/AGENTS.md" ]; then
        pass "Repo docs: CLAUDE.md + AGENTS.md present"
    else
        fail "Repo docs: missing CLAUDE.md or AGENTS.md"
    fi
    if bash -n "$ROOT"/scripts/*.sh 2>/dev/null; then
        pass "Shell scripts: syntax OK"
    else
        fail "Shell scripts: syntax error"
    fi
    if [ -x "$ROOT/scripts/check-skill-contracts.py" ] && "$ROOT/scripts/check-skill-contracts.py"; then
        pass "Skill contracts: clean"
    else
        warn "Skill contracts: checker failed or not executable"
    fi
    if command -v tailscale >/dev/null 2>&1; then
        TSIP=$(tailscale ip -4 2>/dev/null | head -1)
        [ -n "$TSIP" ] && pass "Local Tailscale: connected ($TSIP)" || warn "Local Tailscale: installed but no IP"
    else
        warn "Local Tailscale: not installed"
    fi
    echo "=============================================="
    echo " Local check done. Omen service check:"
    echo "   ssh dhruva@<TAILSCALE_IP> 'bash -s -- --omen-only' < scripts/health-check.sh"
    echo "=============================================="
    exit 0
fi

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

# GBrain MCP has no auth; port 3131 must never bind to a network interface.
if command -v ss >/dev/null 2>&1; then
    GBRAIN_LISTEN=$(ss -ltn 2>/dev/null | awk '$4 ~ /:3131$/ {print $4}' | tr '\n' ' ')
    if [ -z "$GBRAIN_LISTEN" ]; then
        warn "GBrain MCP bind: port 3131 not listening"
    else
        NON_LOOPBACK=""
        for ADDR in $GBRAIN_LISTEN; do
            case "$ADDR" in
                127.0.0.1:3131|localhost:3131|\[::1\]:3131) ;;
                *) NON_LOOPBACK="$NON_LOOPBACK $ADDR" ;;
            esac
        done
        if [ -n "$NON_LOOPBACK" ]; then
            fail "GBrain MCP bind: non-loopback listener detected ($NON_LOOPBACK)"
        else
            pass "GBrain MCP bind: loopback only ($GBRAIN_LISTEN)"
        fi
    fi
else
    warn "GBrain MCP bind: skipped (ss not installed)"
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

# UFW. Use non-interactive sudo so this health check never hangs in SSH/CI.
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    if sudo -n ufw status 2>/dev/null | grep -q "Status: active"; then
        pass "UFW: active"
    else
        warn "UFW: not active"
    fi
else
    warn "UFW: skipped (sudo unavailable or password required)"
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

# Runtime versions
if command -v hermes >/dev/null 2>&1; then
    HERMES_VERSION=$(hermes --version 2>/dev/null | head -1)
    pass "Hermes CLI: ${HERMES_VERSION:-installed}"
else
    warn "Hermes CLI: not in PATH"
fi
if command -v gbrain >/dev/null 2>&1; then
    GBRAIN_VERSION=$(gbrain --version 2>/dev/null | head -1)
    pass "GBrain CLI: ${GBRAIN_VERSION:-installed}"
else
    warn "GBrain CLI: not in PATH"
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
if [ -f "$HOME/.hermes/cron/jobs.json" ]; then
    pass "Hermes cron: jobs.json exists"
elif [ "$MORNING" -gt 0 ]; then
    pass "Morning briefing cron: present in crontab"
else
    warn "Morning briefing cron: check ~/.hermes/cron/jobs.json"
fi
if [ "$DREAM" -gt 0 ]; then
    pass "Dream cron: set (3am)"
else
    warn "Dream cron: not in crontab"
fi

# Skills count
SKILL_COUNT=$(find "$HOME/.hermes/skills/dhruvaos" -mindepth 2 -maxdepth 2 -name SKILL.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$SKILL_COUNT" -ge 10 ]; then
    pass "DhruvaOS skills: $SKILL_COUNT deployed"
elif [ "$SKILL_COUNT" -ge 8 ]; then
    warn "DhruvaOS skills: $SKILL_COUNT deployed (expected 10 — missing github-update/linkedin-post?)"
else
    warn "DhruvaOS skills: only $SKILL_COUNT found (expected 10)"
fi

# GBrain onboard health. This can be moderately expensive, so keep the output compact.
if command -v gbrain >/dev/null 2>&1; then
    ONBOARD=$(gbrain onboard --check --json 2>/dev/null | head -c 2000 || true)
    if echo "$ONBOARD" | grep -q '"recommendations"[[:space:]]*:[[:space:]]*\[\]'; then
        pass "GBrain onboard: no recommendations"
    elif [ -n "$ONBOARD" ]; then
        warn "GBrain onboard: recommendations or warnings present"
    else
        warn "GBrain onboard: check failed or produced no output"
    fi
fi

# GBrain brain file count
BRAIN_FILES=$(find "$HOME/brain" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "${BRAIN_FILES:-0}" -gt 0 ]; then
    pass "Brain markdown files: $BRAIN_FILES"
    if [ "${BRAIN_FILES:-0}" -lt 20 ]; then
        warn "  Brain has <20 files — braindump session recommended (see MEMORY.md)"
    fi
else
    warn "Brain files: none found in ~/brain/ — run gbrain import after adding content"
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
echo " Done. SSH target lives in the private ops note: ssh dhruva@<TAILSCALE_IP>"
echo "=============================================="
