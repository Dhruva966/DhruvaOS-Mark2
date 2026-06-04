#!/usr/bin/env bash
# DhruvaOS Mark 2 — Phase 0 Setup
# Run as your regular sudo user on a fresh Ubuntu install.
# Creates dhruvaos user, installs all runtimes, wires up Hermes + GBrain.
# Usage: bash phase0-setup.sh
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[P0]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# --- Sanity checks ---
[ "$EUID" -eq 0 ] && die "Don't run as root. Run as your regular user (with sudo)."
command -v sudo >/dev/null || die "sudo required."

log "=== DhruvaOS Mark 2 — Phase 0 Setup ==="
echo "Ubuntu $(lsb_release -d -s) | $(uname -m)"
echo ""

# ============================================================
# P0.1 — Create dhruvaos user
# ============================================================
log "[P0.1] Create dhruvaos user..."
if id dhruvaos &>/dev/null; then
  warn "dhruvaos user already exists — skipping creation"
else
  sudo useradd -m -s /bin/bash dhruvaos
  log "Created dhruvaos user. Set a password now:"
  sudo passwd dhruvaos
  # Temporary sudo so we can install tools on their behalf
  sudo usermod -aG sudo dhruvaos
  warn "dhruvaos added to sudo temporarily — will be removed at end of P0.18"
fi

# ============================================================
# P0.2 — OS prerequisites
# ============================================================
log "[P0.2] Installing OS prerequisites..."
sudo apt-get update -q
sudo apt-get install -y -q \
  git curl build-essential \
  python3.11 python3.11-venv python3.11-dev \
  apparmor-utils apparmor-profiles-extra \
  auditd ufw \
  ripgrep ffmpeg \
  jq
python3.11 --version | grep -q "3.11" || die "python3.11 install failed"
log "Python 3.11 OK"

# ============================================================
# P0.3-P0.5 — Bun, Node, PM2 (install as dhruvaos)
# ============================================================
log "[P0.3] Installing Bun for dhruvaos..."
sudo -u dhruvaos bash -c '
  curl -fsSL https://bun.sh/install | bash
  ~/.bun/bin/bun --version
'
log "Bun OK"

log "[P0.4] Installing Node v24 via nvm for dhruvaos..."
sudo -u dhruvaos bash -c '
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install 24
  nvm alias default 24
  node --version
'
log "Node v24 OK"

log "[P0.5] Installing PM2 globally for dhruvaos..."
sudo -u dhruvaos bash -c '
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  npm install -g pm2
  pm2 --version
'
log "PM2 OK"

# ============================================================
# P0.6-P0.7 — Ollama + phi4-mini
# ============================================================
log "[P0.6] Installing Ollama (systemd service)..."
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
sudo systemctl enable ollama
sudo systemctl start ollama
sleep 3
systemctl is-active --quiet ollama || die "Ollama systemd service not active"
log "Ollama service active"

log "[P0.7] Pulling phi4-mini (~2.5 GB, RTX 2060 — this takes a few minutes)..."
sudo -u dhruvaos bash -c 'ollama pull phi4-mini'
ollama list | grep -q "phi4-mini" || die "phi4-mini not in ollama list"
log "phi4-mini OK"

# ============================================================
# P0.8 — Hermes Agent
# ============================================================
log "[P0.8] Installing Hermes Agent for dhruvaos..."
sudo -u dhruvaos bash -c '
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
  source ~/.bashrc
  hermes --version || {
    echo "WARN: hermes not in PATH after install — checking .hermes-src"
    ls ~/.hermes-src/ || echo "hermes-src not found"
  }
'
log "Hermes install done (verify: hermes --version as dhruvaos)"

# ============================================================
# P0.9 — GBrain
# ============================================================
log "[P0.9] Installing GBrain for dhruvaos..."
sudo -u dhruvaos bash -c '
  ~/.bun/bin/bun install -g github:garrytan/gbrain
  ~/.bun/bin/gbrain upgrade || warn "gbrain upgrade failed — continuing with installed version"
  ~/.bun/bin/gbrain --version
'
log "GBrain OK"

# ============================================================
# P0.10 — Brain scaffold + GBrain init
# ============================================================
log "[P0.10] Scaffolding ~/brain/ directories..."
sudo -u dhruvaos bash -c '
  mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
  echo "# Brain" > ~/brain/README.md
  ls ~/brain/
'
log "Brain scaffold OK"

log "[P0.11] Writing GBrain config (must precede gbrain init)..."
sudo -u dhruvaos bash -c 'cat > ~/.gbrain/config.json << '"'"'EOF'"'"'
{
  "engine": "pglite",
  "search_mode": "balanced",
  "embedding_provider": "zeroentropy",
  "query_expansion": false,
  "brain_path": "~/brain"
}
EOF
cat ~/.gbrain/config.json'
log "GBrain config written"

log "[P0.10] Running gbrain init..."
sudo -u dhruvaos bash -c '
  mkdir -p ~/.gbrain
  ~/.bun/bin/gbrain init
  ~/.bun/bin/gbrain apply-migrations --yes 2>/dev/null || true
'
log "GBrain init OK"

# ============================================================
# P0.12 — GBrain onboard check
# ============================================================
log "[P0.12] Running gbrain onboard check..."
sudo -u dhruvaos bash -c '~/.bun/bin/gbrain onboard --check --json' \
  && log "GBrain onboard: all checks green" \
  || warn "GBrain onboard: some checks failed — review output above"

# ============================================================
# P0.13 — Discord (manual step)
# ============================================================
echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}[P0.13] MANUAL STEP: Discord bot setup${NC}"
echo -e "${YELLOW}============================================================${NC}"
echo "1. Go to https://discord.com/developers/applications"
echo "2. New Application → name: DhruvaOS"
echo "3. Bot → Add Bot → copy token (DISCORD_BOT_TOKEN)"
echo "4. OAuth2 → URL Generator → scopes: bot"
echo "   permissions: Send Messages, Read Message History, Add Reactions"
echo "5. Open generated URL → add bot to your server"
echo "6. Create 6 channels: #briefings #tasks #research #alerts #charlie #corrections"
echo "7. Enable Developer Mode in Discord → right-click username → Copy User ID (DISCORD_ALLOWED_USER)"
echo ""
read -p "Press ENTER when Discord setup is complete..."
echo ""

# ============================================================
# P0.14 — Create .env file
# ============================================================
log "[P0.14] Creating ~/.config/dhruvaos/.env..."
sudo -u dhruvaos bash -c '
  mkdir -p ~/.config/dhruvaos
  touch ~/.config/dhruvaos/.env
  chmod 600 ~/.config/dhruvaos/.env
  ls -la ~/.config/dhruvaos/.env
'
log ".env created (chmod 600). Fill in your API keys:"
echo ""
echo "  sudo -u dhruvaos nano /home/dhruvaos/.config/dhruvaos/.env"
echo ""
echo "  Required entries:"
echo "    OPENAI_API_KEY=sk-proj-..."
echo "    ANTHROPIC_API_KEY=sk-ant-..."
echo "    DISCORD_BOT_TOKEN=..."
echo "    DISCORD_ALLOWED_USER=..."
echo ""
echo "  Optional (add when needed):"
echo "    OPENROUTER_API_KEY=..."
echo "    EXA_API_KEY=..."
echo "    FIRECRAWL_API_KEY=..."
echo "    BROWSERBASE_API_KEY=..."
echo ""
read -p "Press ENTER when .env is filled in..."

# ============================================================
# P0.15 — Write ~/.hermes/config.yaml
# ============================================================
log "[P0.15] Writing Hermes config.yaml..."
sudo -u dhruvaos bash -c '
mkdir -p ~/.hermes
cat > ~/.hermes/config.yaml << '"'"'EOF'"'"'
providers:
  ollama:
    base_url: "http://localhost:11434/v1"
    api_key: "dummy"

  openai_direct:
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"

  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"

  openrouter:
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"

models:
  tier_0:
    model: "phi4-mini"
    provider: "ollama"
    max_tokens: 2048
    temperature: 0.1
    use_cases: [triage, formatting, parsing, classification]
    outbound_allowed: false
    enabled: true

  tier_1:
    primary:
      model: "gpt-4o-mini-2024-07-18"
      provider: "openai_direct"
      max_tokens: 4096
      temperature: 0.3
    fallback:
      model: "deepseek/deepseek-v3"
      provider: "openrouter"
      max_tokens: 4096
      temperature: 0.3
    use_cases: [research, task_planning, data_analysis, mid_complexity]
    outbound_allowed: false
    active_backend: "primary"

  tier_2:
    model: "claude-sonnet-4-6"
    provider: "anthropic"
    max_tokens: 8192
    temperature: 0.7
    use_cases: [outbound_writing, code_review, complex_analysis, reasoning]
    outbound_allowed: true
    requires_approval: true
    approval_channel: "corrections"

  tier_3:
    model: "claude-opus-4-8"
    provider: "anthropic"
    max_tokens: 16384
    temperature: 0.5
    use_cases: [orchestration, architecture, high_stakes_decisions]
    outbound_allowed: true
    requires_approval: true
    approval_channel: "corrections"

routing:
  quality_firewall:
    outbound_min_tier: 2
    require_approval: true
    approval_timeout_hours: 24
    approval_channel: "corrections"
  escalation:
    on_reasoning_failure: "bump_one_tier"
    on_tool_failure: "retry_same_once_then_bump"
    on_context_overflow: "summarize_then_retry"
    promote_permanently_after_days: 7
    promote_permanently_threshold: 0.30
  tier_1_watchdog:
    provider: "openai_direct"
    check_balance_daily: true
    switch_to_fallback_when_balance_below_usd: 50.0
    notify_channel: "alerts"

mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"

agent:
  yolo_mode: false
  require_approval_always: true
  allowed_discord_users:
    - "${DISCORD_ALLOWED_USER}"
  max_iterations: 90
  max_concurrent_tools: 8
  max_subagents: 3
  max_subagent_depth: 2

security:
  allowed_discord_users:
    - "${DISCORD_ALLOWED_USER}"
  require_approval_for_shell: true
  require_approval_for_outbound: true
  log_all_approvals: true
EOF
echo "Hermes config written:"
cat ~/.hermes/config.yaml | head -20
echo "..."
'
log "Hermes config.yaml OK"

# ============================================================
# P0.16 — Start GBrain HTTP server via PM2
# ============================================================
log "[P0.16] Starting GBrain MCP server via PM2..."
sudo -u dhruvaos bash -c '
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  set -a; source ~/.config/dhruvaos/.env 2>/dev/null || true; set +a
  pm2 delete gbrain-mcp 2>/dev/null || true
  # --host 127.0.0.1 binds loopback only; never expose GBrain to campus WiFi
  pm2 start "$HOME/.bun/bin/gbrain serve --http --port 3131 --host 127.0.0.1" --name gbrain-mcp
  sleep 3
  pm2 status gbrain-mcp
'
log "GBrain MCP started on port 3131"

# ============================================================
# P0.17 — Start Hermes via PM2
# ============================================================
log "[P0.17] Starting Hermes via PM2..."
sudo -u dhruvaos bash -c '
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  set -a; source ~/.config/dhruvaos/.env 2>/dev/null || true; set +a
  pm2 delete hermes 2>/dev/null || true
  # Try installed path first, fall back to source path
  if command -v hermes &>/dev/null; then
    pm2 start "hermes" --name hermes
  elif [ -f ~/.hermes-src/.venv/bin/python ]; then
    pm2 start "~/.hermes-src/.venv/bin/python ~/.hermes-src/run_agent.py" --name hermes
  else
    echo "WARN: Could not find hermes binary — check installation"
  fi
  pm2 list
'
log "Hermes started via PM2"

# PM2 startup: must execute the printed command to register with systemd
# Do this while dhruvaos still has sudo (before P0.18 removes it)
log "[P0.17b] Registering PM2 with systemd for boot persistence..."
PM2_STARTUP_CMD=$(sudo -u dhruvaos bash -c '
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  pm2 startup systemd -u dhruvaos --hp /home/dhruvaos 2>&1 | grep "sudo"
')
if [ -n "$PM2_STARTUP_CMD" ]; then
  log "Executing PM2 startup command: $PM2_STARTUP_CMD"
  eval "$PM2_STARTUP_CMD"
fi
sudo -u dhruvaos bash -c '
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  pm2 save
'
log "PM2 boot persistence registered"

# ============================================================
# P0.18 — Security hardening
# ============================================================
log "[P0.18] Applying security hardening..."

# UFW — deny all by default, allowlist required outbound ports only
sudo ufw default deny incoming
sudo ufw default deny outgoing    # allowlist-only outbound (ENVIRONMENT.md spec)
sudo ufw allow ssh
sudo ufw allow out to any port 443    # HTTPS (Anthropic, OpenAI, Discord, etc.)
sudo ufw allow out to any port 80     # HTTP (redirects)
sudo ufw allow out to any port 53     # DNS
sudo ufw allow in on lo               # allow all loopback traffic (GBrain, Ollama)
sudo ufw allow out on lo              # allow all loopback traffic
sudo ufw allow from 127.0.0.1 to any port 3131 comment "gbrain-mcp localhost only"
sudo ufw allow from 127.0.0.1 to any port 11434 comment "ollama localhost only"
sudo ufw --force enable
sudo ufw status verbose
log "UFW OK"

# Lid-close suspend prevention (laptop-critical — suspending mid-write corrupts GBrain)
log "[P0.18] Preventing lid-close suspend..."
sudo sed -i 's/#HandleLidSwitch=suspend/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=suspend/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
log "Lid-close suspend disabled"

# auditd for skill file monitoring
sudo bash -c 'cat >> /etc/audit/rules.d/dhruvaos.rules << EOF
# Monitor Hermes skill writes
-w /home/dhruvaos/.hermes/skills/ -p w -k hermes_skill_write
-w /home/dhruvaos/.config/dhruvaos/.env -p rwa -k env_access
-w /home/dhruvaos/.hermes/config.yaml -p wa -k hermes_config_change
EOF'
sudo systemctl restart auditd 2>/dev/null || warn "auditd restart failed — check manually"
log "auditd monitoring rules added"

# Dream cycle crontab + brain.db rolling backup
log "[P0.18] Installing dream cycle crontab and brain.db backup..."
sudo -u dhruvaos bash -c '
  # Append only if not already present (idempotent)
  CRON_EMBED="0 2 * * * /home/dhruvaos/.bun/bin/gbrain embed --stale"
  CRON_DREAM="0 3 * * * /home/dhruvaos/.bun/bin/gbrain dream || curl -s -d \"dream cycle FAILED\" ntfy.sh/dhruva-alerts"
  CRON_BACKUP="30 4 * * * cp /home/dhruvaos/.gbrain/brain.db /home/dhruvaos/.gbrain/brain.db.\$(date +\%Y\%m\%d) && find /home/dhruvaos/.gbrain/ -name brain.db.\\* -mtime +7 -delete"
  (crontab -l 2>/dev/null; echo "$CRON_EMBED") | sort -u | crontab -
  (crontab -l 2>/dev/null; echo "$CRON_DREAM") | sort -u | crontab -
  (crontab -l 2>/dev/null; echo "$CRON_BACKUP") | sort -u | crontab -
  echo "Crontab:"
  crontab -l
'
log "Dream cycle crontab and brain.db backup installed"

# Remove sudo from dhruvaos
log "Removing dhruvaos from sudo group..."
sudo deluser dhruvaos sudo
warn "dhruvaos now has NO sudo access. If you need to make system changes, use your admin user."

log "[P0.18] Security hardening complete"

# ============================================================
# Verification Gate: P0 → P1
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}[P0 DONE] Verification gate — checking all services...${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

PASS=0; FAIL=0

check() {
  if eval "$2" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $1"
    ((FAIL++))
  fi
}

check "dhruvaos user exists"              "id dhruvaos"
check "Python 3.11"                        "python3.11 --version"
check "Bun installed"                      "sudo -u dhruvaos ~/.bun/bin/bun --version"
check "Node v24 installed"                 "sudo -u dhruvaos bash -c 'source ~/.nvm/nvm.sh && node --version'"
check "PM2 installed"                      "sudo -u dhruvaos bash -c 'source ~/.nvm/nvm.sh && pm2 --version'"
check "Ollama service active"              "systemctl is-active ollama"
check "phi4-mini in ollama list"           "ollama list | grep phi4-mini"
check ".env exists and chmod 600"          "[ $(stat -c %a /home/dhruvaos/.config/dhruvaos/.env) = '600' ]"
check "GBrain config exists"              "[ -f /home/dhruvaos/.gbrain/config.json ]"
check "Hermes config exists"              "[ -f /home/dhruvaos/.hermes/config.yaml ]"
check "gbrain-mcp PM2 process online"     "sudo -u dhruvaos bash -c 'source ~/.nvm/nvm.sh && pm2 list | grep gbrain-mcp | grep online'"
check "hermes PM2 process online"         "sudo -u dhruvaos bash -c 'source ~/.nvm/nvm.sh && pm2 list | grep hermes | grep online'"
check "UFW active"                         "sudo ufw status | grep -q Status.*active"
check "dhruvaos not in sudo group"        "! groups dhruvaos | grep -q sudo"

echo ""
echo -e "${GREEN}Passed: $PASS${NC} | ${RED}Failed: $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}Phase 0 COMPLETE. Ready for Phase 1.${NC}"
  echo ""
  echo "Next: verify GBrain MCP connection"
  echo "  sudo -u dhruvaos hermes mcp test gbrain"
  echo ""
  echo "Then: send 'hello' in Discord #briefings"
else
  echo -e "${YELLOW}Some checks failed. Review output above and fix before Phase 1.${NC}"
fi
