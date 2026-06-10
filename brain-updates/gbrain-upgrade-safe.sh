#!/bin/bash
# Safe gbrain upgrade: stops PM2, upgrades, migrates, tests DB, restarts
# If PGLite format is incompatible after upgrade, auto-reinits from brain files
set -euo pipefail
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
BUN="/home/dhruva/.bun/bin/bun"
LOG="$HOME/.hermes/logs/gbrain-upgrade.log"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] gbrain-upgrade-safe: $1" | tee -a "$LOG"; }

log "Starting safe gbrain upgrade"
pm2 stop gbrain-mcp 2>/dev/null || true
sleep 2

log "Backing up current DB..."
cp -r ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.pre-upgrade-$(date +%Y%m%d) || true

log "Upgrading gbrain..."
gbrain upgrade 2>&1 | tee -a "$LOG"

log "Applying schema migrations..."
gbrain apply-migrations --yes 2>&1 | tee -a "$LOG"

log "Testing DB can open..."
TEST_SCRIPT="
const { PGlite } = require('@electric-sql/pglite');
async function main() {
  const db = new PGlite('/home/dhruva/.gbrain/brain.pglite');
  await db.waitReady;
  const r = await db.query('SELECT count(*) as c from pages');
  console.log('pages:', r.rows[0].c);
  await db.close();
}
main().catch(function(e) { console.error('FAIL:', e.message); process.exit(1); });
"

if ! timeout 15 "$BUN" -e "$TEST_SCRIPT" 2>&1 | tee -a "$LOG"; then
    log "DB test FAILED — format incompatible — re-initializing from brain files..."
    mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.broken-$(date +%Y%m%d)
    echo 'y' | gbrain init --pglite 2>&1 | tee -a "$LOG"
    gbrain import ~/brain/ --no-embed 2>&1 | tee -a "$LOG"
    gbrain embed --stale 2>&1 | tee -a "$LOG"
    log "Re-initialization complete"
else
    log "DB test passed"
fi

log "Restarting gbrain-mcp via PM2..."
pm2 start gbrain-mcp
sleep 8
pm2 list | grep gbrain | tee -a "$LOG"
log "gbrain-upgrade-safe complete"
