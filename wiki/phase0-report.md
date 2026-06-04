# DhruvaOS Mark 2 — Phase 0 Execution Report

**Date:** June 2026  
**Status:** Phase 0 COMPLETE — Hermes alive, Discord connected, GBrain running

---

## What We Built

A 24/7 autonomous AI assistant ("Drew") running on an HP Omen 15 gaming laptop (Ubuntu).
Drew lives in Discord, can do web search, run code, edit files, and remember things across conversations.
All of this runs locally on the laptop — no cloud servers, no monthly hosting fees.

The three core pieces:
- **Hermes Agent** — the brain. Handles AI reasoning, tool calls, Discord messaging.
- **GBrain** — the memory. Stores everything Dhruva tells it. Gets smarter nightly.
- **Ollama + phi4-mini** — free local AI model for quick triage tasks.

---

## What Actually Happened (Full Journey)

### Attempt 1: WSL2 on Windows
The laptop came with Windows 11 pre-installed. We tried running Ubuntu inside Windows via WSL2 (a compatibility layer). Got partway through setup before deciding to wipe Windows and install native Ubuntu for better GPU support and cleaner systemd behavior.

**Lesson:** WSL2 works for development but native Ubuntu is better for 24/7 autonomous operation. GPU access, systemd services, and security hardening all work more cleanly on bare metal.

### Attempt 2: SD Card Boot — Failed
Tried to boot Ubuntu installer from a 32GB SD card. HP Omen 15's SD card reader uses a Realtek PCI controller — it shows up in the BIOS boot menu but the firmware silently refuses to execute boot code from it.

**Lesson:** HP Omen 15-dh1xxx cannot boot from the SD card slot. USB-A drive required.

### Attempt 3: Balena Etcher on Apple Silicon Mac — Unreliable
Tried to flash the Ubuntu ISO using Balena Etcher running via Rosetta 2 on an M-series Mac. The resulting drive had a valid-looking EFI directory but the partition GUIDs were slightly wrong, causing HP's UEFI to silently reject it.

**Lesson:** Use `dd` on Mac or Rufus on Windows. Never Balena Etcher on Apple Silicon for HP UEFI targets.

### Fix: Rufus on Windows + USB-A Drive
Downloaded Ubuntu 24.04.4 LTS ISO on the Omen (Windows), flashed to 64GB Memorex USB-A drive using Rufus (GPT + UEFI mode). Worked first try.

**Additional issue:** Secure Boot was blocking the Ubuntu bootloader. Had to disable Secure Boot in BIOS (F10 → Security) before Ubuntu would load.

**Display issue:** GTX 1660 Ti requires `nouveau.modeset=0` kernel parameter during live boot. At the GRUB menu, press `e`, find the `linux` line, add `nomodeset nouveau.modeset=0` before `---`, press F10 to boot.

### Ubuntu Install — First Attempt Failed (Power Cut)
Laptop battery died mid-install on first try. The USB drive got corrupted (rsync I/O errors on read). Reflashed with `dd` on Mac (more reliable than Rufus for this). Second install succeeded with internet connected during install.

### Phase 0 Install — What We Did

**On Ubuntu 24.04 as user `dhruva`** (no separate `dhruvaos` user — single-user laptop):

```
1. apt install: python3, bun, unzip, ripgrep, ffmpeg, jq, curl, git
2. bun 1.3.14
3. nvm → Node v24 → pm2
4. Ollama (systemd service) + phi4-mini + nomic-embed-text
5. Hermes Agent (official installer — chose Full Setup, Anthropic provider)
6. GBrain 0.42.25.0
7. ~/brain/ scaffold (9 dirs: people/companies/concepts/projects/daily/resources/UCLA/goals/charlie)
8. ~/.gbrain/config.json (balanced search, ollama:nomic-embed-text embedding)
9. gbrain init
10. ~/.hermes/config.yaml (4-tier routing, GBrain MCP at localhost:3131)
11. ~/.hermes/.env (API keys, Discord config)
12. GBrain via PM2: gbrain serve --http --port 3131
13. Hermes gateway via systemd: hermes gateway install
```

---

## Problems Hit and How We Fixed Them

### 1. Python 3.11 Not in Ubuntu 24.04 Repos
**Problem:** `apt install python3.11` fails — Ubuntu 24.04 ships Python 3.12, not 3.11.
**Fix:** Use `python3` / `python3-venv` / `python3-dev` (installs 3.12). Hermes requires 3.11+ — 3.12 works fine.

### 2. Bun Requires `unzip`
**Problem:** `curl -fsSL https://bun.sh/install | bash` fails with "unzip is required".
**Fix:** `sudo apt install unzip` first, then install Bun.

### 3. Bracketed Paste Mode in Terminal
**Problem:** Pasting commands in terminal prepends `^[[200~` to the start, breaking commands like `sudo python3 -c "..."`.
**Fix:** Run `printf '\e[?2004l'` to disable bracketed paste mode. Then paste freely.
**Alternative:** Type `sudo` manually, paste the rest.

### 4. GBrain Embedding Probe Timeout
**Problem:** `gbrain init` warns "embed probe timed out" for `ollama:nomic-embed-text`.
**Fix:** Pull the model first: `ollama pull nomic-embed-text`. The init still succeeds — the probe is just a health check.
**Config:** Use `"embedding_provider": "ollama", "embedding_model": "nomic-embed-text"` in `~/.gbrain/config.json` instead of `"embedding_provider": "zeroentropy"`.

### 5. PM2 Runs Hermes Shell Script as Node
**Problem:** `pm2 start hermes` fails with `SyntaxError: Unexpected identifier 'PYTHONPATH'` because PM2 tries to execute the `hermes` shell script as Node.js.
**Fix:** Use `--interpreter bash` flag: `pm2 start /path/to/hermes --interpreter bash`
**Better fix:** Don't use PM2 for Hermes. Use `hermes gateway install` which creates a proper systemd user service.

### 6. Hermes Gateway — "No Messaging Platforms Enabled"
**Problem:** Gateway starts but immediately exits. Logs show "No messaging platforms enabled" even though `DISCORD_BOT_TOKEN` is set in `~/.hermes/.env`.
**Root cause:** The systemd service file doesn't load `~/.hermes/.env` by default.
**Fix:**
```bash
systemctl --user edit hermes-gateway --force
# Add:
[Service]
EnvironmentFile=/home/dhruva/.hermes/.env
# Save, then:
systemctl --user daemon-reload && hermes gateway restart
```

### 7. Discord Bot Not Responding in Server Channels
**Problem:** Bot connects to Discord (visible in logs as "Connected as drew#4878") but ignores all messages in server channels.
**Two causes:**
- **Message Content Intent** not enabled in Discord Developer Portal. Go to discord.com/developers → your app → Bot → enable all three Privileged Gateway Intents.
- **DISCORD_REQUIRE_MENTION** defaults to `true` — bot only responds when @mentioned.
**Fix:** Add to `~/.hermes/.env`:
```
DISCORD_REQUIRE_MENTION=false
DISCORD_FREE_RESPONSE_CHANNELS=<channel-id>
DISCORD_HOME_CHANNEL=<briefings-channel-id>
PYTHONUNBUFFERED=1
```

### 8. Gateway Logs Not Showing in journalctl
**Problem:** `journalctl --user -u hermes-gateway` shows nothing from the Python process despite it running.
**Root cause:** Python stdout buffering under systemd (no TTY = 8KB buffer, only flushes on exit).
**Fix:** Add `PYTHONUNBUFFERED=1` to `~/.hermes/.env`. Real-time logs appear at `~/.hermes/logs/gateway.log`.

### 9. Drew Tried to Restart Itself — Crash Loop
**Problem:** User asked Drew to restart the gateway from Discord. Drew used its terminal tool to run `hermes gateway restart`, which the gateway blocks ("Refusing to restart gateway from inside the gateway process"). Got stuck in a timeout loop and crashed.
**Fix:** Never ask Drew to restart itself. Always restart from a terminal:
```bash
systemctl --user restart hermes-gateway
```

### 10. API Keys in Wrong Location
**Problem:** `~/.config/dhruvaos/.env` (where we initially put keys) is not read by Hermes gateway. Gateway reads `~/.hermes/.env`.
**Fix:** `cat ~/.config/dhruvaos/.env >> ~/.hermes/.env` to merge. Long-term: use `~/.hermes/.env` as the canonical secrets file.

---

## Current System State (Phase 0 Complete)

| Service | Status | How It Runs |
|---------|--------|------------|
| Hermes Gateway | Running | systemd user service (`hermes-gateway.service`) |
| GBrain MCP | Running | PM2 process (`gbrain-mcp`) |
| Ollama | Running | systemd system service |
| phi4-mini | Loaded | `ollama list` |
| nomic-embed-text | Loaded | `ollama list` |
| Discord connection | Connected | as `drew#4878` |

**Check all at once:**
```bash
systemctl --user status hermes-gateway --no-pager | grep Active
pm2 list
systemctl status ollama --no-pager | grep Active
```

### Key File Locations

| File | Purpose |
|------|---------|
| `~/.hermes/.env` | All API keys and gateway config — canonical secrets file |
| `~/.hermes/config.yaml` | Model routing, MCP servers, security settings |
| `~/.gbrain/config.json` | GBrain engine, search mode, embedding |
| `~/.gbrain/brain.pglite/` | GBrain database (PGLite) |
| `~/brain/` | Markdown knowledge base |
| `~/.hermes/logs/gateway.log` | Hermes real-time logs |
| `~/.config/systemd/user/hermes-gateway.service` | Systemd service file |
| `~/.config/systemd/user/hermes-gateway.service.d/override.conf` | EnvironmentFile override |

---

## Deviations from Original Plan

| Plan Said | What Actually Happened | Why |
|-----------|----------------------|-----|
| Create separate `dhruvaos` non-root user | Used `dhruva` (main user) | Single-user laptop, adds complexity for no security benefit |
| RTX 2060 (6GB) | GTX 1660 Ti (6GB) | Mis-identified GPU in planning; confirmed from `nvidia-smi` |
| Hermes via PM2 | Hermes via systemd user service | `hermes gateway install` creates a proper systemd service — better than PM2 for gateway |
| GBrain embedding: zeroentropy | Ollama: nomic-embed-text | zeroentropy not available locally; nomic-embed-text runs on GPU for free |
| AppArmor/UFW security hardening | Not yet done | Phase 0 scope was infrastructure only; security hardening is Phase 0.5 |
| `~/.config/dhruvaos/.env` for all keys | `~/.hermes/.env` is the canonical file | Hermes gateway reads from its own .env |

---

## What Drew Can and Can't Do (Important Rules)

**Drew CAN:**
- Edit `~/.hermes/config.yaml` and skill files
- Use web search, terminal, code execution, file read/write
- Remember things across conversations via GBrain
- Send messages to Discord channels
- Run skills autonomously

**Drew CANNOT:**
- Restart its own gateway process (triggers crash loop — always restart from terminal)
- Access `~/.config/dhruvaos/.env` (wrong file — use `~/.hermes/.env`)
- Bypass approval gates for shell commands or outbound messages

**To restart Drew from terminal:**
```bash
systemctl --user restart hermes-gateway
```

---

## Next Steps (Phase 1)

Phase 0 is complete. Drew is alive and responding in Discord.

Phase 1 goals:
1. Connect GBrain MCP to Hermes (verify `hermes mcp test gbrain`)
2. Import Obsidian vault into GBrain
3. Fill braindump questionnaire (`wiki/braindump-questions.md`)
4. Morning briefing stub fires at 8am
5. BlueBubbles iMessage bridge setup on Mac

Phase 1 done condition: Send "hello" in Discord #briefings → Drew responds using GBrain context.
