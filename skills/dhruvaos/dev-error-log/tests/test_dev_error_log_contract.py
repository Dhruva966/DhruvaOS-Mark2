"""
Contract tests for dev-error-log SKILL.md.
"""

import pathlib
import re

SKILL_PATH = pathlib.Path(__file__).parent.parent / "SKILL.md"
TEXT = SKILL_PATH.read_text()


def test_skill_file_exists():
    assert SKILL_PATH.exists()


def test_required_frontmatter_fields():
    for field in ["name:", "tier:", "outbound:", "requires_approval:", "description:", "tests:"]:
        assert field in TEXT, f"Missing: {field}"


def test_tier_0_no_outbound():
    assert "tier: 0" in TEXT
    assert "outbound: false" in TEXT


def test_manual_trigger():
    assert "manual" in TEXT.lower()


def test_no_approval():
    assert "requires_approval: false" in TEXT


def test_gbrain_writes_declared():
    assert "gbrain:" in TEXT
    assert "writes:" in TEXT
    assert "dev/error-log.md" in TEXT


def test_error_categories_present():
    for tag in ["model-deprecation", "auth", "security", "config", "cron", "gbrain", "hermes"]:
        assert tag in TEXT, f"Missing tag category: {tag}"


def test_records_failed_fixes():
    text_lower = TEXT.lower()
    assert "failed fix" in text_lower or "failed_fix" in text_lower or "didn't work" in text_lower


def test_records_working_fix():
    text_lower = TEXT.lower()
    assert "working fix" in text_lower or "fix that worked" in text_lower or "working_fix" in text_lower


def test_records_root_cause():
    assert "root_cause" in TEXT or "root cause" in TEXT.lower()


def test_records_timestamp():
    assert "timestamp" in TEXT.lower() or "datetime" in TEXT.lower()


def test_reverse_chronological_order():
    assert "reverse" in TEXT.lower() or "prepend" in TEXT.lower()


def test_writes_to_brain_dev():
    assert "~/brain/dev/error-log.md" in TEXT or "brain/dev/error-log.md" in TEXT


def test_example_entry_present():
    assert "## Example Entry" in TEXT or "example" in TEXT.lower()


def test_no_hardcoded_credentials():
    assert "sk-" not in TEXT
    assert "Bearer " not in TEXT or "Bearer token" in TEXT


def test_tests_declared():
    assert "tests: tests/" in TEXT
