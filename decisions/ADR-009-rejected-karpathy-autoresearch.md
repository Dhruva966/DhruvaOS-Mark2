# ADR-009: Rejected Karpathy's AutoResearch for self-improvement loop

**Date:** 2026-06-04
**Status:** accepted

## Context

Evaluated Andrej Karpathy's AutoResearch (github.com/karpathy/autoresearch) as a mechanism
for continuous self-improvement of DhruvaOS agents.

AutoResearch is an autonomous ML research loop: an agent modifies `train.py`, runs a
5-minute GPU experiment, checks validation loss, and retains or reverts the change.
Designed to wake up to a better model overnight.

## Decision

Rejected. Wrong layer of the stack for DhruvaOS.

## Rationale

- DhruvaOS uses models, it doesn't own weights: Sonnet 4.6 and Opus 4.8 are Anthropic-hosted and cannot be fine-tuned by the user. phi4-mini via Ollama could theoretically be fine-tuned but this is a large scope expansion with unclear payoff.
- Hardware constraint: RTX 2060 6GB. phi4-mini consumes ~4-5GB during inference, leaving ~1GB for training gradients — insufficient even for LoRA fine-tuning.
- Wrong abstraction: DhruvaOS self-improvement happens at the skill and memory layer (Hermes skill authoring loop + GBrain dream cycle), not the model weight layer. Improving behavior via skill composition is faster, cheaper, and more controllable than weight updates.
- AutoResearch is an ML research tool. DhruvaOS is a personal AI OS. These are different problems.

## Consequences

The self-improving loop remains: novel task → Hermes authors skill YAML → quality gate → trust gate → auto-promote or Discord approval. GBrain dream cycle consolidates memory nightly. No model fine-tuning in scope through Phase 6.

If GPU is upgraded to ≥12GB VRAM and a specific Tier 0 improvement need emerges, revisit LoRA fine-tuning of phi4-mini in a future ADR.
