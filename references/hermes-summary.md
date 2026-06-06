# Hermes Agent — Reference Summary

Fetched: 2026-06-04. Source: https://github.com/NousResearch/hermes-agent

## Version

1.0.0 (from package.json)

## Runtime Requirements

- Python: 3.11+ (primary runtime — pyproject.toml dependencies)
- Node.js: 20+ (tooling and some components — package.json)
- Recommended install: `git clone + uv pip install -e .`
- Alt install: curl one-liner (see README)

## Install

```bash
git clone https://github.com/NousResearch/hermes-agent ~/.hermes-src
cd ~/.hermes-src
uv pip install -e .
```

## Supported Messaging Channels

Discord ✅, Telegram, Slack, WhatsApp, Signal, Email

## Self-Improving Skill Loop

- Skills deployed as SKILL.md markdown files with YAML frontmatter (root `skills/*.yaml` stubs are legacy/reference only)
- Quality gate: pytest + mock tools (must pass before promotion)
- Trust gate: auto for read-only, Dhruva approval for write/shell
- Skills auto-discovered from `~/.hermes/skills/` directory

## Built-in Tools (40+)

| Category | Tools |
|----------|-------|
| Web | Exa (search), browser/extraction stack delegated by project policy (AgentQL primary, Firecrawl fallback) |
| Browser | Browserbase (cloud), agent-browser (npm) |
| Images | FAL.ai |
| Terminal | subprocess with docker/local isolation |
| Scheduling | APScheduler (cron syntax) |
| Subagents | Multiprocessing (max 3, depth 2) |
| MCP | Built-in discovery + registration |
| Memory | SQLite + JSON snapshots |

## Local Model Support

- Ollama: via `http://localhost:11434/v1` (OpenAI-compatible)
- vLLM: via `http://localhost:8000/v1` (OpenAI-compatible)
- Config in `~/.hermes/config.yaml`:
  ```yaml
  providers:
    ollama:
      base_url: "http://localhost:11434/v1"
      api_key: "dummy"
  ```

## Limits

- 90 iterations max per run (hard cap)
- 8 max concurrent tool workers
- No persistent browser sessions (closed after each use)

## Known 404s (docs not in repo)

skills.md, configuration.md, tools.md, discord.md, models.md, local-models.md,
faq.md, setup.md, memory.md — all return 404. Documentation is sparse.

## Security

7-layer built-in security (from official docs):
1. User authorization (Discord/Telegram allowlist)
2. Dangerous command approval (human-in-the-loop)
3. Container isolation (Docker/Singularity with cap-drop ALL)
4. MCP credential filtering
5. Context file scanning (prompt injection detection)
6. Cross-session isolation
7. Input sanitization

No known CVEs (GitHub security advisories: 0 as of 2025-06-01).

## OpenAI/Provider Config

Direct OpenAI API (burns platform.openai.com credits):
```yaml
providers:
  openai_direct:
    api_key: "${OPENAI_API_KEY}"
    base_url: "https://api.openai.com/v1"
```
OpenRouter (own billing, separate account):
```yaml
providers:
  openrouter:
    base_url: "https://openrouter.ai/api/v1"
    api_key: "${OPENROUTER_API_KEY}"
```
