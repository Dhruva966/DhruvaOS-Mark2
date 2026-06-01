# wiki/

Long-form context documents for DhruvaOS. Not for code or config — for deep background
that any agent (Claude, Codex, or future systems) needs to understand decisions, context,
and history that isn't apparent from the codebase.

## What belongs here

- Multi-page explanations of non-obvious system design choices
- Historical context: why Mark 1 was replaced, what was tried and abandoned
- Integration deep-dives: detailed notes on Hermes skill mechanics, GBrain entity graph behavior
- Personal OS philosophy: the "Jarvis" principles that drive product decisions
- Running notes on what works and what doesn't in daily usage

## What does NOT belong here

- Code snippets (→ skills/ or the relevant subsystem directory)
- Architecture diagrams (→ ARCHITECTURE.md)
- Setup instructions (→ ENVIRONMENT.md, DEPLOYMENT.md)
- Short reference material (→ subsystem CLAUDE.mds)
- Secrets or API keys (→ ~/.config/dhruvaos/.env — never in the repo)

## Format

Markdown. No special structure required. Date your entries when context matters
(`## 2025-06-01 — topic`). Link liberally to other docs in the repo.

Start adding wiki docs once DhruvaOS is running and you notice recurring questions
or hard-won lessons worth preserving.
