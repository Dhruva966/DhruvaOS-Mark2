# Local Model — Tier 0 Finding

Researched: 2025-06-01. Reviewed against current Omen deployment on 2026-06-04.

## Target: Bonsai (PrismML)

Bonsai-8B and Ternary-Bonsai-8B exist on HuggingFace (prism-ml organization) and DO fit
in 6 GB VRAM, BUT are NOT available in the Ollama library.

| Model | VRAM (Q1_0/Q2_0) | Ollama | HuggingFace |
|-------|-----------------|--------|------------|
| Bonsai-8B | ~1.65 GB (Q1_0) | ❌ Not in library | ✅ prism-ml/Bonsai-8B-gguf |
| Ternary-Bonsai-8B | ~2.53 GB (Q2_0) | ❌ Not in library | ✅ prism-ml/Ternary-Bonsai-8B-gguf |

To use Bonsai: requires llama.cpp directly or LM Studio (not `ollama pull`). This adds
complexity to the Hermes integration (Hermes uses Ollama's OpenAI-compatible endpoint).

## Decision: phi4-mini as Tier 0

`phi4-mini` is in the Ollama library, fits in ~2.5 GB VRAM, and works natively with
Hermes's Ollama integration.

| Model | VRAM | `ollama pull` | Tokens/sec (est.) |
|-------|------|--------------|------------------|
| phi4-mini | ~2.5 GB | ✅ | ~20-30 tok/s on GTX 1660 Ti |
| gemma3:4b | ~3.3 GB | ✅ | ~15-25 tok/s |
| qwen3:8b | ~5.2-6.0 GB | ✅ | MARGINAL — swap risk |

## Bonsai Path (future, optional)

If Bonsai becomes available in Ollama, or if llama.cpp integration is worth the effort:
```bash
# Via llama.cpp (manual setup)
# 1. Download GGUF from HuggingFace: prism-ml/Bonsai-8B-gguf
# 2. Run llama.cpp server on port 11434 (compatible with Ollama's OpenAI endpoint)
# 3. Update Hermes config: model: "bonsai-8b"
```

Not blocking. phi4-mini is the correct choice for now.

## Ollama Install (verified)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull phi4-mini
ollama run phi4-mini "test"    # expect ~2.5 GB VRAM usage
```

Ollama auto-installs as systemd service, auto-detects the NVIDIA GPU in the Omen (GTX 1660 Ti in the current machine).
