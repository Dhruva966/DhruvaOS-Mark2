# skills/ — Hermes Skill Library

Purpose: Starting skill definitions for DhruvaOS. These are seeded to `~/.hermes/skills/`
at deploy time and serve as the initial capability floor.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Files

| What | Where |
|------|-------|
| Skill templates | `skills/*.yaml` |
| Live skills (runtime) | `~/.hermes/skills/` |
| Skill tests | `~/.hermes/skills/<name>/tests/` |
| Charlie stub | `skills/charlie-monitoring.yaml` (NOT IMPLEMENTED) |

---

## Allowed Patterns ✅

```yaml
# ✅ Complete skill frontmatter — all fields present, all correct
name: task-prioritization
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Load task list, rank by urgency+importance, update GBrain"
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: ["projects/tasks.md"]
tests: tests/task-prioritization/
---
# Implementation body follows
```

```yaml
# ✅ Outbound skill with all required safety fields
name: email-reply
version: 1.0.0
tier: 2                   # minimum tier for outbound
outbound: true            # required — triggers quality firewall
requires_approval: true   # required for outbound
description: "Draft and send an email reply, requires Dhruva approval"
```

```python
# ✅ Skill test with full mocking
from unittest.mock import patch, MagicMock
import pytest

@pytest.mark.asyncio
async def test_task_prioritization_ranks_by_urgency():
    mock_tasks = ["task A (due tomorrow)", "task B (due next week)"]
    with patch("hermes.tools.gbrain.search") as mock_search:
        mock_search.return_value = {"answer": "\n".join(mock_tasks)}
        result = await run_skill("task-prioritization")
    assert result["tasks"][0] == "task A (due tomorrow)"
```

---

## Forbidden Patterns ❌

```yaml
# ❌ Tier mismatch with outbound=true
name: linkedin-update
tier: 1          # WRONG: outbound requires tier >= 2
outbound: true
```

```yaml
# ❌ Skill without tests field — quality gate will reject
name: my-skill
tier: 1
outbound: false
# tests: missing — WRONG, quality gate fails without this
```

```yaml
# ❌ Shell commands without requires_approval
name: cleanup-files
tier: 1
requires_approval: false    # WRONG: shell = requires_approval must be true
---
run_shell("find /tmp -name '*.old' -delete")
```

```yaml
# ❌ Hardcoded credentials in skill body
---
# WRONG: never put API keys in skill files
headers = {"Authorization": "Bearer sk-proj-abc123..."}
```

---

## What NOT to Do

1. **Never ship a skill without tests.** If the skill has no test directory, the quality
   gate rejects it. Write a minimum happy-path test and one edge case.

2. **Never modify the charlie-monitoring stub to run real logic** until the Charlie's
   Cleaners monitoring requirements are defined. The stub is an intentional placeholder.

3. **Never write a skill that writes to `projects/tasks.md` except task-prioritization.**
   That file has one canonical writer. Two skills writing the same brain file creates
   inconsistent task lists.

4. **Never author a skill without declaring `gbrain.writes`** if it creates brain files.
   Undeclared brain writes bypass the parallel safety check in BUILD_PLAN.md and can
   cause DB collisions during parallel builds.

5. **Never promote a runtime-authored skill without reviewing the trust gate decision.**
   For any skill with `outbound: true` or shell commands, verify the Discord approval DM
   actually arrived and was reviewed before the skill runs in production.

---

## Skill Trust Gate Quick Reference

| Skill type | Trust gate | Who approves |
|-----------|-----------|-------------|
| Read-only (search, calendar read, triage) | Auto after 1 review | Nobody — automatic |
| GBrain writes | Auto | Nobody — writes are reversible |
| File writes outside brain/ | Dhruva approval | Discord DM |
| Calendar creates / email drafts | Dhruva approval | Discord DM |
| Shell commands | Dhruva approval every time | Discord DM |
| Outbound send (email, LinkedIn, GitHub) | Dhruva approval every instance | #corrections channel |
