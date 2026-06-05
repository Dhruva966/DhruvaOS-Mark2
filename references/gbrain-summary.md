# GBrain — Reference Summary

Fetched: 2026-06-04. Source: https://github.com/garrytan/gbrain

## Version

0.42.25.0 (current stable at fetch time)

## Runtime Requirements

- Bun: ≥1.3.10
- Node.js: not required (Bun-native)

## Install

```bash
bun install -g github:garrytan/gbrain
gbrain upgrade    # auto-update + schema migrations
```

## Database Backends

| Backend | Description | When to use |
|---------|-------------|------------|
| PGLiteEngine | WASM Postgres 17.5, zero-config, free | Default — <1000 files, single machine |
| PostgresEngine | Postgres + pgvector (Supabase) | >1000 files, multi-device sync |

PGLite stores at `~/.gbrain/brain.pglite/`. Migration commands and engine names should be checked against the current upstream CLI before use.

## MCP Exposure

- Stdio (default): `gbrain serve` — Hermes connects directly, no auth
- HTTP+OAuth 2.1: `gbrain serve --http --port 3131` — for external clients

## Hermes Integration

No special Hermes-GBrain code required. Use standard MCP client config in Hermes to point at `gbrain serve`.

## Key Commands

```bash
gbrain import <dir> --no-embed    # import markdown files
gbrain embed --stale              # generate embeddings for new/changed files
gbrain search "query"             # hybrid retrieval + synthesis
gbrain think "trajectory query"  # temporal + entity graph analysis
gbrain dream                      # nightly consolidation (8 phases)
gbrain dream --dry-run            # simulate without executing
gbrain onboard --check --json     # health check
gbrain upgrade                    # update + migrate
gbrain apply-migrations --yes     # manual schema migration
gbrain extract links --source db  # rebuild entity graph
gbrain extract timeline --source db  # rebuild timeline
```

## Search Modes (cost vs quality)

| Mode | Token budget | Chunks | LLM expansion | Monthly cost (10K queries) |
|------|-------------|--------|--------------|--------------------------|
| conservative | 4K | 10 | No | ~$40 (Haiku) |
| balanced | 12K | 25 | No | ~$100-300 |
| tokenmax | unlimited | 50 | Yes | ~$200-1000 |

**DhruvaOS uses: balanced** — correct for solo developer at moderate query volume.

## Bundled Skills (43 total)

Key skills for DhruvaOS:
- `signal-detector` — runs on every inbound message, captures entities/ideas
- `brain-ops` — brain-first lookup on every response
- `idea-ingest` — ingest links, articles, tweets
- `media-ingest` — ingest PDFs, videos, repos, books, podcasts
- `meeting-ingestion` — process meeting transcripts
- `voice-note-ingest` — transcribe + file voice notes
- `soul-audit` — generate SOUL.md, USER.md, ACCESS_POLICY.md

Scaffold all: `gbrain skillpack scaffold --all`

## Dream Cycle (8 phases)

1. Entity sweep
2. Citation fixes
3. Memory consolidation
4. Conversation synthesis
5. Cross-session pattern detection
6. Timeline backfill
7. Auto-link creation
8. Gap analysis

Cron: `0 3 * * * gbrain dream`

## Search vs Think

- `gbrain search` = hybrid FTS+vector RRF retrieval + synthesis + citations + gap analysis
- `gbrain think` = search substrate + trajectory tracking + entity graph traversal

## Brain Repo Structure

User's brain lives in `~/brain/` (separate from GBrain codebase).
Recommended schema: `docs/GBRAIN_RECOMMENDED_SCHEMA.md` in gbrain repo.

## Config

```json
// ~/.gbrain/config.json
{
  "engine": "pglite",
  "search_mode": "balanced",
  "embedding_provider": "ollama",
  "embedding_model": "nomic-embed-text",
  "query_expansion": false,
  "brain_path": "~/brain"
}
```
