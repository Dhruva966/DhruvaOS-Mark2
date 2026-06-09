"""Shared pytest helpers for DhruvaOS skill contract tests.

Skills are now goal + context + constraints — NOT scripts. These helpers verify
structural integrity of the new format without asserting on specific implementation
wording, which is the exact hardcoding we're moving away from. The canonical
contract enforcement still lives in `scripts/check-skill-contracts.py` — these
pytest helpers are a thin wrapper so the existing per-skill test files stay valid.
"""

from __future__ import annotations

from pathlib import Path


REQUIRED_SECTIONS = ("## Purpose", "## Context", "## Goal", "## Constraints")
REQUIRED_FRONTMATTER_FIELDS = ("name:", "description:")
FORBIDDEN_PATTERNS = ("## Step ", "### Step ", "```python", "```bash", "```json")


def skill_path(skill_name: str) -> Path:
    """Resolve a skill's SKILL.md path from this conftest's location."""
    return Path(__file__).resolve().parent / skill_name / "SKILL.md"


def load_skill(skill_name: str) -> str:
    """Read the SKILL.md text for a given skill name."""
    return skill_path(skill_name).read_text()


def assert_skill_structure(skill_name: str) -> None:
    """Generic structural contract — every skill must satisfy this.

    Verifies the new intelligence-guided format: frontmatter present with required
    fields, the four canonical sections exist, and no remnants of the old scripted
    format (numbered Steps or embedded code blocks) survive.
    """
    text = load_skill(skill_name)

    assert text.startswith("---\n"), f"{skill_name}: missing YAML frontmatter"
    fm_end = text.find("\n---", 4)
    assert fm_end != -1, f"{skill_name}: frontmatter not closed"
    frontmatter = text[4:fm_end]

    for field in REQUIRED_FRONTMATTER_FIELDS:
        assert field in frontmatter, f"{skill_name}: frontmatter missing `{field}`"

    body = text[fm_end:]
    for section in REQUIRED_SECTIONS:
        assert section in body, f"{skill_name}: body missing `{section}` section"

    for forbidden in FORBIDDEN_PATTERNS:
        assert forbidden not in body, (
            f"{skill_name}: body contains forbidden pattern `{forbidden}` — "
            f"skills must describe goal+context+constraints, not scripted steps or code"
        )
