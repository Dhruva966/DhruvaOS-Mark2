# ADR-007: Rejected Supermemory as memory layer

**Date:** 2026-06-04
**Status:** accepted

## Context

Evaluated Supermemory (supermemory.ai) as a potential memory/RAG layer for DhruvaOS.

## Decision

Rejected. GBrain is the memory layer.

## Rationale

- Full overlap: Supermemory's semantic knowledge graphs, temporal memory, multi-format ingest, and RAG are all covered by GBrain (PGLite + pgvector + auto-link + entity graph + dream cycle)
- Cloud-hosted: brain content would leave the Omen and hit Supermemory's servers — violates the data sovereignty requirement in CLAUDE.md (all brain data stays local)
- Multi-user SaaS design: Supermemory's core value prop is per-user memory isolation for products serving many users. DhruvaOS is a single-user personal OS — that feature is irrelevant
- GBrain's dream cycle (8-phase nightly consolidation via LLM synthesis) has no Supermemory equivalent — it's architecturally superior for compounding personal knowledge
- Additional paid infra with no marginal benefit

## Consequences

None. GBrain covers all requirements without data leaving the machine.
