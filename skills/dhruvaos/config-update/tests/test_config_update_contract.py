"""
Contract tests for config-update skill.

Tests verify that the SKILL.md correctly encodes:
- All 8 config files are mapped in the routing table
- The skill uses surgical/targeted edits, not full rewrites
- The skill uses flock for safe GBrain re-ingest
- The skill never requires approval (internal config writes only)
- Confirmation format posts old -> new values
- Error handling covers all failure modes
"""
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1] / "SKILL.md"
TEXT = SKILL.read_text()


# ── Config file routing ───────────────────────────────────────────────────────

CONFIG_FILES = [
    "content-goals.md",
    "approval-timeouts.md",
    "contact-thresholds.md",
    "tweet-format.md",
    "content-format.md",
    "cost-alerts.md",
    "monitoring.md",
    "gbrain-settings.md",
]


def test_all_config_files_are_mapped():
    """Every config file in the spec appears in the routing table."""
    for fname in CONFIG_FILES:
        assert fname in TEXT, f"Config file '{fname}' missing from routing table"


def test_routing_table_covers_trigger_keywords():
    """Key trigger phrases from the frontmatter are covered by the routing table."""
    keywords = [
        "X goal",
        "Twitter goal",
        "LinkedIn goal",
        "approval timeout",
        "contact threshold",
        "tweet format",
        "word count",
        "cost alert",
        "error rate",
        "similarity threshold",
    ]
    for kw in keywords:
        assert kw in TEXT, f"Trigger keyword '{kw}' not present in routing table"


# ── Edit safety ───────────────────────────────────────────────────────────────

def test_skill_requires_surgical_edits_only():
    """Skill must document that it only updates the specific value, not the whole file."""
    assert "Surgical edits only" in TEXT or "surgical edit" in TEXT
    assert "only the specific value" in TEXT or "specific value" in TEXT


def test_skill_does_not_use_sed():
    """sed is explicitly forbidden in favour of the file tool (shell escaping safety)."""
    assert "Do NOT use shell `sed`" in TEXT or "Do not use shell `sed`" in TEXT or "not use" in TEXT and "sed" in TEXT


def test_skill_reads_before_writing():
    """File tool must read current content before writing back to avoid clobber."""
    assert "Read" in TEXT and "Write" in TEXT
    assert "read" in TEXT.lower() and "write" in TEXT.lower()
    # Ensure the pattern of read-modify-write is described
    assert "Read `~/brain/config/" in TEXT or "read the file" in TEXT.lower() or "Read the current" in TEXT


# ── GBrain re-ingest ──────────────────────────────────────────────────────────

def test_skill_uses_flock_for_gbrain_ingest():
    """GBrain write lock must be used to prevent DB collisions during concurrent runs."""
    assert "flock -n ~/.gbrain/gbrain-write.lock" in TEXT


def test_skill_uses_embed_stale_after_import():
    """gbrain embed --stale must run after import so the change is immediately searchable."""
    assert "gbrain embed --stale" in TEXT or "embed --stale" in TEXT


def test_skill_handles_busy_lock_gracefully():
    """If the lock is busy, skill should note it and not fail the whole run."""
    assert "lock" in TEXT and ("busy" in TEXT or "skip" in TEXT.lower())
    assert "2am" in TEXT or "cron" in TEXT  # fallback cron picks it up


# ── Approval / outbound ───────────────────────────────────────────────────────

def test_skill_is_internal_only_no_approval():
    """Config updates are internal file writes — no approval gate needed."""
    assert "requires_approval: false" in TEXT
    assert "outbound: false" in TEXT


def test_skill_does_not_write_to_external_services():
    """No email, LinkedIn, GitHub, or other external writes."""
    for forbidden in ["email_send", "linkedin_post", "github.com", "smtp"]:
        assert forbidden not in TEXT.lower(), f"External service reference '{forbidden}' found"


# ── Confirmation message ──────────────────────────────────────────────────────

def test_confirmation_shows_old_and_new_value():
    """Confirmation message must show what changed (old → new) so Dhruva can verify."""
    assert "old value" in TEXT.lower() or "[old value]" in TEXT
    assert "new value" in TEXT.lower() or "[new value]" in TEXT
    assert "→" in TEXT  # arrow between old and new


def test_confirmation_names_config_file():
    """Confirmation must show which file was changed so Dhruva can find it."""
    assert "brain/config/" in TEXT
    assert "Takes effect on next skill run" in TEXT


# ── Ambiguity and error handling ──────────────────────────────────────────────

def test_skill_asks_before_guessing_ambiguous_file():
    """If the target file is ambiguous, skill must ask instead of guessing."""
    assert "clarif" in TEXT.lower()  # 'clarify' or 'clarification'
    assert "do not guess" in TEXT.lower() or "not guess" in TEXT.lower()


def test_skill_creates_missing_config_file():
    """If a config file does not exist, the skill should create it rather than abort."""
    assert "does not exist" in TEXT.lower() or "not exist" in TEXT
    assert "creat" in TEXT.lower()  # 'create' or 'creating'


def test_skill_handles_invalid_values():
    """Nonsensical values (negative, zero) should prompt confirmation, not silent writes."""
    assert "nonsensical" in TEXT or "invalid" in TEXT.lower()
    assert "confirming" in TEXT or "confirm" in TEXT.lower()


def test_skill_logs_errors_to_hermes_log():
    """Failures must be logged to the standard Hermes skill-errors.log."""
    assert "skill-errors.log" in TEXT


# ── Frontmatter completeness ──────────────────────────────────────────────────

def test_frontmatter_has_required_fields():
    """Frontmatter must include all fields required by Hermes and DhruvaOS conventions."""
    for field in ["name:", "version:", "tier:", "outbound:", "requires_approval:", "description:", "tests:"]:
        assert field in TEXT, f"Frontmatter field '{field}' is missing"


def test_frontmatter_tier_is_1():
    """Config update is a Tier 1 task (GPT-4o-mini level — simple file edits)."""
    assert "tier: 1" in TEXT


def test_frontmatter_gbrain_reads_and_writes_config():
    """gbrain.reads and gbrain.writes must declare the config/ path for parallel safety."""
    assert 'reads: ["config/*"]' in TEXT or "config/*" in TEXT
    assert 'writes: ["config/*"]' in TEXT or "config/*" in TEXT
