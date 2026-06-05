# DhruvaOS Mark 2 — Environment Setup

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

## Install Commands (exact, verified)

Run as `dhruva` unless noted otherwise. This is the current single-user deployment on the Omen.

### 1. Confirm current deploy user
```bash
whoami    # expect: dhruva
```

### 2. Python 3.12 (Ubuntu 24.04 default)
```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-dev unzip
python3 --version    # verify — Ubuntu 24.04 ships 3.12, which satisfies Hermes's 3.11+ requirement
```
Note: `python3.11` is not in Ubuntu 24.04 repos. Use `python3` (3.12). Hermes requires 3.11+, not exactly 3.11.

### 3. Bun ≥1.3.10
```bash
sudo apt install unzip    # required by Bun installer — install first
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
```bash
bun install -g github:garrytan/gbrain
gbrain upgrade    # ensure latest (≥0.42.1.0)
gbrain --version
```

### 8. Scaffold brain repo + GBrain init
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
# macOS (development machine)
brew install lightpanda-io/browser/lightpanda

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
(research, monitoring) retry on next run. Critical skills fall back to Browserbase.

### 10. AgentQL (structured extraction — Phase 3+)

```bash
# Install in Hermes venv
source ~/.hermes-src/.venv/bin/activate
pip install agentql
```

API key required. Sign up at https://agentql.com (free tier: 50 calls/month, then $0.02/call).
Add `AGENTQL_API_KEY` to `.env` (see Environment Variables section).

### 11. Hermes config
```bash
mkdir -p ~/.hermes
# See MODEL_ROUTING.md for full config.yaml content
```

### 10. API keys file
```bash
touch ~/.hermes/.env
chmod 600 ~/.hermes/.env
# Edit and add required keys — see Environment Variables section
```

---

## Service Orchestration

### Service orchestration (actual, verified June 2026)

**GBrain:** runs via PM2 in HTTP mode.
**Hermes Gateway:** runs via systemd user service (NOT PM2). `hermes gateway install` sets this up.

```bash
# GBrain HTTP mode via PM2 (must be HTTP — stdio deadlocks under PM2)
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
pm2 start "$HOME/.bun/bin/gbrain serve --http --port 3131" --name gbrain-mcp
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
| Cloudflare Tunnel | systemd | See setup below |

---

## Cloudflare Tunnel (dorm CGNAT bypass)

University dorms use CGNAT — inbound connections impossible without tunneling.
Cloudflare Tunnel free tier is sufficient for solo personal use.

### Setup
```bash
# Install cloudflared
# cloudflared (tunnel) uses a separate repo from cloudflare-warp (VPN) — do not mix them
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Authenticate + create tunnel
cloudflared tunnel login
cloudflared tunnel create dhruva

# (Optional) expose GBrain HTTP interface externally
cloudflared tunnel route dns dhruva gbrain.yourdomain.com
```

### Boot persistence
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

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

**8. Systemd security hardening** (after migrating from PM2)

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

---

## VPS Migration Path (if/when)

When the Omen is unavailable or reliability requires cloud hosting:

| Service | VPS recommendation | Monthly cost |
|---------|-------------------|-------------|
| Hermes + GBrain | DigitalOcean basic droplet (2 vCPU, 4 GB RAM) | ~$24 |
| Ollama (Tier 0) | Not on VPS — too expensive; use Tier 1 directly | — |
| PostgreSQL | Managed DB or Docker on VPS | ~$15 |

**VPS migration steps:**
1. `gbrain export ~/brain-backup.tar.gz` — snapshot brain
2. Provision VPS, repeat install steps 1-7 (skip Ollama)
3. `gbrain import ~/brain-backup.tar.gz` on VPS
4. Update `~/.hermes/config.yaml`: remove `ollama` provider, set `tier_0` → disabled
5. Set `tier_1` as primary starting tier
6. Update Cloudflare Tunnel to point to VPS IP

**Cost impact:** +$24-40/month; lose local phi4-mini; Tier 1 becomes minimum tier.
Recommendation: migrate only if Omen reliability becomes a problem.
