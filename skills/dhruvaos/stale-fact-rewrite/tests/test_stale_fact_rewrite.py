"""
Contract and unit tests for stale-fact-rewrite.

Tests verify:
1. SKILL.md contract (required fields, safety invariants)
2. Python script logic (env loading, evaluate_fact, log format) — all external
   calls mocked; no real Ollama or gbrain calls.

Run: uvx pytest skills/dhruvaos/stale-fact-rewrite/tests/ -q
"""

import importlib.util
import json
import sys
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch


SKILL_DIR = Path(__file__).resolve().parents[1]
SKILL_TEXT = (SKILL_DIR / "SKILL.md").read_text()

# Load the script module without executing main()
_spec = importlib.util.spec_from_file_location(
    "stale_fact_rewrite", SKILL_DIR / "stale-fact-rewrite.py"
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]


# ─────────────────────────────────────── SKILL.md contract tests

class TestSkillContract:
    def test_required_frontmatter_fields(self):
        assert "name: stale-fact-rewrite" in SKILL_TEXT
        assert "requires_approval: false" in SKILL_TEXT
        assert "outbound: false" in SKILL_TEXT
        assert "tier: 0" in SKILL_TEXT

    def test_uses_correct_script_name(self):
        assert "stale-fact-rewrite.py" in SKILL_TEXT

    def test_silent_on_zero_rewrites(self):
        # Skill must not post to Discord when nothing changed
        assert "stay silent" in SKILL_TEXT
        assert "Do NOT post" in SKILL_TEXT

    def test_no_direct_pglite_access_mentioned(self):
        # Skill body must not reference the PGLite path as a direct write target
        assert "brain.pglite/" not in SKILL_TEXT.replace("~/.gbrain/brain.pglite/", "")
        # The note "Never writes directly to ~/.gbrain/brain.pglite/" is allowed
        # as documentation; what's forbidden is instructing Drew to write there.

    def test_uses_gbrain_cli_not_direct_db(self):
        assert "gbrain call" in SKILL_TEXT

    def test_dry_run_option_documented(self):
        assert "--dry-run" in SKILL_TEXT

    def test_log_file_documented(self):
        assert "stale-fact-rewrites.jsonl" in SKILL_TEXT


# ─────────────────────────────────────── Python script unit tests

class TestLoadHermesEnv:
    def test_parses_key_value_pairs(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("ANTHROPIC_API_KEY=sk-test-123\nOPENAI_API_KEY=sk-oai\n")
        with patch.object(_mod, "HERMES_ENV", env_file):
            result = _mod.load_hermes_env()
        assert result["ANTHROPIC_API_KEY"] == "sk-test-123"
        assert result["OPENAI_API_KEY"] == "sk-oai"

    def test_strips_quotes(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text('KEY="quoted_value"\nKEY2=\'single_quoted\'\n')
        with patch.object(_mod, "HERMES_ENV", env_file):
            result = _mod.load_hermes_env()
        assert result["KEY"] == "quoted_value"
        assert result["KEY2"] == "single_quoted"

    def test_skips_comments_and_blanks(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("# comment\n\nKEY=val\n")
        with patch.object(_mod, "HERMES_ENV", env_file):
            result = _mod.load_hermes_env()
        assert "# comment" not in result
        assert result == {"KEY": "val"}

    def test_returns_empty_if_file_missing(self, tmp_path):
        with patch.object(_mod, "HERMES_ENV", tmp_path / "nonexistent.env"):
            result = _mod.load_hermes_env()
        assert result == {}


class TestEvaluateFact:
    def _fact(self, **kwargs):
        defaults = {"id": 42, "fact": "Dhruva is planning to attend WeaveHacks",
                    "kind": "commitment", "entity_slug": "dhruva-vutukury",
                    "created_at": "2026-05-01T00:00:00Z"}
        defaults.update(kwargs)
        return defaults

    def test_returns_stale_when_ollama_says_so(self):
        ollama_resp = json.dumps({
            "stale": True,
            "reason": "context shows Dhruva already attended",
            "updated_fact": "Dhruva attended WeaveHacks on June 6-7, 2026",
        })
        with patch.object(_mod, "ollama_generate", return_value=ollama_resp):
            is_stale, reason, updated = _mod.evaluate_fact(self._fact(), "", False)
        assert is_stale is True
        assert updated == "Dhruva attended WeaveHacks on June 6-7, 2026"

    def test_returns_current_when_ollama_says_not_stale(self):
        ollama_resp = json.dumps({"stale": False})
        with patch.object(_mod, "ollama_generate", return_value=ollama_resp):
            is_stale, _, _ = _mod.evaluate_fact(self._fact(), "", False)
        assert is_stale is False

    def test_returns_current_on_malformed_json(self):
        with patch.object(_mod, "ollama_generate", return_value="not json at all"):
            is_stale, _, _ = _mod.evaluate_fact(self._fact(), "", False)
        assert is_stale is False

    def test_returns_current_when_stale_but_no_updated_fact(self):
        # stale=true without updated_fact → treat as current (can't update blindly)
        ollama_resp = json.dumps({"stale": True, "reason": "outdated", "updated_fact": None})
        with patch.object(_mod, "ollama_generate", return_value=ollama_resp):
            is_stale, _, _ = _mod.evaluate_fact(self._fact(), "", False)
        assert is_stale is False

    def test_re_raises_ollama_connection_error(self):
        import urllib.error
        with patch.object(_mod, "ollama_generate",
                          side_effect=urllib.error.URLError("connection refused")):
            try:
                _mod.evaluate_fact(self._fact(), "", False)
                # Should re-raise — if we get here, test fails
                assert False, "expected URLError to propagate"
            except urllib.error.URLError:
                pass  # correct


class TestLogEntry:
    def test_log_writes_valid_jsonl(self, tmp_path):
        log_path = tmp_path / "rewrites.jsonl"
        with patch.object(_mod, "LOG_FILE", log_path):
            _mod.log({"event": "rewrite", "fact_id": 1, "old_fact": "old", "new_fact": "new"})
        line = log_path.read_text().strip()
        data = json.loads(line)
        assert data["event"] == "rewrite"
        assert "ts" in data  # timestamp auto-added


class TestRunNoFacts:
    def test_exits_cleanly_with_no_facts(self, tmp_path, capsys):
        log_path = tmp_path / "rewrites.jsonl"
        lock_path = tmp_path / "lock"
        with (
            patch.object(_mod, "LOG_FILE", log_path),
            patch.object(_mod, "LOCK_FILE", lock_path),
            patch.object(_mod, "build_env", return_value={"ANTHROPIC_API_KEY": "sk-test"}),
            patch.object(_mod, "gbrain_call", return_value={"facts": []}),
        ):
            _mod._run(dry_run=False, mode_label="", _lock_fd=None)

        captured = capsys.readouterr()
        assert "no facts yet" in captured.out
        log_data = json.loads(log_path.read_text().strip())
        assert log_data["checked"] == 0
        assert log_data["rewrites"] == 0
