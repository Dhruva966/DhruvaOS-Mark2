#!/usr/bin/env bash
# DhruvaOS Mark 2 — legacy Phase 0 setup guard
#
# This script intentionally does not perform setup anymore. The original version
# targeted an obsolete deployment shape: a separate `dhruvaos` user, Python 3.11
# apt packages, `~/.config/dhruvaos/.env`, PM2-managed Hermes, and legacy
# `brain.db` backups. The live Mark 2 deployment uses the `dhruva` user,
# Ubuntu 24.04/Python 3.12, `~/.hermes/.env`, systemd user service for Hermes,
# and GBrain PGLite at `~/.gbrain/brain.pglite/`.
#
# Use DEPLOYMENT.md and BUILD_PLAN.md instead. Keeping this guard prevents a
# stale one-shot script from silently creating the wrong runtime on a fresh host.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat <<EOF
Refusing to run obsolete Phase 0 setup.

Use the maintained runbooks instead:
  - $ROOT/DEPLOYMENT.md
  - $ROOT/BUILD_PLAN.md
  - $ROOT/ENVIRONMENT.md

Current deployment invariants:
  - runtime user: dhruva
  - secrets: ~/.hermes/.env
  - Hermes service: systemctl --user status hermes-gateway
  - GBrain DB: ~/.gbrain/brain.pglite/
  - GBrain MCP: gbrain serve --http --port 3131 --host 127.0.0.1

For a live host check, run:
  bash "$ROOT/scripts/health-check.sh"
EOF

exit 1
