# DhruvaOS Mark 2 — Deployment & Environment

## Environments

| Environment | Host | Status |
|-------------|------|--------|
| Local (primary) | HP Omen 15 gaming laptop, Ubuntu | Current |
| VPS (future) | DigitalOcean/Fly.io | Migration-ready, not yet |

> **Current status (June 8, 2026):** Phases 1–4 complete. GBrain running from `~/gbrain-src/` source (global install broken — see GBrain install note below). Model: `gemini-3.1-flash-lite` (Anthropic credits depleted; switch back when refilled). Health monitor cron deployed (hourly, no-agent). Autopilot disabled.
> Health check: `ssh dhruva@<TAILSCALE_IP> 'bash -s' < scripts/health-check.sh`

---

## Host Machine

HP Omen 15-dh1xxx — Ubuntu 24.04.4 LTS, 32 GB RAM, GTX 1660 Ti (6 GB VRAM)
CPU: Intel Core i7-10750H @ 2.60GHz
Portable gaming laptop — always with Dhruva. Not a stationary server.
VPS-migration-ready (see VPS section) but not needed while laptop is accessible.

### Ubuntu Install Notes (verified June 2026)

- **SD card boot:** HP Omen 15-dh1xxx SD slot (Realtek PCI) appears in BIOS boot menu but silently fails to execute. Use USB-A drive only.
- **Flash tool:** Use Rufus (Windows) or `dd` (Mac). Balena Etcher on Apple Silicon Mac produces malformed EFI partitions that HP UEFI rejects.
- **Secure Boot:** Must be disabled in BIOS (F10 → Security → Secure Boot → Disable) before Ubuntu boots.
- **Display during live boot:** GTX 1660 Ti requires kernel params at GRUB. Press `e` on boot menu, find `linux` line, add `nomodeset nouveau.modeset=0` before `---`.
- **Third-party software:** Check "Install third-party software" during Ubuntu install — this auto-installs the NVIDIA 595 driver + CUDA 13.2.
- **Bracketed paste mode:** Terminal prepends `^[[200~` to pasted commands. Fix: `printf '\e[?2004l'`
- **PYTHONUNBUFFERED=1 required:** Without it, Python stdout buffers under systemd; `journalctl --user -u hermes-gateway` shows nothing. Add to `~/.hermes/.env`.
- **Power-cut during install** corrupts USB — Reflash with `dd` (more reliable than Rufus for recovery) and keep laptop plugged in during install.

---

## Runtime Matrix

| Component | Runtime | Required Version | Mode | Reason |
|-----------|---------|-----------------|------|--------|
| Hermes Agent | Python | 3.11+ | Native | GPU access, performance |
| GBrain | Bun | ≥1.3.10 | Native | Performance, direct FS |
| phi4-mini (Tier 0) | Ollama | Latest stable | Native + GPU | GTX 1660 Ti inference |
| Node.js (tooling) | Node | v24 LTS | Native (nvm) | Hermes tooling deps |
| pm2 | Node | Latest | Native | Process management |
| Cloudflare Tunnel | Go binary (cloudflared) | Latest | Native (systemd) | Dorm CGNAT bypass |
| PostgreSQL | Docker | 16+ | Docker | Only if PGLite insufficient (>1000 files) |

**PGLite is default.** Do not set up PostgreSQL unless GBrain's `gbrain onboard --check` warns
about exceeding PGLite limits (currently <1000 brain files). PGLite is zero-ops and free.

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
PYTHONUNBUFFERED=1                      # Required — prevents stdout buffering under systemd

# Optional (add when implementing those skills)
OPENROUTER_API_KEY=...                 # OpenRouter — Tier 1 fallback when OpenAI credits < $50
GOOGLE_API_KEY=...                     # Google AI — gemini-3.1-flash-lite fallback (Anthropic credits depleted)
EXA_API_KEY=...                        # Web search
GITHUB_TOKEN=...                       # GitHub (Phase 5)
AGENTQL_API_KEY=...                    # AgentQL structured extraction (Phase 3+)
BLUEBUBBLES_SERVER_URL=...             # BlueBubbles iMessage bridge (Mac)
BLUEBUBBLES_PASSWORD=...               # BlueBubbles server password
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

### 1. Confirm current deploy user
```bash
whoami    # expect: dhruva
```

### 2. OS Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3 python3-venv python3-dev unzip \
  apparmor-utils apparmor-profiles-extra auditd ufw
python3 --version    # verify — Ubuntu 24.04 ships 3.12, which satisfies Hermes's 3.11+ requirement
```
Note: `python3.11` is not in Ubuntu 24.04 repos. Use `python3` (3.12). Hermes requires 3.11+, not exactly 3.11.

### 3. Bun ≥1.3.10
```bash
sudo apt install unzip    # required by Bun installer — install first if not already
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc    # or restart shell
bun --version    # verify ≥1.3.10
```

### 4. Node v24 via nvm
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24
node --version    # verify v24.x
npm install -g pm2
```

### 5. Ollama + phi4-mini
```bash
curl -fsSL https://ollama.com/install.sh | sh
# Ollama installs as systemd service, auto-starts, auto-detects GTX 1660 Ti
ollama pull phi4-mini
# Verify (expect ~2.5 GB VRAM, ~15-25 tok/s on GTX 1660 Ti):
ollama run phi4-mini "respond with: ok"
```

### 6. Hermes Agent
The official installer handles Python 3.11, venv creation, uv, Node.js, ripgrep, and ffmpeg:
```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc    # reload PATH
hermes --version    # verify install
```

If the one-liner fails or you need a pinned version, manual path:
```bash
git clone https://github.com/NousResearch/hermes-agent ~/.hermes-src
cd ~/.hermes-src
# Installer creates venv automatically; if not:
python3 -m venv .venv && source .venv/bin/activate
uv sync    # preferred (uses uv.lock for determinism)
# or: uv pip install -e ".[all]"
```

### 7. GBrain
**Install from source — do NOT use `bun install -g github:garrytan/gbrain`.** The global install causes bun to resolve PGLite 0.5.1 from its cache instead of 0.4.3 from GBrain's lockfile. PGLite 0.5.1 cannot open existing pgvector databases and crashes with `Aborted()`.

```bash
git clone https://github.com/garrytan/gbrain ~/gbrain-src
cd ~/gbrain-src
bun install    # installs PGLite 0.4.3 + vector ext from local node_modules
# Verify:
bun src/cli.ts --version    # should print ≥0.42.36.0
```

Set PATH alias for convenience (optional — all scripts should use full paths):
```bash
alias gbrain="cd ~/gbrain-src && bun src/cli.ts"
```

**Autopilot must be disabled to prevent auto-upgrades breaking the install:**
```bash
cd ~/gbrain-src && bun src/cli.ts config set autopilot.self_upgrade.enabled false
```

**Bi-weekly manual update procedure:**
```bash
cd ~/gbrain-src && git pull && bun install && pm2 restart gbrain-mcp
cd ~/gbrain-src && bun src/cli.ts onboard --check --json    # verify health after upgrade
```

### 8. Brain repo + GBrain init
```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
mkdir -p ~/.gbrain

# Pull embedding model FIRST (GBrain probes it during init)
ollama pull nomic-embed-text

# Write config BEFORE gbrain init — init reads config to pick the correct engine
python3 -c "
import json
config = {
  'engine': 'pglite',
  'search_mode': 'balanced',
  'embedding_provider': 'ollama',
  'embedding_model': 'nomic-embed-text',
  'query_expansion': False,
  'brain_path': '/home/dhruva/brain'
}
open('/home/dhruva/.gbrain/config.json', 'w').write(json.dumps(config))
print('done')
"

gbrain init                     # initialize PGLite schema (reads config.json)
gbrain apply-migrations --yes   # apply pending schema migrations (idempotent)
gbrain onboard --check --json   # verify all checks green
```
Note: Use `ollama:nomic-embed-text` not `zeroentropy` — zeroentropy requires a cloud key. nomic-embed-text runs free on GPU via Ollama.

Note: Use `python3 -c` to write config instead of heredoc (`cat << EOF`) — heredoc breaks in terminals with bracketed paste mode enabled.

### 9. Lightpanda (local browser — Phase 3+)

Lightpanda is natively supported by Hermes Agent. Install once; Hermes manages the CDP connection.

```bash
# Ubuntu/Omen (production) — download prebuilt binary (glibc, works on Ubuntu)
curl -LO https://github.com/lightpanda-io/browser/releases/latest/download/lightpanda-x86_64-linux
chmod +x lightpanda-x86_64-linux
sudo mv lightpanda-x86_64-linux /usr/local/bin/lightpanda
lightpanda --version

# Start under PM2:
pm2 start "lightpanda --host 127.0.0.1 --port 9222" --name lightpanda
pm2 save
```

**Beta stability note:** Lightpanda may crash on sites with complex JS. Non-critical skills
(research, monitoring) retry on next run. Critical Phase 5 outbound skills use local Playwright
(Chromium) — Browserbase was permanently dropped 2026-06-07.

### 10. AgentQL (structured extraction — Phase 3+)

```bash
# Install in Hermes venv
source ~/.hermes-src/.venv/bin/activate
pip install agentql
```

API key required. Sign up at https://agentql.com (free tier: 50 calls/month, then $0.02/call).
Add `AGENTQL_API_KEY` to `.env`.

### 11. Hermes config
```bash
mkdir -p ~/.hermes
# Copy config from MODEL_ROUTING.md into ~/.hermes/config.yaml
# Fill in provider API keys (they read from .env)
```

### 12. API keys file
```bash
touch ~/.hermes/.env
chmod 600 ~/.hermes/.env
# Edit and fill in all required keys — see Environment Variables section above
```

### 13. Discord bot
1. Go to https://discord.com/developers/applications
2. New Application → name: "DhruvaOS"
3. Bot → Add Bot → copy token → add to `.env` as `DISCORD_BOT_TOKEN`
4. OAuth2 → URL Generator → scopes: `bot` → permissions: `Send Messages, Read Message History, Add Reactions`
5. Copy generated URL → open in browser → add bot to your server
6. Create 6 channels: `#briefings #tasks #research #alerts #charlie #corrections`
7. Enable Developer Mode in Discord settings
8. Right-click your username → Copy User ID → add to `.env` as `DISCORD_ALLOWED_USER`

### 14. BlueBubbles (iMessage bridge — on Mac, not Omen)

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

### 15. Lid-close suspend prevention (critical — Omen is a laptop)

The Omen must not suspend when the lid closes, or all PM2 processes freeze mid-run.

```bash
# Prevent suspend on lid close
sudo sed -i 's/#HandleLidSwitch=suspend/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=suspend/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### 16. Cloudflare Tunnel
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

# Do NOT expose GBrain MCP. It has no auth and must stay bound to 127.0.0.1.
# Cloudflare Tunnel is only for future authenticated HTTP surfaces, never :3131.

sudo cloudflared service install
sudo systemctl enable cloudflared && sudo systemctl start cloudflared
```

### 17. Security hardening
See the full Security Hardening Checklist section below — implement before first API key use.

### 18. Start services
```bash
set -a; source ~/.hermes/.env; set +a
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
# GBrain: must use --cwd so bun resolves local node_modules (PGLite 0.4.3 + vector ext)
pm2 start bun --name gbrain-mcp -- src/cli.ts serve --http --port 3131 --enable-dcr --token-ttl 7776000 --cwd /home/dhruva/gbrain-src
hermes gateway install
pm2 startup    # follow output command
pm2 save
```

### 19. Verify
```bash
pm2 list                              # gbrain-mcp online
systemctl --user status hermes-gateway
gbrain onboard --check --json        # all green
ollama list                           # phi4-mini present
# Send "hello" in Discord #briefings → Hermes should respond
```

### 20. Obsidian vault import
```bash
gbrain import ~/path/to/obsidian-vault --no-embed
gbrain embed --stale
gbrain onboard --check --json
```

### 21. Install dream cycle cron
Dream and embed run via Hermes cron scripts that stop PM2, run the operation, then restart PM2 (required because PM2 holds the PGLite exclusive write lock).

Scripts: `~/.hermes/scripts/gbrain-embed.sh` and `~/.hermes/scripts/gbrain-dream.sh` (already deployed).

Register in Hermes:
```bash
# Embed: 2am nightly
hermes cron create '0 2 * * *' --name 'GBrain Embed' --script gbrain-embed.sh --no-agent
# Dream: 3am nightly
hermes cron create '0 3 * * *' --name 'GBrain Dream' --script gbrain-dream.sh --no-agent
```

Do NOT use `crontab -e` with direct `gbrain` binary invocations — PM2 holds the PGLite lock and the CLI will Abort().

### 22. Automated brain backup

PGLite is a single file. One power-loss during a dream cycle write = total memory loss.
Add a post-dream backup cron:

```bash
crontab -e
# Add (as dhruva — actual deploy user):
# Rolling 7-day backup — brain.pglite is a directory, use cp -r
30 4 * * * flock -n ~/.gbrain/gbrain-write.lock sh -lc 'cp -r /home/dhruva/.gbrain/brain.pglite /home/dhruva/.gbrain/brain.pglite.$(date +\%Y\%m\%d) && find /home/dhruva/.gbrain/ -maxdepth 1 -name "brain.pglite.*" -mtime +7 -exec rm -rf {} +'
```

The 4:30am step: keeps 7 rolling daily backups, deletes older ones. Zero external cost.

---

## Service Orchestration

**GBrain:** runs via PM2 in HTTP mode **from `~/gbrain-src/`** so bun resolves local node_modules (PGLite 0.4.3 + vector ext). Do NOT use the global binary.
**Hermes Gateway:** runs via systemd user service (NOT PM2). `hermes gateway install` sets this up.

```bash
# GBrain HTTP mode via PM2 — must use --cwd so bun resolves local node_modules
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
pm2 start bun --name gbrain-mcp -- src/cli.ts serve --http --port 3131 --enable-dcr --token-ttl 7776000 --cwd /home/dhruva/gbrain-src
pm2 startup && pm2 save

# Hermes Gateway via systemd (do NOT use PM2 for Hermes)
set -a; source ~/.hermes/.env; set +a
hermes gateway install    # interactive: select "start on boot: Y", "start now: Y"
# This creates: ~/.config/systemd/user/hermes-gateway.service
```

**Critical:** The systemd service does not load `~/.hermes/.env` by default. Add this override:
```bash
systemctl --user edit hermes-gateway --force
# Add these lines and save:
# [Service]
# EnvironmentFile=/home/dhruva/.hermes/.env
systemctl --user daemon-reload && hermes gateway restart
```

**Why not PM2 for Hermes:** PM2 treats the `hermes` binary as a Node.js script (it's actually a shell script that activates a Python venv). Results in `SyntaxError: Unexpected identifier 'PYTHONPATH'`. The `--interpreter bash` flag works but is fragile. `hermes gateway install` → systemd is the correct path.

In `~/.hermes/config.yaml`, point Hermes at the HTTP GBrain endpoint.
Key is `mcp_servers:` (verified from Hermes cli-config.yaml.example):
```yaml
mcp_servers:
  gbrain:
    url: "http://localhost:3131/mcp"
```

Verify connection after Hermes starts:
```bash
hermes mcp list          # shows registered MCP servers
hermes mcp test gbrain   # confirms tools discovered
```

### Check status
```bash
pm2 list
systemctl --user status hermes-gateway
pm2 logs gbrain-mcp --lines 20
```

### Restart after config change
```bash
systemctl --user restart hermes-gateway
pm2 restart gbrain-mcp
```

---

## Boot Persistence

| Service | Managed By | Notes |
|---------|-----------|-------|
| Ollama | systemd (auto-installed) | `systemctl status ollama` |
| GBrain MCP | PM2 (via `pm2 startup`) | `pm2 list` |
| Hermes | systemd user service | `systemctl --user status hermes-gateway` |
| Cloudflare Tunnel | systemd | See Cloudflare Tunnel section above |

---

## Security Hardening Checklist

Implement in this order. Phase 0 of BUILD_PLAN.md requires all items complete before
any external API key is used.

### Pre-critical (implement before everything else — laptop-specific)

**0. Lid-close suspend prevention**

The Omen is a laptop. Without this, closing the lid suspends all PM2 processes mid-run.

```bash
sudo sed -i 's/#HandleLidSwitch=suspend/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo sed -i 's/#HandleLidSwitchExternalPower=suspend/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

---

### Critical (implement before first API key use)

**1. Non-root user** (already done in install step 1)
```bash
# Hermes must run as dhruva, never root
id    # should show the dhruva user, never root
```

**2. API keys file permissions**
```bash
chmod 600 ~/.hermes/.env
ls -la ~/.hermes/.env    # should show: -rw-------
# .gitignore already committed in the repo — covers .env, *.env, legacy brain.db, and brain.pglite/
```

**3. Discord allowlist in Hermes config**
```yaml
# ~/.hermes/config.yaml
security:
  allowed_discord_users:
    - "YOUR_DISCORD_USER_ID_HERE"   # get from Discord: Settings > Advanced > Developer Mode
  require_approval_always: true    # YOLO mode = always off
```

**4. Disable YOLO mode**
```yaml
# ~/.hermes/config.yaml
agent:
  yolo_mode: false
  require_approval_always: true
```

### High priority (implement within first week)

**5. AppArmor profile for Hermes**
```bash
sudo apt install apparmor-utils
# Profile at /etc/apparmor.d/dhruva_hermes:
```
```apparmor
#include <tunables/global>
# Profile must target the actual venv binary, not the system python
/home/dhruva/.hermes-src/.venv/bin/python3.12 {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  /home/dhruva/** rwk,
  /tmp/** rwk,
  deny /etc/passwd r,
  deny /etc/shadow r,
  deny /root/** rwx,
  /proc/self/fd/ r,
}
```
After loading: `sudo aa-status | grep python` to confirm the process is confined (not just the profile loaded).
```bash
sudo apparmor_parser -r /etc/apparmor.d/dhruva_hermes
sudo aa-enforce /etc/apparmor.d/dhruva_hermes
```

**6. UFW firewall (outbound allow-list)**
```bash
sudo ufw default deny outgoing
sudo ufw default deny incoming
sudo ufw allow out to any port 443      # HTTPS (APIs)
sudo ufw allow out to any port 80       # HTTP (redirects)
sudo ufw allow out to any port 53       # DNS
sudo ufw allow in on lo                 # loopback (GBrain, Ollama)
sudo ufw allow out on lo                # loopback
sudo ufw enable
```

**7. Audit skill changes**
```bash
sudo apt install auditd
sudo auditctl -w ~/.hermes/skills/ -p wa -k hermes_skill_changes
sudo auditctl -w ~/.hermes/config.yaml -p wa -k hermes_config_changes
sudo systemctl enable auditd && sudo systemctl start auditd
```

### Medium priority (within one month)

**8. Systemd security hardening**

```ini
# ~/.config/systemd/user/hermes-gateway.service.d/override.conf
[Unit]
Description=DhruvaOS Hermes Agent
After=network.target

[Service]
EnvironmentFile=/home/dhruva/.hermes/.env
ProtectSystem=strict
ProtectHome=read-only
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
RestrictRealtime=yes
MemoryMax=4G
CPUQuota=60%
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

---

## Version Conflict Notes

| Potential Conflict | Status | Resolution |
|-------------------|--------|-----------|
| Bun vs Node.js PATH | None | Bun installs to `~/.bun/bin`, Node to `~/.nvm/versions/...`; no conflict |
| Python 3.11 vs system Python | Possible | Use `python3.11` explicitly; never alias `python` globally |
| Ollama port 11434 | Reserved | Ollama owns port 11434; no other service on that port |
| GBrain PGLite file lock | Possible | Only one `gbrain serve` process at a time; PM2 ensures single instance |
| Bun global cache PGLite version | **Critical** | `bun install -g github:garrytan/gbrain` resolves PGLite 0.5.1 from global cache; 0.5.1 breaks pgvector databases. Always run from `~/gbrain-src/` with local node_modules. |
| WASM ASLR (kernel 6.17+) | Fixed | Kernel 6.17.0 sets `vm.mmap_rnd_bits=32` which blocks WASM 4GB linear memory. Fixed permanently via `/etc/sysctl.d/99-wasm-compat.conf` (`vm.mmap_rnd_bits=28`). |

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
# Run manually to see errors (must cd to source dir first):
cd ~/gbrain-src && bun src/cli.ts serve --http --port 3131
# Common issues:
# - Aborted() WASM crash → check vm.mmap_rnd_bits: sysctl vm.mmap_rnd_bits (must be 28)
# - PGLite version mismatch → confirm running from ~/gbrain-src/ not global bun bin
# - PM2 not running from --cwd → check: pm2 info gbrain-mcp | grep cwd
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

### GBrain debug commands
```bash
# Health check
gbrain onboard --check --json

# Manual embed + dream (use only when PM2 is stopped — PM2 holds PGLite write lock)
pm2 stop gbrain-mcp
cd ~/gbrain-src && bun src/cli.ts embed --stale
cd ~/gbrain-src && bun src/cli.ts dream
pm2 start gbrain-mcp

# Search test
gbrain search "test query"

# Check database integrity
gbrain onboard --check --json
```

---

## VPS Migration Runbook (when needed)

### When to migrate
- Omen is off more than 4 hours/day consistently
- Moving out of dorm and no stable internet at home
- Need 99.9% uptime for some reason

### VPS cost reference

| Service | VPS recommendation | Monthly cost |
|---------|-------------------|-------------|
| Hermes + GBrain | DigitalOcean basic droplet (2 vCPU, 4 GB RAM) | ~$24 |
| Ollama (Tier 0) | Not on VPS — too expensive; use Tier 1 directly | — |
| PostgreSQL | Managed DB or Docker on VPS | ~$15 |

**Cost impact:** +$24-40/month; lose local phi4-mini; Tier 1 becomes minimum tier.
Recommendation: migrate only if Omen reliability becomes a problem.

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

4. **Repeat install steps 1-22 on VPS** (skip Ollama — no GPU)

5. **Update config:** in `~/.hermes/config.yaml`:
   ```yaml
   models:
     tier_0:
       enabled: false    # no local model on VPS
   ```
   Set `tier_1` as primary starting tier.

6. **Update Cloudflare Tunnel** to point to VPS IP

7. **Cost delta:** +$24-40/month, lose free phi4-mini Tier 0
