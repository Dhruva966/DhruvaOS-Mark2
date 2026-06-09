"""
Contract tests for ambient-discord-listener SKILL.md.
Tests verify structural correctness, trust gate compliance, and design invariants.
"""

import pathlib
import re

SKILL_PATH = pathlib.Path(__file__).parent.parent / "SKILL.md"
TEXT = SKILL_PATH.read_text()


def test_skill_file_exists():
    assert SKILL_PATH.exists(), "SKILL.md must exist"


def test_required_frontmatter_fields():
    for field in ["name:", "tier:", "outbound:", "requires_approval:", "description:"]:
        assert field in TEXT, f"Missing required frontmatter field: {field}"


def test_tier_0_no_outbound():
    """Ambient listener is internal-only — tier 0, never outbound."""
    assert "tier: 0" in TEXT, "ambient-discord-listener must be tier 0"
    assert "outbound: false" in TEXT, "ambient-discord-listener must not be outbound"


def test_requires_approval_false():
    assert "requires_approval: false" in TEXT, "should not require approval — internal only"


def test_trigger_on_message():
    """Must declare on_message trigger so Hermes fires it on every Discord message."""
    assert "trigger: on_message" in TEXT or "on_message" in TEXT, \
        "Must declare on_message trigger in frontmatter"


def test_allowed_user_check():
    """MUST check DISCORD_ALLOWED_USER before processing any message."""
    assert "DISCORD_ALLOWED_USER" in TEXT, "Must check sender against DISCORD_ALLOWED_USER"
    assert "NOT_ALLOWED" in TEXT or "not_allowed" in TEXT.lower(), \
        "Must have NOT_ALLOWED guard that exits immediately for non-allowed senders"


def test_skips_command_messages():
    """Must skip messages starting with / — those belong to the command dispatcher."""
    assert "IS_COMMAND" in TEXT or "startswith(\"/\")" in TEXT or "starts with" in TEXT.lower(), \
        "Must skip command messages (those starting with /)"


def test_no_hardcoded_credentials():
    """No secrets in skill body."""
    assert "sk-" not in TEXT
    assert "Bearer " not in TEXT or "Bearer token" in TEXT
    assert "api_key" not in TEXT.lower() or "env" in TEXT.lower()


def test_phi4_mini_for_classification():
    """Classification must use phi4-mini (Tier 0, local, free) — never Tier 2+."""
    assert "phi4-mini" in TEXT or "tier: 0" in TEXT, \
        "Classification must use phi4-mini locally — not a cloud model"
    assert "tier: 0" in TEXT, "Skill tier must be 0"


def test_silent_by_default():
    """Must be silent unless explicitly a question for Drew."""
    assert "Stay silent" in TEXT or "silent" in TEXT.lower(), \
        "Skill must document its silent-by-default behavior"
    assert "is_question_for_drew" in TEXT, \
        "Must have an explicit gate for when to reply vs. stay silent"


def test_gbrain_writes_declared():
    """GBrain writes must be declared for parallel safety."""
    assert "gbrain:" in TEXT
    assert "writes:" in TEXT
    assert "ambient" in TEXT, "Writes should include ambient capture file"


def test_dream_cycle_integration():
    """Ambient captures should feed into the dream cycle."""
    assert "dream" in TEXT.lower(), \
        "Skill must document how ambient captures feed into the dream cycle"


def test_intent_categories_present():
    """All key intent categories must be defined."""
    for intent in ["task", "goal", "person", "project", "research", "correction"]:
        assert intent in TEXT, f"Intent category '{intent}' must be defined"


def test_no_immediate_research_trigger():
    """Research should be queued, not triggered immediately, to avoid mid-conversation API calls."""
    assert "Do not trigger research immediately" in TEXT or \
           "queue" in TEXT.lower(), \
        "Research intent should be queued, not triggered immediately"


def test_tests_declared():
    assert "tests: tests/" in TEXT, "tests field must point to tests/"


def test_task_surfaces_in_briefing():
    """Tasks captured here should surface in the briefing cycle, not be discarded."""
    assert "briefing" in TEXT.lower(), \
        "Skill must document that captured tasks surface in the briefing cycle"
