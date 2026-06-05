from pathlib import Path


SKILL = Path(__file__).resolve().parents[1] / "SKILL.md"
TEXT = SKILL.read_text()


def test_correction_handler_writes_permanent_rule():
    assert "Permanent rule" in TEXT
    assert "corrections.md" in TEXT
    assert "GBrain indexes" in TEXT
    assert "flock -n /tmp/gbrain-write.lock" in TEXT


def test_correction_handler_classifies_expected_types():
    for label in ("BEHAVIOR", "FACT", "PREFERENCE", "FORMAT"):
        assert label in TEXT


def test_correction_handler_acks_internal_only():
    assert "outbound: false" in TEXT
    assert "No outbound approval is needed" in TEXT
    assert "frontmatter/runtime approval policy" in TEXT
    assert "#corrections" in TEXT


def test_correction_handler_cannot_override_safety_policy():
    assert "Immutable policy filter" in TEXT
    assert "outbound approval gates" in TEXT
    assert "Tier 2+ model routing" in TEXT
