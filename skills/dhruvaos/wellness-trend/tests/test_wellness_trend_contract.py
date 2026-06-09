"""Structural contract test for the `wellness-trend` skill.

Skills are now goal + context + constraints, not scripts. This test verifies
structural integrity via the shared helper in conftest.py. Implementation
details (which APIs are called, what wording is used) are intentionally not
asserted — they belong to the agent's runtime judgment, not the contract.

Deeper rules — security guards, GBrain single-writer requirement, outbound
approval gates — are enforced by `scripts/check-skill-contracts.py`, which
runs in CI and via the health check.
"""

from conftest import assert_skill_structure


def test_wellness_trend_structure():
    assert_skill_structure("wellness-trend")
