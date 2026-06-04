# ADR-008: Rejected PlanetScale as database layer

**Date:** 2026-06-04
**Status:** accepted

## Context

Evaluated PlanetScale (serverless MySQL) as a potential database for DhruvaOS.

## Decision

Rejected. GBrain's PGLite is the only database layer.

## Rationale

- Wrong engine: PlanetScale is MySQL. GBrain requires Postgres + pgvector for semantic vector search. MySQL has no pgvector equivalent.
- Cloud-hosted: same data sovereignty violation as Supermemory — brain data would leave the Omen
- Wrong scale: PlanetScale is built for multi-user web apps needing horizontal scale. DhruvaOS is a single-writer, single-user embedded workload. PGLite handles it in-process with microsecond reads.
- Schema migrations already handled by `gbrain upgrade` + `gbrain apply-migrations`
- Schema branching (PlanetScale's flagship feature) is for safe deploys across engineering teams — irrelevant for a personal OS with one machine

## Consequences

None. PGLite covers all data requirements at zero ops cost.
