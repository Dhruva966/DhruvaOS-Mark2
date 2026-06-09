# DhruvaOS Mark 2 — Disaster Recovery

## GBrain PGLite Corruption

**Symptom:** `gbrain doctor` returns errors, search/embed fail with "Aborted()" WASM error,
or `gbrain onboard --check --json` shows critical issues.

**Step 1 — Stop Hermes to release any active DB connections:**
```bash
systemctl --user stop hermes-gateway
pm2 stop gbrain-mcp
```

**Step 2 — Back up the corrupted DB:**
```bash
cp -r ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.corrupted.$(date +%Y%m%d)
```

**Step 3 — Restore from most recent rolling backup:**
```bash
# List available backups (most recent first)
ls -lt ~/.gbrain/brain.pglite.* | grep -v corrupted | head -5

# Restore the most recent good backup
cp -r ~/.gbrain/brain.pglite.20XXXXXX ~/.gbrain/brain.pglite

# Verify
export PATH="/home/dhruva/.bun/bin:$PATH"
gbrain doctor --json | jq '.score'
# Should return a number > 0
```

**Step 3b — Verify backup integrity before restoring:**
```bash
# Check backup is not from a mid-write snapshot (WAL file should be same mtime as data)
ls -la ~/.gbrain/brain.pglite.$(date +%Y%m%d)/
# If WAL file is newer than data files by >60s, the backup may be inconsistent — use older one
ls -lt ~/.gbrain/brain.pglite.*/pg_wal/ 2>/dev/null | head -5
```

**Step 4 — If all rolling backups are corrupted (worst case):**
```bash
# Full reimport from ~/brain/ markdown (source of truth)
rm -rf ~/.gbrain/brain.pglite
gbrain init
gbrain import ~/brain --no-embed 2>&1 | tail -5
gbrain embed --all 2>&1 | tail -5
# Recovery time: ~30 min, zero data loss (brain/ is the ground truth)
```

**Step 5 — Restart services:**
```bash
pm2 start gbrain-mcp
systemctl --user start hermes-gateway
```

**Step 6 — Verify:**
```bash
gbrain onboard --check --json
hermes status
```

---

## Hermes Gateway Crash Loop

**Symptom:** `systemctl --user status hermes-gateway` shows "activating" then "failed" repeatedly.

```bash
# Check recent logs
journalctl --user -u hermes-gateway --since "30 minutes ago" | tail -30

# Common fixes:
# 1. Config syntax error
hermes config validate 2>&1  # if this command exists

# 2. Port conflict
lsof -i :8642  # Hermes API port — kill conflicting process

# 3. Python env issue
source ~/.hermes/hermes-agent/venv/bin/activate && hermes status

# 4. Force restart
systemctl --user daemon-reload
systemctl --user start hermes-gateway
```

---

## GBrain Dream Cycle Failure

**Symptom:** `~/brain/` feels stale; no new links or consolidations; last dream cycle was >24h ago.

Check if dream ran:
```bash
# Check cron logs
grep "gbrain-dream" /var/log/syslog 2>/dev/null | tail -10
# OR
journalctl --since "24 hours ago" | grep "gbrain" | tail -20
```

Run dream manually (PM2 must be stopped first):
```bash
pm2 stop gbrain-mcp
export PATH="/home/dhruva/.bun/bin:$PATH"
gbrain dream --dir ~/brain 2>&1 | tail -20
pm2 start gbrain-mcp
```

Or use the safe wrapper (recommended — handles PM2 stop/start):
```bash
~/.gbrain/scripts/run-dream-safe.sh
```

---

## Discord Bot Offline

**Symptom:** Hermes is running but not responding in Discord.

```bash
# Check discord token
grep DISCORD_BOT_TOKEN ~/.hermes/.env

# Restart Hermes (will reconnect)
systemctl --user restart hermes-gateway

# If still not connecting, check Discord API status:
# https://discordstatus.com
```

---

## Anthropic Credits Exhausted

**Symptom:** Hermes skills fail with "insufficient_quota" or similar errors; `hermes status` shows model errors.

> **⚠️ Model name:** Gemini 2.0 Flash shut down 2026-06-01. Use `gemini-3.1-flash-lite`.
> Verify current model ID at https://ai.google.dev/gemini-api/docs/models before editing config.

**Temporary fix (Gemini fallback):**
```bash
# Switch to Gemini 3.1 Flash Lite temporarily
sed -i 's/claude-sonnet-4-6/gemini-3.1-flash-lite/; s/provider: anthropic/provider: google/' \
  ~/.hermes/config.yaml
systemctl --user restart hermes-gateway
```

**When Anthropic credits are replenished (check at platform.anthropic.com/usage):**
```bash
# Switch back to Claude
sed -i 's/gemini-3.1-flash-lite/claude-sonnet-4-6/; s/provider: google/provider: anthropic/' \
  ~/.hermes/config.yaml
systemctl --user restart hermes-gateway
```

**Verify:**
```bash
hermes status | grep provider
# Should show: anthropic / claude-sonnet-4-6
```

---

## Tailscale SSH Connectivity Lost

**Symptom:** `ssh dhruva@100.119.229.11` hangs or times out.

```bash
# On Mac
tailscale status  # check if Omen node shows up

# If not visible, restart Tailscale on Mac:
sudo tailscale down && sudo tailscale up

# If Omen itself went offline, it will reconnect automatically when the machine comes back.
# Hermes runs as a systemd service and starts automatically on Omen boot.
```

---

## tasks.md Corrupted

**Symptom:** Task list in `~/brain/projects/tasks.md` is missing, empty, or malformed.

```bash
# Restore from git history
cd ~/brain
git log --oneline -- projects/tasks.md | head -5
# Find the last good commit hash

git show <commit-hash>:projects/tasks.md | head -20
# Verify it looks correct

git checkout <commit-hash> -- projects/tasks.md
gbrain import ~/brain/projects/tasks.md

# Re-prioritize (will regenerate from Notion DB)
# Discord: /task-prioritization
```

---

## Hermes Silent — Out-of-Band Check

**Symptom:** Discord has been silent for >30 minutes during expected active hours. Hermes may
be down. Since Hermes cannot alert about its own crash, check out-of-band:

```bash
# From Mac via Tailscale SSH
ssh dhruva@100.119.229.11 'systemctl --user status hermes-gateway --no-pager | tail -5'

# If failed — restart
ssh dhruva@100.119.229.11 'systemctl --user restart hermes-gateway'

# Check what crashed it
ssh dhruva@100.119.229.11 'journalctl --user -u hermes-gateway --since "1 hour ago" | tail -20'
```

**Zero-LLM Hermes health cron (add to system crontab — runs even if Hermes is down):**
```bash
# sudo crontab -e (system crontab, not user — survives Hermes crash)
# Check Hermes every 5 min, alert iPhone via ntfy if down
*/5 * * * * systemctl --user --machine=dhruva@ is-active hermes-gateway >/dev/null 2>&1 || \
  curl -s -d "Hermes down on Omen" ntfy.sh/dhruva-alerts-14a313f0dbe1
```
Note: This cron uses `--machine=dhruva@` to check the user service from root's system crontab.
If that syntax doesn't work on this Ubuntu version: `su - dhruva -c 'systemctl --user is-active hermes-gateway'`.

---

## GBrain OAuth Token Expired (Sept 5, 2026)

**Symptom:** GBrain health check shows :3131/health returning 200, but all Hermes MCP calls
return 401. Skills fail with "unauthorized" or "MCP error" in gateway.log.

**Verify:**
```bash
# Test authenticated call (not just /health)
curl -s -H "Authorization: Bearer $(grep MCP_GBRAIN_API_KEY ~/.hermes/.env | cut -d= -f2)" \
  http://127.0.0.1:3131/mcp/tools | head -20
# If returns 401 → token expired
```

**Fix — refresh the token:**
```bash
export PATH="/home/dhruva/.bun/bin:$PATH"
~/.hermes/scripts/refresh-gbrain-token.sh
# Verify new token works:
source ~/.hermes/.env
curl -s -H "Authorization: Bearer $MCP_GBRAIN_API_KEY" http://127.0.0.1:3131/mcp/tools | head -5
# Restart Hermes to pick up new token from .env
systemctl --user restart hermes-gateway
```

**Prevention:** Verify the 60-day auto-refresh cron ran successfully around Aug 5, 2026:
```bash
hermes cron list | grep -i refresh
# Check logs for refresh script execution
grep "refresh-gbrain" ~/.hermes/logs/gateway.log | tail -5
```

---

## Important File Locations

| What | Where |
|------|-------|
| GBrain database | `~/.gbrain/brain.pglite/` |
| GBrain rolling backups | `~/.gbrain/brain.pglite.YYYYMMDD` (daily, 4:30am) |
| Brain markdown (source of truth) | `~/brain/` |
| Hermes config | `~/.hermes/config.yaml` |
| API keys | `~/.hermes/.env` (chmod 600) |
| Hermes logs | `~/.hermes/logs/gateway.log` |
| PM2 logs | `pm2 logs gbrain-mcp` |
| systemd logs | `journalctl --user -u hermes-gateway -f` |
| Dream safe wrapper | `~/.gbrain/scripts/run-dream-safe.sh` |
| Embed safe wrapper | `~/.gbrain/scripts/run-embed-safe.sh` |
| Token refresh script | `~/.hermes/scripts/refresh-gbrain-token.sh` |
| Out-of-band ntfy alert | `curl -d "msg" ntfy.sh/dhruva-alerts-14a313f0dbe1` |

---

## Cron Collision Risk Windows

These time windows have known or potential GBrain write conflicts:

| Window | Jobs | Risk |
|--------|------|------|
| 2:00–4:30am daily | embed → dream → stale-fact-rewrite → backup | Embed running long can overlap dream; backup reads during PM2 restart |
| 8:00am daily | morning-briefing + birthday-reminder | Both start at 0 seconds; concurrent reads OK, concurrent writes are not |
| Sunday 21:00 | skill-analytics + weekly-learning-synthesis | weekly-learning-synthesis writes GBrain — stagger one by 10 min |
| 0:05, 6:05, 12:05, 18:05 | failure-backlog GBrain write | Safe against embed/dream window but watch for long embed runs |

**Fix for Sunday 21:00 collision:** Change weekly-learning-synthesis to `10 21 * * 0` (21:10).
**Fix for backup:** The 4:30am `cp -r` runs while PM2 is active. Ideal fix: change backup to stop PM2 first, copy, restart PM2. Pragmatic interim: keep at 4:30am when embed (2am) and dream (3am) have been done for >1h and PM2 is stable.
