# gbrain/ — GBrain Memory Layer

Purpose: GBrain configuration, ingest patterns, and search/memory conventions for DhruvaOS.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Files

| What | Where |
|------|-------|
| GBrain config | `~/.gbrain/config.json` |
| PGLite database | `~/.gbrain/brain.pglite/` |
| Brain content | `~/brain/` (markdown) |
| GBrain source | `~/gbrain-src/` (git clone — NOT global bun install) |
| GBrain run command | `cd ~/gbrain-src && bun src/cli.ts <cmd>` |
| PM2 process | `gbrain-mcp` — runs with `--cwd ~/gbrain-src` |
| Dream cycle log | Check `cd ~/gbrain-src && bun src/cli.ts dream --dry-run` output |

---

## Allowed Patterns ✅

```bash
# ✅ Correct ingest workflow — run from source dir, always no-embed first
cd ~/gbrain-src
bun src/cli.ts import ~/brain/new-notes/ --no-embed
bun src/cli.ts embed --stale
bun src/cli.ts onboard --check --json    # verify after every import
```

```bash
# ✅ Correct search — use search for fact retrieval
cd ~/gbrain-src && bun src/cli.ts search "what do I know about machine learning"
cd ~/gbrain-src && bun src/cli.ts search "who do I know at Google"
```

```bash
# ✅ Correct think — use think for trajectory/temporal queries
cd ~/gbrain-src && bun src/cli.ts think "how have my career goals changed over time"
cd ~/gbrain-src && bun src/cli.ts think "DhruvaOS project trajectory"
```

```markdown
<!-- ✅ Correct brain file format — frontmatter required for auto-linking -->
---
title: "Alice Chen"
date: "2025-06-01"
tags: ["person", "UCLA", "professor"]
source: "manual"
---

# Alice Chen

Professor at UCLA CS department. Met at orientation event.
Research focus: distributed systems. Potential advisor for research.
```

```yaml
# ✅ Correct skill gbrain declaration — explicit reads and writes
gbrain:
  reads: ["people/*", "projects/tasks.md"]
  writes: ["daily/briefing-{{date}}.md"]
```

---

## Forbidden Patterns ❌

```bash
# ❌ Direct database access — never touch brain.pglite directly
sqlite3 ~/.gbrain/brain.pglite "SELECT * FROM chunks"    # WRONG

# ❌ Two concurrent gbrain write operations
cd ~/gbrain-src && bun src/cli.ts import ~/notes/ &       # background
cd ~/gbrain-src && bun src/cli.ts dream                   # concurrent — WRONG: corrupts PGLite DB

# ❌ Global bun install — resolves PGLite 0.5.1 which breaks pgvector DBs
bun install -g github:garrytan/gbrain    # WRONG — use git clone to ~/gbrain-src instead

# ❌ Running gbrain CLI while PM2 holds PGLite lock
bun src/cli.ts dream    # WRONG while PM2 gbrain-mcp is running — PM2 holds exclusive lock
# Correct: use ~/.hermes/scripts/gbrain-dream.sh which stops PM2 first
```

```bash
# ❌ Running dream cycle during active skill execution
# (dream locks the DB for several minutes)
# If dream is running, defer any import/embed until it completes
```

```markdown
<!-- ❌ Brain file without frontmatter — won't auto-link correctly -->
# Alice Chen

Professor at UCLA. Met at orientation.
```

```bash
# ❌ Deleting brain.pglite to "reset" — destroys all embeddings
rm -rf ~/.gbrain/brain.pglite    # WRONG: use gbrain apply-migrations --yes instead
```

```yaml
# ❌ search_mode: tokenmax for routine queries — expensive
{
  "search_mode": "tokenmax"    # WRONG for daily use; use "balanced"
}
```

---

## What NOT to Do

1. **Never run two GBrain write operations in parallel.** PGLite is a single-writer
   embedded database. Concurrent writes corrupt the DB. Always serialize: `import`,
   `embed`, `dream`, `apply-migrations` must run one at a time.

2. **Never bypass GBrain to write brain files directly without ingesting.** You can
   create markdown files in `~/brain/` directly, but they won't be searchable until
   `gbrain embed --stale` is run. Always ingest after manual writes.

3. **Never set `search_mode: tokenmax` globally.** It triggers LLM query expansion on
   every search, multiplying cost. Use `tokenmax` only for specific deep research queries
   via the CLI directly; keep config at `balanced`.

4. **Never skip `gbrain onboard --check --json` after upgrades.** GBrain upgrades can
   require post-upgrade backfills (link extraction, timeline rebuild). The onboard check
   tells you what's needed.

5. **Never commit `~/.gbrain/brain.pglite/` to git.** This directory contains all embedded brain
   content including personal information. It's in `.gitignore`. Keep it there.

---

## CLI Gotchas — Check `--help` First

**Rule:** Run `gbrain --help` or `gbrain <cmd> --help` before any unfamiliar command. Silent no-ops and wrong flags are common. 2 seconds of `--help` beats 50 trial-and-error turns.

| Wrong assumption | Correct command |
|-----------------|-----------------|
| `gbrain onboard --apply <id>` | `gbrain jobs submit <name> --follow` |
| `gbrain config set embedding_model` | Edit `~/.gbrain/config.json` directly (file-plane field — DB write is a no-op) |
| `gbrain embed --force` | `gbrain embed --all` |
| `gbrain embed --stale` shows 0 after failed embed | `gbrain embed --all` (marks pages embedded even on error) |

**Onboard job names** (from `gbrain onboard --check --json` → `"job"` field):
```bash
gbrain jobs submit extract-timeline-from-meetings --follow
gbrain jobs submit extract-ner --follow
gbrain jobs submit unify-types --params '{"target_pack":"gbrain-base-v2"}' --follow
```

**Ollama embedding on Ubuntu 24.04 only:** use `127.0.0.1` not `localhost` — IPv6 resolution mismatch (not an issue on macOS).
```bash
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1   # add to ~/.bashrc
```

**MCP restart sequence after GBrain config changes:**
```bash
pm2 restart gbrain-mcp
sleep 5
hermes mcp test gbrain   # verify reconnected
# Never restart during: gbrain dream, gbrain embed, gbrain import (write lock held)
```

---

## Common Task Patterns

### Ingest new content
```bash
gbrain import ~/path/to/content --no-embed
gbrain embed --stale
gbrain onboard --check --json    # verify health after every import
```

### Run onboard recommendations
```bash
gbrain onboard --check --json           # see what's needed
gbrain jobs submit <job-name> --follow  # run each recommendation
gbrain onboard --check --json           # verify resolved
```

### Dream cycle (manual)
```bash
gbrain dream --dry-run   # preview
gbrain dream             # run full cycle
```

---

## Dream Cycle Rules

- Run nightly at 3am. Never skip.
- Never interrupt a running dream cycle (it can take 5-20 minutes).
- After any large import (>50 files), run `gbrain dream` manually.
- Dream cycle output is logged — review weekly for pattern insights.

```bash
# Safe dream cycle management
gbrain dream --dry-run    # preview without executing
gbrain dream              # run full cycle
```
