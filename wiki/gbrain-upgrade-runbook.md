# GBrain Upgrade Runbook — Recovery & Safe Upgrade Procedure

## What goes wrong during gbrain upgrades

GBrain auto-upgrades itself (mode: `notify` in `preferences.json`). When an upgrade changes
PGLite's internal storage format, the existing `brain.pglite` directory becomes unreadable
by the new version. The running `gbrain-mcp` PM2 server survives (it has DB in memory),
but **cannot restart** after any shutdown.

### Symptoms
- `pm2 list` shows `gbrain-mcp` in `errored` state with many restarts
- `gbrain import` fails: `PGLite failed to initialize its WASM runtime. Original error: Aborted()`
- All existing `brain.pglite.*` backups also fail (they're all pre-upgrade format)
- Only a brand-new empty DB works (`gbrain init`)

### Other failure mode: zombie processes
A zombie bash/bun process consuming 99.9% CPU will starve WASM of resources, causing
the same "Aborted()" error even if the DB format is fine. Always check `ps aux` for
runaway processes before assuming DB corruption.

---

## Recovery Procedure (when gbrain-mcp won't start)

**Run this from Omen SSH with correct PATH:**
```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
```

### Step 0 — Check for zombie processes first
```bash
ps aux | sort -k3 -rn | head -10
# If any bash/bun process at 99%+ CPU for >5 min → kill it
kill -9 <zombie_pid>
```

### Step 1 — Stop gbrain-mcp
```bash
pm2 stop gbrain-mcp
```

### Step 2 — Clear stale locks
```bash
rm -f ~/.gbrain/brain.pglite/.gbrain-lock/lock
rmdir ~/.gbrain/brain.pglite/.gbrain-lock 2>/dev/null
rm -f ~/.gbrain/brain.pglite/postmaster.pid  # if exists
```

### Step 3 — Test if current DB is healthy
```bash
# Test PGLite directly (no gbrain-mcp holding lock)
bun -e "const { PGlite } = require('@electric-sql/pglite'); async function main() { const db = new PGlite('/home/dhruva/.gbrain/brain.pglite'); await db.waitReady; const r = await db.query('SELECT count(*) as c from pages'); console.log('pages:', r.rows[0].c); await db.close(); } main().catch(e => console.error('FAIL:', e.message));"
```

- **If it works**: proceed to Step 5 (just restart PM2)
- **If FAIL**: the DB format is incompatible → proceed to Step 4

### Step 4 — Re-init with fresh DB (if format incompatible)
```bash
mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.broken-$(date +%Y%m%d)
echo 'y' | gbrain init --pglite
# Verify init worked:
gbrain list
```

### Step 5 — Import all brain files
```bash
gbrain import ~/brain/ --no-embed
gbrain embed --stale
```

### Step 6 — Restart gbrain-mcp and verify
```bash
pm2 start gbrain-mcp
sleep 8
pm2 list | grep gbrain
# Should show: online, memory >250MB (DB loaded)
```

### Step 7 — Test search works
```bash
# Test via MCP HTTP (while gbrain-mcp is running, CLI can't read)
curl -s -X POST http://127.0.0.1:3131/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token_from_pm2_error_log>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gbrain_search","arguments":{"query":"xposteros"}}}'
```

Or ask Drew: `xposteros status` in Discord — if GBrain search works, Drew will use it.

---

## Safe Upgrade Procedure (proactive)

Before upgrading gbrain, run this to ensure clean migration:

```bash
# 1. Stop the MCP server before upgrading
pm2 stop gbrain-mcp

# 2. Backup current DB
cp -r ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.pre-upgrade-$(date +%Y%m%d)

# 3. Upgrade
gbrain upgrade

# 4. Apply migrations on new version
gbrain apply-migrations --yes

# 5. Test DB opens
bun -e "const { PGlite } = require('@electric-sql/pglite'); async function main() { const db = new PGlite('/home/dhruva/.gbrain/brain.pglite'); await db.waitReady; const r = await db.query('SELECT count(*) as c from pages'); console.log('pages:', r.rows[0].c); await db.close(); } main().catch(e => console.error('FAIL:', e.message));"

# 6. If test fails → init fresh DB and re-import (see Recovery Step 4-5 above)

# 7. Restart
pm2 start gbrain-mcp
```

---

## Preventing Silent Auto-Upgrades

GBrain's self-upgrade mode is `notify` (in `~/.gbrain/preferences.json`). This means
it notifies but may still auto-upgrade. To disable auto-upgrades entirely:

```bash
# Option A: disable auto-upgrade
# Edit ~/.gbrain/preferences.json: "minion_mode": "disabled"

# Option B: keep notify mode but ensure the upgrade-safe.sh script handles it
# The gbrain-upgrade-safe.sh script below should be the ONLY upgrade mechanism
```

---

## gbrain-upgrade-safe.sh

Deploy to `~/.hermes/scripts/gbrain-upgrade-safe.sh`:

```bash
#!/bin/bash
# Safe gbrain upgrade: stops PM2, upgrades, migrates, tests, restarts
set -euo pipefail
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
LOG="$HOME/.hermes/logs/gbrain-upgrade.log"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] gbrain-upgrade-safe: $1" | tee -a "$LOG"; }

log "Starting safe upgrade"
pm2 stop gbrain-mcp || true

# Backup
log "Backing up DB..."
cp -r ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.pre-upgrade-$(date +%Y%m%d) || true

# Upgrade
log "Upgrading gbrain..."
gbrain upgrade 2>&1 | tee -a "$LOG"

# Migrate
log "Applying migrations..."
gbrain apply-migrations --yes 2>&1 | tee -a "$LOG"

# Test DB
log "Testing DB..."
if ! timeout 15 bun -e "
const { PGlite } = require('@electric-sql/pglite');
async function main() {
  const db = new PGlite('/home/dhruva/.gbrain/brain.pglite');
  await db.waitReady;
  const r = await db.query('SELECT count(*) as c from pages');
  console.log('pages:', r.rows[0].c);
  await db.close();
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
" 2>&1 | tee -a "$LOG"; then
    log "DB test FAILED — re-initializing..."
    mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.broken-$(date +%Y%m%d)
    echo 'y' | gbrain init --pglite 2>&1 | tee -a "$LOG"
    gbrain import ~/brain/ --no-embed 2>&1 | tee -a "$LOG"
    gbrain embed --stale 2>&1 | tee -a "$LOG"
fi

# Restart
log "Restarting gbrain-mcp..."
pm2 start gbrain-mcp
sleep 8
pm2 list | grep gbrain | tee -a "$LOG"
log "Upgrade complete"
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `~/.gbrain/upgrade-state.json` | Last upgrade from/to versions + timestamp |
| `~/.gbrain/brain.pglite/` | Active PGLite database |
| `~/.gbrain/brain.pglite.pre-upgrade-YYYYMMDD/` | Pre-upgrade backup |
| `~/.pm2/logs/gbrain-mcp-error.log` | Admin token + startup errors |
| `~/brain/` | Source markdown files (always safe, never deleted) |

---

## Why brain files survive everything

All GBrain content is dual-stored:
1. **`~/brain/` markdown files** — always on disk, safe
2. **`brain.pglite` DB** — embeddings + search index

The DB is recoverable from markdown files via `gbrain import ~/brain/ && gbrain embed --stale`.
Never delete `~/brain/`. Never commit `~/.gbrain/brain.pglite/` to git.
