#!/usr/bin/env bash
# Checks that AGENTS.md stays a thin adapter and hasn't drifted into duplicating CLAUDE.md.
# Run manually or wire into a git pre-commit hook:
#   cp scripts/check-agents-drift.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$ROOT/AGENTS.md"
CANONICAL="$ROOT/CLAUDE.md"
MAX_LINES=80
FAIL=0

# 1. Line count guard
lines=$(wc -l < "$AGENTS")
if [ "$lines" -gt "$MAX_LINES" ]; then
  echo "FAIL: AGENTS.md has $lines lines (max $MAX_LINES). It must stay a thin adapter."
  FAIL=1
else
  echo "OK:   AGENTS.md line count: $lines / $MAX_LINES"
fi

# 2. Verbatim duplication check (any non-trivial line >60 chars shared between both files)
python3 - "$AGENTS" "$CANONICAL" <<'PY'
import sys

def content_lines(path):
    skip = {'#', '|', '`', '-', ' ', ''}
    with open(path) as f:
        return [
            l.rstrip() for l in f
            if l.strip() and not any(l.lstrip().startswith(c) for c in skip)
        ]

agents_lines = content_lines(sys.argv[1])
canonical_set = set(content_lines(sys.argv[2]))

dupes = [l for l in agents_lines if l in canonical_set and len(l) > 60]
if dupes:
    print(f"FAIL: {len(dupes)} line(s) in AGENTS.md appear verbatim in CLAUDE.md:")
    for d in dupes[:5]:
        print(f"  {d[:120]}")
    sys.exit(1)
else:
    print(f"OK:   No verbatim duplication detected between AGENTS.md and CLAUDE.md.")
PY

[ "$FAIL" -eq 0 ] || exit 1
echo "PASS: AGENTS.md drift check clean."
