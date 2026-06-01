# gbrain/ — GBrain Memory Layer

Purpose: GBrain configuration, ingest patterns, and search/memory conventions for DhruvaOS.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Files

| What | Where |
|------|-------|
| GBrain config | `~/.gbrain/config.json` |
| PGLite database | `~/.gbrain/brain.db` |
| Brain content | `~/brain/` (markdown) |
| GBrain binary | `~/.bun/bin/gbrain` |
| Dream cycle log | Check `gbrain dream --dry-run` output |

---

## Allowed Patterns ✅

```bash
# ✅ Correct ingest workflow — always no-embed first, then embed separately
gbrain import ~/brain/new-notes/ --no-embed
gbrain embed --stale
gbrain onboard --check --json    # verify after every import
```

```bash
# ✅ Correct search — use search for fact retrieval
gbrain search "what do I know about machine learning"
gbrain search "who do I know at Google"
```

```bash
# ✅ Correct think — use think for trajectory/temporal queries
gbrain think "how have my career goals changed over time"
gbrain think "DhruvaOS project trajectory"
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
# ❌ Direct database access — never touch brain.db directly
sqlite3 ~/.gbrain/brain.db "SELECT * FROM chunks"    # WRONG

# ❌ Two concurrent gbrain write operations
gbrain import ~/notes/ &       # background
gbrain dream                   # concurrent — WRONG: corrupts PGLite DB
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
# ❌ Deleting brain.db to "reset" — destroys all embeddings
rm ~/.gbrain/brain.db    # WRONG: use gbrain apply-migrations --yes instead
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

5. **Never commit `~/.gbrain/brain.db` to git.** This file contains all embedded brain
   content including personal information. It's in `.gitignore`. Keep it there.

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
