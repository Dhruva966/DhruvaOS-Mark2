# DhruvaOS Mark 2 — Deployment

## Environments

| Environment | Host | Status |
|-------------|------|--------|
| Local (primary) | HP Omen 15 gaming laptop, Ubuntu | Current |
| VPS (future) | DigitalOcean/Fly.io | Migration-ready, not yet |

> **Current status (June 5, 2026):** Phase 1 complete. Services are documented as deployed,
> but remote SSH should be verified before relying on it. Keep live Tailscale/LAN addresses in
> a private ops note, not in committed docs.
> Health check: `ssh dhruva@<TAILSCALE_IP> 'bash -s' < scripts/health-check.sh`

---

## Environment Variables

Store all secrets in `~/.hermes/.env` (chmod 600).
Never commit this file.

```bash
# ~/.hermes/.env

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
# Safe source (no word-splitting injection risk):
set -a; source ~/.hermes/.env; set +a
# OR add to ~/.bashrc:
set -a; source ~/.hermes/.env; set +a
# Do NOT use: export $(grep -v '^#' .env | xargs) — vulnerable to value-splitting
```

---

## Infrastructure Diagram (Omen local)

```
HP Omen 15 gaming laptop (portable — always with Dhruva)
├── dhruva user (non-root)
│   ├── Hermes Agent (systemd user service)
│   │   └── connects to Discord via bot token
│   │   └── connects to GBrain via HTTP MCP (localhost:3131)
│   │   └── calls Ollama via localhost:11434
│   │   └── calls OpenAI/Anthropic/OpenRouter via HTTPS
│   │
│   ├── GBrain MCP server (pm2 process, HTTP mode port 3131)
│   │   └── serves HTTP MCP to Hermes (localhost:3131/mcp)
│   │   └── reads/writes ~/.gbrain/brain.pglite/ (PGLite)
│   │   └── reads/writes ~/brain/ (markdown)
│   │
│   └── ~/brain/ (markdown knowledge base)
│
├── Ollama (systemd service)
│   └── phi4-mini model
│   └── GTX 1660 Ti GPU via CUDA
│   └── port 11434 (localhost only)
│
├── Tailscale (systemd service) ← PRIMARY remote SSH
│   └── IP: keep in private ops note | authenticated June 5, 2026
│   └── Tailscale SSH enabled (no authorized_keys needed)
│
├── Cloudflare Tunnel (PM2 process, trycloudflare.com fallback)
│   └── URL: changes on restart (not permanent without domain)
│   └── Use Tailscale for SSH instead
│
└── AppArmor (complain mode) + UFW (deny-all + allowlist) + auditd
```

---

## Quick Start Runbook

Full setup from a fresh Ubuntu install. Follow in order.

### 1. OS Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3 python3-venv python3-dev \
  apparmor-utils apparmor-profiles-extra auditd ufw
```

### 2. Confirm current deploy user
```bash
whoami    # expect: dhruva
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
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
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
gbrain --version    # should be current 0.42.x
```

### 9. Brain + GBrain init
```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
mkdir -p ~/.gbrain
cat > ~/.gbrain/config.json << 'EOF'
{"engine":"pglite","search_mode":"balanced","embedding_provider":"ollama","embedding_model":"nomic-embed-text","query_expansion":false,"brain_path":"~/brain"}
EOF
ollama pull nomic-embed-text
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
touch ~/.hermes/.env
chmod 600 ~/.hermes/.env
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

### 13a. BlueBubbles (iMessage bridge — on Mac, not Omen)

**Verified: v1.9.9 (May 2025), macOS Sequoia compatible. SIP NOT required for text.**
Hermes has BlueBubbles as a first-class built-in gateway — no custom skill needed.

Run this on your Mac, not the Omen. Mac must have Messages.app signed into your iCloud.

```bash
# 1. Download BlueBubbles Server v1.9.9+ from https://bluebubbles.app/install
# 2. Install .dmg, launch BlueBubbles Server
# 3. System Settings → Privacy & Security:
#    - Full Disk Access → add BlueBubbles
#    - Automation → BlueBubbles → allow Messages
# 4. In BlueBubbles UI: set a password, note it for .env
# 5. Proxy: select "Cloudflare Tunnel" → configure custom domain
#    (Cloudflare tunnel binary is now bundled in BlueBubbles — no separate install)
# 6. Keep Mac awake:
sudo pmset -a sleep 0 disksleep 0

# 7. Verify BlueBubbles REST API responds:
curl "http://localhost:1234/api/v1/ping?password=YOUR_PASSWORD"
```

Add to `.env` on Omen:
```bash
BLUEBUBBLES_SERVER_URL=https://imessage.yourdomain.com
BLUEBUBBLES_PASSWORD=your-password
```

After Hermes is running on Omen:
```bash
hermes gateway setup   # auto-registers webhook, configures iMessage gateway
hermes gateway run
```

**Apple ID ban risk:** Low for personal single-user conversational use. Mitigations:
- Use a dedicated Apple ID (not your primary iCloud)
- Keep send/receive balanced — don't spam one-way
- Don't send auto-responses to strangers

**SIP note:** Leave SIP ENABLED. SIP only gates Private API (tapbacks, typing indicators) — irrelevant for DhruvaOS text commands.

### 12b. ntfy.sh push alerts — DEFERRED TO PHASE 4

ntfy setup is not a Phase 0 blocker. Discord is sufficient for all Phase 1-3 notifications.
Do this in Phase 4 when the dream cycle is running and silent failures actually matter.

**When you get there (Phase 4), use ntfy.sh cloud — zero install needed:**
```bash
# Pick a random topic string (acts as your password):
# e.g. dhruva-alerts-x7k3q9

# Test from Omen:
curl -d "Drew is alive" ntfy.sh/dhruva-alerts-YOURSTRING

# iPhone: install ntfy app (App Store) → subscribe to that topic
```

Self-hosted ntfy (private server on Omen) is optional and can be set up later.
See Phase 4 in BUILD_PLAN.md for full instructions.

### 14. Cloudflare Tunnel
```bash
# cloudflared (tunnel daemon) uses a separate repo from cloudflare-warp (VPN)
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
cloudflared tunnel login
cloudflared tunnel create dhruva
sudo cloudflared service install
sudo systemctl enable cloudflared && sudo systemctl start cloudflared
```

### 13b. Lid-close suspend prevention (critical — Omen is a laptop)

The Omen must not suspend when the lid closes, or all PM2 processes freeze mid-run.

```bash
# Prevent suspend on lid close
sudo sed -i 's/#HandleLidSwitch=suspend/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=suspend/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
# Verify:
grep HandleLidSwitch /etc/systemd/logind.conf
```

Also prevent automatic sleep/hibernate:
```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### 13c. Automated brain backup

PGLite is a single file. One power-loss during a dream cycle write = total memory loss.
Add a post-dream backup cron alongside the dream cycle cron:

```bash
crontab -e
# Add (as dhruva — actual deploy user):
0 2 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain embed --stale
# ntfy.sh cloud alert — set up NTFY_TOPIC in Phase 4 first (P4.0)
0 3 * * * flock -n /tmp/gbrain-write.lock sh -lc '/home/dhruva/.bun/bin/gbrain dream || curl -s -d "dream cycle FAILED" ntfy.sh/dhruva-alerts-YOURSTRING'
# Rolling 7-day backup — brain.pglite is a directory, use cp -r
30 4 * * * flock -n /tmp/gbrain-write.lock sh -lc 'cp -r /home/dhruva/.gbrain/brain.pglite /home/dhruva/.gbrain/brain.pglite.$(date +\%Y\%m\%d) && find /home/dhruva/.gbrain/ -maxdepth 1 -name "brain.pglite.*" -mtime +7 -exec rm -rf {} +'
```

The 4:30am step: keeps 7 rolling daily backups, deletes older ones. Zero external cost.

### 14. Security hardening (see ENVIRONMENT.md for full detail)
```bash
# Discord allowlist + disable YOLO (in ~/.hermes/config.yaml)
# AppArmor profile
# UFW rules
# auditd skill monitoring
```

### 15. Start services
```bash
set -a; source ~/.hermes/.env; set +a
# GBrain runs in HTTP mode — PM2 daemonizes it; Hermes connects on port 3131
pm2 start "/home/dhruva/.bun/bin/gbrain serve --http --port 3131 --host 127.0.0.1" --name gbrain-mcp
hermes gateway install
pm2 startup    # follow output command
pm2 save
```

### 16. Verify
```bash
pm2 list                              # gbrain-mcp online
systemctl --user status hermes-gateway
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
# 0 2 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain embed --stale
# 0 3 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain dream
```

---

## Debugging Guide

### Hermes not responding in Discord
```bash
journalctl --user -u hermes-gateway -n 100 --no-pager
systemctl --user restart hermes-gateway
# Common: env file missing from service override → verify EnvironmentFile=/home/dhruva/.hermes/.env
```

### GBrain MCP connection failed
```bash
pm2 logs gbrain-mcp --lines 50
gbrain serve    # run manually to see errors
# Common: bun not in PATH for pm2 → use full path: /home/dhruva/.bun/bin/gbrain
```

### phi4-mini not responding (Tier 0)
```bash
ollama list                    # verify phi4-mini is present
ollama run phi4-mini "test"    # test manually
systemctl status ollama        # check systemd service
nvidia-smi                     # verify GTX 1660 Ti detected
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
   cp -r ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.bak-$(date +%Y%m%d)
   tar -czf ~/brain-backup-$(date +%Y%m%d).tar.gz ~/brain/
   ```

2. **Provision VPS:** DigitalOcean basic droplet (2 vCPU, 4 GB RAM) — ~$24/month

3. **Transfer files:**
   ```bash
   scp brain-backup-*.tar.gz dhruva@<vps-ip>:~/
   scp -r ~/.gbrain/brain.pglite dhruva@<vps-ip>:~/.gbrain/
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
