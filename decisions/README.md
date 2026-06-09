# decisions/

Architecture Decision Records (ADRs) for DhruvaOS. One file per significant decision.

## What belongs here

- Decisions that required trade-off analysis (why A over B)
- Decisions that will be questioned later ("why isn't this using X?")
- Vendor/provider choices and their rationale
- Changes to locked decisions and why they changed
- Post-mortems on mistakes (brief, actionable)

## What does NOT belong here

- Obvious decisions (no ADR needed for "use YAML for skill frontmatter")
- TODO items (→ BUILD_PLAN.md or Discord #tasks)
- Architecture descriptions (→ ARCHITECTURE.md)

## Format

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by ADR-NNN | deprecated

## Context
What situation prompted this decision?

## Decision
What was decided?

## Rationale
Why this over alternatives?

## Consequences
What changes as a result? What becomes harder?
```

## Existing Decisions

ADR files currently checked into the repo start at ADR-007. ADR-001 through ADR-006 are
planning-era decisions summarized here for continuity, but the individual markdown files
have not been reconstructed yet.

| ADR | Decision | Date |
|-----|---------|------|
| ADR-001 | Hermes Agent over OpenClaw as runtime | 2026-06-01 |
| ADR-002 | GBrain over Mem0+Qdrant+Graphify for memory | 2026-06-01 |
| ADR-003 | phi4-mini over Bonsai for Tier 0 (Bonsai not in Ollama) | 2026-06-01 |
| ADR-004 | Direct OPENAI_API_KEY over OpenRouter for Tier 1 (credits stranded) | 2026-06-01 |
| ADR-005 | PGLite over Postgres+Supabase (brain <1000 files, zero-ops) | 2026-06-01 |
| ADR-006 | Initial PM2-first process plan (later superseded by Hermes systemd gateway + PM2 only for GBrain/Lightpanda) | 2026-06-01 |
| ADR-007 | Rejected Supermemory (redundant with GBrain, data sovereignty) | 2026-06-04 |
| ADR-008 | Rejected PlanetScale (MySQL, no pgvector, cloud-hosted) | 2026-06-04 |
| ADR-009 | Rejected Karpathy AutoResearch (wrong layer — skill/memory not weights) | 2026-06-04 |
| ADR-010 | Browser stack: Lightpanda + AgentQL; Browserbase permanently dropped 2026-06-07 (replaced by local Playwright) | 2026-06-04 |

Create ADR files as needed. Number sequentially.
