# DhruvaOS Mark 2 — Environment Setup

## Host Machine

HP Omen 15 — Ubuntu, 32 GB RAM, RTX 2060 (6 GB VRAM)
Primary host: local, always-on. VPS-migration-ready (see VPS section).

---

## Runtime Matrix

| Component | Runtime | Required Version | Mode | Reason |
|-----------|---------|-----------------|------|--------|
| Hermes Agent | Python | 3.11+ | Native | GPU access, performance |
| GBrain | Bun | ≥1.3.10 | Native | Performance, direct FS |
| phi4-mini (Tier 0) | Ollama | Latest stable | Native + GPU | RTX 2060 inference |
| Node.js (tooling) | Node | v24 LTS | Native (nvm) | Hermes tooling deps |
| pm2 | Node | Latest | Native | Process management |
| Cloudflare Tunnel | Go binary (cloudflared) | Latest | Native (systemd) | Dorm CGNAT bypass |
| PostgreSQL | Docker | 16+ | Docker | Only if PGLite insufficient (>1000 files) |

**PGLite is default.** Do not set up PostgreSQL unless GBrain's `gbrain onboard --check` warns
about exceeding PGLite limits (currently <1000 brain files). PGLite is zero-ops and free.

---

## Install Commands (exact, verified)

Run as `dhruvaos` user unless noted otherwise.

### 1. Create dedicated user (run as your regular Ubuntu user)
```bash
sudo useradd -m -s /bin/bash dhruvaos
sudo usermod -aG sudo dhruvaos    # needed for initial setup only
sudo su - dhruvaos
```

### 2. Python 3.11+
```bash
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3.11-dev
pip install uv    # fast Python package manager
python3.11 --version    # verify ≥3.11
```

### 3. Bun ≥1.3.10
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc    # or restart shell
bun --version    # verify ≥1.3.10
```

### 4. Node v24 via nvm
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
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
# Ollama installs as systemd service, auto-starts, auto-detects RTX 2060
ollama pull phi4-mini
# Verify (expect ~2.5 GB VRAM, ~15-25 tok/s on RTX 2060):
ollama run phi4-mini "respond with: ok"
```

### 6. Hermes Agent
```bash
git clone https://github.com/NousResearch/hermes-agent ~/.hermes-src
cd ~/.hermes-src
uv pip install -e .
# Verify:
python -c "import hermes; print('ok')"
```

### 7. GBrain
```bash
bun install -g github:garrytan/gbrain
gbrain upgrade    # ensure latest (≥0.42.1.0)
gbrain --version
```

### 8. Scaffold brain repo + GBrain config
```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}

mkdir -p ~/.gbrain
cat > ~/.gbrain/config.json << 'EOF'
{
  "engine": "pglite",
  "search_mode": "balanced",
  "embedding_provider": "zeroentropy",
  "query_expansion": false,
  "brain_path": "~/brain"
}
EOF
```

### 9. Hermes config
```bash
mkdir -p ~/.hermes
# See MODEL_ROUTING.md for full config.yaml content
```

### 10. API keys file
```bash
mkdir -p ~/.config/dhruvaos
touch ~/.config/dhruvaos/.env
chmod 600 ~/.config/dhruvaos/.env
# Edit and add required keys — see Environment Variables section
```

---

## Service Orchestration

### PM2 process list (initial setup)
```bash
# Start GBrain MCP server (stdio mode — Hermes connects directly)
pm2 start "gbrain serve" --name gbrain-mcp --interpreter none

# Start Hermes
pm2 start "python ~/.hermes-src/run_agent.py" --name hermes --interpreter none

# Persist across reboots
pm2 startup    # follow the output command (usually: sudo env PATH=... pm2 startup)
pm2 save
```

### Check status
```bash
pm2 list
pm2 logs hermes --lines 50
pm2 logs gbrain-mcp --lines 20
```

### Restart after config change
```bash
pm2 restart hermes
pm2 restart gbrain-mcp
```

---

## Boot Persistence

| Service | Managed By | Notes |
|---------|-----------|-------|
| Ollama | systemd (auto-installed) | `systemctl status ollama` |
| GBrain MCP | PM2 (via `pm2 startup`) | `pm2 list` |
| Hermes | PM2 (via `pm2 startup`) | `pm2 list` |
| Cloudflare Tunnel | systemd | See setup below |

---

## Cloudflare Tunnel (dorm CGNAT bypass)

University dorms use CGNAT — inbound connections impossible without tunneling.
Cloudflare Tunnel free tier is sufficient for solo personal use.

### Setup
```bash
# Install cloudflared
curl -L https://pkg.cloudflare.com/cloudflare-warp-apt/KEY.asc \
  | sudo tee /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg >/dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] \
  https://pkg.cloudflare.com/cloudflare-warp $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflare-warp.list
sudo apt update && sudo apt install cloudflared

# Authenticate + create tunnel
cloudflared tunnel login
cloudflared tunnel create dhruvaos

# (Optional) expose GBrain HTTP interface externally
cloudflared tunnel route dns dhruvaos gbrain.yourdomain.com
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

### Critical (implement before first API key use)

**1. Non-root user** (already done in install step 1)
```bash
# Hermes must run as dhruvaos, never root
id    # should show: uid=1001(dhruvaos)
```

**2. API keys file permissions**
```bash
chmod 600 ~/.config/dhruvaos/.env
ls -la ~/.config/dhruvaos/.env    # should show: -rw------- dhruvaos
# Add to .gitignore (from project root):
echo ".env" >> .gitignore
echo "*.env" >> .gitignore
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
# Profile at /etc/apparmor.d/dhruvaos_hermes:
```
```apparmor
#include <tunables/global>
/usr/bin/python3.11 {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  /home/dhruvaos/** rwk,
  /tmp/** rwk,
  deny /etc/passwd r,
  deny /etc/shadow r,
  deny /root/** rwx,
  /proc/self/fd/ r,
}
```
```bash
sudo apparmor_parser -r /etc/apparmor.d/dhruvaos_hermes
sudo aa-enforce /etc/apparmor.d/dhruvaos_hermes
```

**6. UFW firewall (outbound allow-list)**
```bash
sudo ufw default deny outgoing
sudo ufw default deny incoming
sudo ufw allow out to any port 443      # HTTPS (APIs)
sudo ufw allow out to any port 80       # HTTP (redirects)
sudo ufw allow out to any port 53       # DNS
sudo ufw allow in from 127.0.0.1        # localhost
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
# ~/.config/systemd/user/hermes.service
[Unit]
Description=DhruvaOS Hermes Agent
After=network.target

[Service]
ExecStart=/usr/bin/python3.11 /home/dhruvaos/.hermes-src/run_agent.py
EnvironmentFile=/home/dhruvaos/.config/dhruvaos/.env
User=dhruvaos
Group=dhruvaos
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
