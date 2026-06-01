# DhruvaOS Mark 2 — Deployment

## Environments

| Environment | Host | Status |
|-------------|------|--------|
| Local (primary) | HP Omen 15, Ubuntu | Current |
| VPS (future) | DigitalOcean/Fly.io | Migration-ready, not yet |

---

## Environment Variables

Store all secrets in `~/.config/dhruvaos/.env` (chmod 600).
Never commit this file.

```bash
# ~/.config/dhruvaos/.env

# Required
OPENAI_API_KEY=sk-proj-...              # platform.openai.com (Tier 1)
ANTHROPIC_API_KEY=sk-ant-...           # Anthropic (Tier 2 + 3)
DISCORD_BOT_TOKEN=...                   # Discord bot token
DISCORD_ALLOWED_USER=...               # Your Discord user ID (developer mode)

# Optional (add when implementing those skills)
OPENROUTER_API_KEY=...                 # OpenRouter — Tier 1 fallback when OpenAI credits < $50
BROWSERBASE_API_KEY=...                # Cloud browser for Hermes
EXA_API_KEY=...                        # Web search
FIRECRAWL_API_KEY=...                  # Web extraction
GITHUB_TOKEN=...                       # GitHub (Phase 5)
```

### Getting your Discord user ID
1. Discord Settings → Advanced → Enable Developer Mode
2. Right-click your username → Copy User ID

### Loading env vars into shell
```bash
source ~/.config/dhruvaos/.env
# OR add to ~/.bashrc:
export $(grep -v '^#' ~/.config/dhruvaos/.env | xargs)
```

---

## Infrastructure Diagram (Omen local)

```
HP Omen 15 (Ubuntu)
├── dhruvaos user (non-root)
│   ├── Hermes Agent (pm2 process)
│   │   └── connects to Discord via bot token
│   │   └── connects to GBrain via MCP stdio
│   │   └── calls Ollama via localhost:11434
│   │   └── calls OpenAI/Anthropic/OpenRouter via HTTPS
│   │
│   ├── GBrain MCP server (pm2 process, HTTP mode port 3131)
│   │   └── serves HTTP MCP to Hermes (localhost:3131)
│   │   └── reads/writes ~/.gbrain/brain.db (PGLite)
│   │   └── reads/writes ~/brain/ (markdown)
│   │
│   └── ~/brain/ (markdown knowledge base)
│
├── Ollama (systemd service)
│   └── phi4-mini model
│   └── RTX 2060 GPU via CUDA
│   └── port 11434 (localhost only)
│
├── Cloudflare Tunnel (systemd service)
│   └── tunnels outbound to Cloudflare
│   └── optional: exposes GBrain HTTP interface
│
└── AppArmor + UFW + auditd (kernel-level security)
```

---

## Quick Start Runbook

Full setup from a fresh Ubuntu install. Follow in order.

### 1. OS Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3.11 python3.11-venv python3.11-dev \
  apparmor-utils apparmor-profiles-extra auditd ufw
```

### 2. Create dedicated user
```bash
sudo useradd -m -s /bin/bash dhruvaos
sudo usermod -aG sudo dhruvaos    # temporary — remove after setup completes
sudo su - dhruvaos
```
**After all setup steps complete**, remove sudo (run as admin user):
```bash
sudo deluser dhruvaos sudo
```

### 3. Python tooling
```bash
pip install uv
uv --version
```

### 4. Bun
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version    # must be ≥1.3.10
```

### 5. Node.js v24
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 24 && nvm use 24 && nvm alias default 24
npm install -g pm2
```

### 6. Ollama + phi4-mini
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull phi4-mini
# Test (expect response in ~2-3s):
ollama run phi4-mini "say: ready"
```

### 7. Hermes Agent
```bash
# Official installer — handles Python 3.11 venv, uv, Node.js, ripgrep, ffmpeg
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version    # verify
```

### 8. GBrain
```bash
bun install -g github:garrytan/gbrain
gbrain upgrade
gbrain --version    # should be ≥0.42.1.0
```

### 9. Brain + GBrain init
```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
mkdir -p ~/.gbrain
cat > ~/.gbrain/config.json << 'EOF'
{"engine":"pglite","search_mode":"balanced","embedding_provider":"zeroentropy","query_expansion":false,"brain_path":"~/brain"}
EOF
gbrain init                     # initializes PGLite schema
gbrain apply-migrations --yes   # apply any pending migrations
gbrain onboard --check --json   # verify all checks green
```

### 10. Hermes config
```bash
mkdir -p ~/.hermes
# Copy config from MODEL_ROUTING.md into ~/.hermes/config.yaml
# Fill in provider API keys (they read from .env)
```

### 11. API keys
```bash
mkdir -p ~/.config/dhruvaos
touch ~/.config/dhruvaos/.env
chmod 600 ~/.config/dhruvaos/.env
# Edit and fill in all required keys
```

### 12. Discord bot
1. Go to https://discord.com/developers/applications
2. New Application → name: "DhruvaOS"
3. Bot → Add Bot → copy token → add to `.env` as `DISCORD_BOT_TOKEN`
4. OAuth2 → URL Generator → scopes: `bot` → permissions: `Send Messages, Read Message History, Add Reactions`
5. Copy generated URL → open in browser → add bot to your server
6. Create 6 channels: `#briefings #tasks #research #alerts #charlie #corrections`
7. Enable Developer Mode in Discord settings
8. Right-click your username → Copy User ID → add to `.env` as `DISCORD_ALLOWED_USER`

### 13. Cloudflare Tunnel
```bash
curl -L https://pkg.cloudflare.com/cloudflare-warp-apt/KEY.asc \
  | sudo tee /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg >/dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] \
  https://pkg.cloudflare.com/cloudflare-warp $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflare-warp.list
sudo apt update && sudo apt install cloudflared
cloudflared tunnel login
cloudflared tunnel create dhruvaos
sudo cloudflared service install
sudo systemctl enable cloudflared && sudo systemctl start cloudflared
```

### 14. Security hardening (see ENVIRONMENT.md for full detail)
```bash
# Discord allowlist + disable YOLO (in ~/.hermes/config.yaml)
# AppArmor profile
# UFW rules
# auditd skill monitoring
```

### 15. Start services
```bash
source ~/.config/dhruvaos/.env
# GBrain runs in HTTP mode — PM2 daemonizes it; Hermes connects on port 3131
pm2 start "/home/dhruvaos/.bun/bin/gbrain serve --http --port 3131" --name gbrain-mcp
# Hermes uses venv python
pm2 start "~/.hermes-src/.venv/bin/python ~/.hermes-src/run_agent.py" --name hermes
pm2 startup    # follow output command
pm2 save
```

### 16. Verify
```bash
pm2 list                              # both processes online
gbrain onboard --check --json        # all green
ollama list                           # phi4-mini present
# Send "hello" in Discord #briefings → Hermes should respond
```

### 17. Obsidian vault import
```bash
gbrain import ~/path/to/obsidian-vault --no-embed
gbrain embed --stale
gbrain onboard --check --json
```

### 18. Install dream cycle cron
```bash
crontab -e
# Add:
# 0 2 * * * /home/dhruvaos/.bun/bin/gbrain embed --stale
# 0 3 * * * /home/dhruvaos/.bun/bin/gbrain dream
```

---

## Debugging Guide

### Hermes not responding in Discord
```bash
pm2 logs hermes --lines 100    # check for errors
pm2 restart hermes
# Common: .env not sourced → add `source ~/.config/dhruvaos/.env` before pm2 start
```

### GBrain MCP connection failed
```bash
pm2 logs gbrain-mcp --lines 50
gbrain serve    # run manually to see errors
# Common: bun not in PATH for pm2 → use full path: /home/dhruvaos/.bun/bin/gbrain
```

### phi4-mini not responding (Tier 0)
```bash
ollama list                    # verify phi4-mini is present
ollama run phi4-mini "test"    # test manually
systemctl status ollama        # check systemd service
nvidia-smi                     # verify RTX 2060 detected
```

### OpenAI API errors (Tier 1)
```bash
# 401 = wrong key → check OPENAI_API_KEY in .env
# 429 = rate limit → normal, Hermes retries
# Check balance: https://platform.openai.com/usage
```

### Anthropic API errors (Tier 2/3)
```bash
# 401 = wrong key → check ANTHROPIC_API_KEY in .env
# 529 = overloaded → Hermes retries with backoff
```

### GBrain embed slow/stuck
```bash
gbrain embed --stale --verbose    # see what's being embedded
# Takes ~1-2s per file on first run; subsequent runs are incremental
```

### Dream cycle errors
```bash
gbrain dream --dry-run    # simulate, check for errors
# Check crontab is using full paths for gbrain binary
```

---

## VPS Migration Runbook (when needed)

### When to migrate
- Omen is off more than 4 hours/day consistently
- Moving out of dorm and no stable internet at home
- Need 99.9% uptime for some reason

### Migration steps

1. **Snapshot brain:**
   ```bash
   cp ~/.gbrain/brain.db ~/.gbrain/brain.db.bak-$(date +%Y%m%d)
   tar -czf ~/brain-backup-$(date +%Y%m%d).tar.gz ~/brain/
   ```

2. **Provision VPS:** DigitalOcean basic droplet (2 vCPU, 4 GB RAM) — ~$24/month

3. **Transfer files:**
   ```bash
   scp brain-backup-*.tar.gz dhruvaos@<vps-ip>:~/
   scp ~/.gbrain/brain.db dhruvaos@<vps-ip>:~/.gbrain/
   ```

4. **Repeat install steps 1-18 on VPS** (skip Ollama — no GPU)

5. **Update config:** in `~/.hermes/config.yaml`:
   ```yaml
   models:
     tier_0:
       enabled: false    # no local model on VPS
   ```
   Set `tier_1` as primary starting tier.

6. **Update Cloudflare Tunnel** to point to VPS IP

7. **Cost delta:** +$24-40/month, lose free phi4-mini Tier 0
