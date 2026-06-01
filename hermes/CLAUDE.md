# hermes/ — Hermes Agent Configuration

Purpose: Hermes Agent config overrides, skill seeds, and development patterns for DhruvaOS.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Files

| What | Where |
|------|-------|
| Hermes runtime config | `~/.hermes/config.yaml` (not in repo — secrets) |
| Config template | `hermes/config.template.yaml` |
| Starting skills | `skills/*.yaml` (seeded to `~/.hermes/skills/`) |
| Hermes source | `~/.hermes-src/` (cloned from GitHub) |
| All live skills | `~/.hermes/skills/` |

---

## Allowed Patterns ✅

```yaml
# ✅ Correct skill frontmatter — all required fields present
name: research-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Deep-dive a topic, return structured summary, write to brain"
schedule: null
gbrain:
  reads: ["concepts/*", "resources/*"]
  writes: ["resources/research-{{topic}}-{{date}}.md"]
tests: tests/research-synthesis/
```

```python
# ✅ Correct test pattern — all tools mocked, no real API calls
from unittest.mock import patch, AsyncMock

async def test_research_synthesis_happy_path():
    with patch("hermes.tools.exa.search") as mock_search:
        mock_search.return_value = [{"title": "...", "url": "..."}]
        result = await run_skill("research-synthesis", query="machine learning")
        assert "summary" in result
        assert len(result["citations"]) > 0
```

```yaml
# ✅ Correct escalation — tier bumped, reason logged
routing:
  escalation:
    on_reasoning_failure: "bump_one_tier"
    promote_permanently_threshold: 0.30
```

```yaml
# ✅ Correct outbound skill — approval gate declared, tier enforced
name: email-reply
tier: 2                    # Tier 2 minimum for outbound
outbound: true             # declares intent
requires_approval: true    # approval required before send
```

---

## Forbidden Patterns ❌

```yaml
# ❌ Outbound skill with wrong tier
name: email-reply
tier: 1          # WRONG: outbound requires tier >= 2
outbound: true
```

```yaml
# ❌ Missing outbound declaration for skill that sends external messages
name: linkedin-post
tier: 2
# outbound: missing — WRONG, quality firewall won't fire
```

```python
# ❌ Test makes real API calls
async def test_email_triage():
    result = await run_skill("email-triage")  # hits real Gmail — WRONG
    assert len(result["emails"]) > 0
```

```yaml
# ❌ YOLO mode enabled
agent:
  yolo_mode: true    # NEVER — dangerous commands bypass approval
```

```python
# ❌ Shell command without approval flag
# skill body
run_shell("rm -rf /tmp/output")    # WRONG: shell requires requires_approval: true
```

---

## What NOT to Do

1. **Never set `tier: 0` for anything that touches external APIs.** Tier 0 (phi4-mini) is
   for internal triage only. If a skill queries Exa, Firecrawl, or any external service,
   tier is minimum 1.

2. **Never write a skill without tests.** The quality gate runs `pytest --mock-tools`.
   No tests = skill fails quality gate = never promoted. Write the test first.

3. **Never edit `~/.hermes/config.yaml` while Hermes is running.** Stop Hermes
   (`pm2 stop hermes`), edit, restart (`pm2 start hermes`). Concurrent config edits
   produce undefined behavior.

4. **Never bypass the approval gate for convenience.** If a skill's approval requirement
   feels annoying, that's correct behavior — outbound actions should feel deliberate.
   The friction is the feature.

5. **Never hardcode API keys in skill YAML or test files.** All secrets via environment
   variables from `~/.config/dhruvaos/.env`. If a key appears in a skill file, it's a
   security incident.
