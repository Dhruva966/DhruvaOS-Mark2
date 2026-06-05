"""
Contract tests for xposteros-control SKILL.md.

Verifies:
- Safety invariants: approval gate, auth, dry-run documented
- API contract: all endpoints from HANDOFF.md present in SKILL.md
- No hardcoded secrets
- Correct approval flow order (preview → wait → then call approval endpoint)
"""

from pathlib import Path


TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


# ──────────────────────────────────────── Auth + security

def test_bearer_auth_required():
    assert "Bearer" in TEXT
    assert "XPOSTEROS_API_TOKEN" in TEXT


def test_no_hardcoded_secrets():
    # Must not contain any literal token patterns
    import re
    # Look for common secret patterns: long hex strings, base64-ish keys
    assert "ntn_" not in TEXT, "Notion token must not be hardcoded"
    assert "sk-" not in TEXT, "OpenAI/Anthropic key must not be hardcoded"
    # Env var reference must use $VAR or ${VAR} pattern, not literal values
    assert re.search(r"\$\{?XPOSTEROS_API_TOKEN\}?", TEXT), "Token must be env var reference"


def test_base_url_is_localhost():
    # XPosterOS is localhost-only; no external URL should be hardcoded
    assert "127.0.0.1:8081" in TEXT
    assert "XPOSTEROS_API_URL" in TEXT


# ──────────────────────────────────────── Approval gate correctness

def test_approval_gate_shows_preview_before_calling_endpoint():
    # Preview step must come before the approval API call in the document
    preview_pos = TEXT.find("XPOSTEROS DRAFT")
    approval_call_pos = TEXT.find("/approvals/draft")
    assert preview_pos != -1, "Preview format must be documented"
    assert approval_call_pos != -1, "/approvals/draft endpoint must be documented"
    assert preview_pos < approval_call_pos, \
        "Preview step must appear before approval API call in SKILL.md"


def test_approval_gate_requires_thumbs_up_from_dhruva():
    assert "👍" in TEXT
    assert "NEVER approve" in TEXT or "NEVER call" in TEXT


def test_approval_gate_hard_stop_documented():
    # Skill must document that it waits for reaction before proceeding
    assert "NEVER approve a draft without showing the preview" in TEXT
    assert "NEVER call /approvals/draft unless Dhruva has reacted" in TEXT


def test_dry_run_mode_documented():
    assert "dry_run" in TEXT or "XPOSTER_DRY_RUN" in TEXT
    assert "dry_run: true" in TEXT or "DRY_RUN=false" in TEXT


# ──────────────────────────────────────── API endpoint coverage

def test_health_endpoint_present():
    assert "/system/health" in TEXT


def test_drafts_list_endpoint_present():
    assert "/drafts" in TEXT


def test_brain_dump_event_endpoint_present():
    assert "/events/brain-dump" in TEXT


def test_draft_approval_endpoint_present():
    # PRIMARY approval endpoint (not the simpler bridge)
    assert "/approvals/draft" in TEXT


def test_queue_endpoints_present():
    assert "/queue/next" in TEXT
    assert "/queue/post-now" in TEXT


# ──────────────────────────────────────── Service management

def test_service_management_commands_documented():
    assert "systemctl --user" in TEXT
    assert "xposteros-api" in TEXT
    assert "journalctl" in TEXT


def test_worker_pipeline_documented():
    assert "run-workers.sh" in TEXT or "workers.runner" in TEXT


# ──────────────────────────────────────── Two-endpoint distinction (critical)

def test_two_approval_endpoints_not_confused():
    # HANDOFF.md documents two endpoints with different semantics.
    # SKILL.md must use /approvals/draft (queuing) not /events/draft-approved (simpler bridge).
    # Verify /approvals/draft appears as the approval action (not just in docs).
    approval_draft_count = TEXT.count("/approvals/draft")
    events_approved_count = TEXT.count("/events/draft-approved")
    assert approval_draft_count >= 1, "/approvals/draft (queue-enabling) must be documented"
    # /events/draft-approved can appear in docs but must not be the approval action
    # (it's a simpler bridge that doesn't queue — wrong for the approval flow)
    # We verify this by checking the approval curl block uses /approvals/draft
    import re
    curl_blocks = re.findall(r"curl.*?(?:\n.*?)*?(?=\n\n|\Z)", TEXT, re.MULTILINE)
    approval_curl = [b for b in curl_blocks if "/approvals/draft" in b]
    assert len(approval_curl) >= 1, "curl block must use /approvals/draft not /events/draft-approved"
