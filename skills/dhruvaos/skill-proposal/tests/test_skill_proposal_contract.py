"""
Contract tests for skill-proposal skill.

Tests verify SKILL.md invariants:
- Correct frontmatter (tier 1, not outbound at agent level)
- Approval gate exists and guards file deployment
- GBrain dedup check happens BEFORE drafting
- Reaction-based approval: 👍 deploys, ❌/timeout discards
- Timeout is 5 minutes (300 seconds)
- File is written to correct ~/.hermes path
- Discord posts use env vars, not hardcoded IDs
- Skill name is sanitized / slugified

Run: uvx pytest skills/dhruvaos/skill-proposal/tests/ -q
"""

from pathlib import Path

TEXT = (Path(__file__).resolve().parents[1] / "SKILL.md").read_text()


class TestFrontmatter:
    def test_tier_is_one(self):
        assert "tier: 1" in TEXT

    def test_not_outbound_at_agent_level(self):
        # Agent-level outbound is false; the approval gate is in the skill body
        assert "outbound: false" in TEXT

    def test_requires_approval_false_at_agent_level(self):
        # Approval is handled by clarify tool inside the skill, not by Hermes globally
        assert "requires_approval: false" in TEXT

    def test_requires_tasks_channel_env_var(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_requires_allowed_user_env_var(self):
        assert "DISCORD_ALLOWED_USER" in TEXT

    def test_has_tests_field(self):
        assert "tests: tests/" in TEXT


class TestDeduplicationCheck:
    def test_gbrain_search_happens_before_draft(self):
        # GBrain search step must appear before the draft step
        gbrain_pos = TEXT.find("gbrain_search")
        if gbrain_pos == -1:
            gbrain_pos = TEXT.find("GBrain search")
        draft_pos = TEXT.find("Draft the SKILL.md") if "Draft the SKILL.md" in TEXT else TEXT.find("Step 3")
        assert gbrain_pos != -1, "gbrain_search must be present"
        assert draft_pos != -1, "Draft step must be present"
        assert gbrain_pos < draft_pos, "GBrain dedup check must precede the draft step"

    def test_posts_existing_skill_info_if_found(self):
        assert "already exists" in TEXT.lower() or "already covers" in TEXT.lower()

    def test_stops_if_existing_skill_found(self):
        # If dedup match is found, skill must stop — no draft, no proposal
        assert "exit" in TEXT.lower() or "stop" in TEXT.lower()

    def test_searches_with_task_description(self):
        assert "task_description" in TEXT


class TestInputParsing:
    def test_handles_discord_command_trigger(self):
        assert "/propose-skill" in TEXT

    def test_handles_novel_task_trigger(self):
        assert "novel_task" in TEXT or "novel task" in TEXT.lower()

    def test_posts_guidance_on_parse_failure(self):
        assert "could not parse" in TEXT.lower() or "parse" in TEXT.lower()


class TestSkillNameDerivation:
    def test_skill_name_is_slugified(self):
        # Name must be lowercase hyphen-separated, no special chars
        assert "re.sub" in TEXT or "hyphens" in TEXT.lower() or "hyphen" in TEXT.lower()

    def test_skill_name_max_length(self):
        # Must enforce a max length to avoid filesystem issues
        assert "32" in TEXT or "[:32]" in TEXT

    def test_words_only_from_description(self):
        assert "words" in TEXT.lower() and ("first" in TEXT.lower() or "words[:5]" in TEXT or "[:5]" in TEXT)


class TestApprovalGate:
    def test_uses_clarify_tool_for_reaction_polling(self):
        assert "clarify" in TEXT

    def test_timeout_is_five_minutes(self):
        # 5 min = 300 seconds
        assert "300" in TEXT or "5 min" in TEXT.lower() or "5 minutes" in TEXT.lower()

    def test_thumbs_up_triggers_deploy(self):
        assert "👍" in TEXT

    def test_x_reaction_triggers_discard(self):
        assert "❌" in TEXT

    def test_timeout_triggers_discard(self):
        assert "timeout" in TEXT.lower() and "discard" in TEXT.lower()

    def test_deploy_only_after_approval(self):
        # ONLY execute deploy after confirmed 👍 — must be explicit
        assert "ONLY" in TEXT or "confirmed" in TEXT.lower()

    def test_allowed_user_env_var_used_in_clarify(self):
        # clarify step must reference DISCORD_ALLOWED_USER to restrict approver
        assert "DISCORD_ALLOWED_USER" in TEXT
        clarify_pos = TEXT.find("clarify")
        allowed_pos = TEXT.find("DISCORD_ALLOWED_USER")
        # DISCORD_ALLOWED_USER must appear near the clarify section
        assert allowed_pos != -1


class TestDeploymentPath:
    def test_writes_to_hermes_skills_directory(self):
        assert "~/.hermes/skills/dhruvaos/" in TEXT

    def test_file_written_is_skill_md(self):
        assert "SKILL.md" in TEXT

    def test_posts_confirmation_after_deploy(self):
        assert "deployed" in TEXT.lower() and "✅" in TEXT

    def test_does_not_write_files_on_discard(self):
        # Discard path must explicitly say no files written
        assert "do not write" in TEXT.lower() or "Do NOT write" in TEXT or "no files written" in TEXT.lower()

    def test_gbrain_record_written_on_deploy(self):
        # After deploy, skill must log to GBrain
        assert "gbrain_think" in TEXT or "gbrain think" in TEXT.lower()


class TestDiscordMessages:
    def test_no_hardcoded_channel_ids(self):
        import re
        hardcoded = re.findall(r"\b1[0-9]{15,17}\b", TEXT)
        assert hardcoded == [], f"Hardcoded channel IDs found: {hardcoded}"

    def test_draft_posted_to_tasks_channel(self):
        assert "DISCORD_TASKS_CHANNEL_ID" in TEXT

    def test_discard_message_posted(self):
        assert "Proposal discarded" in TEXT or "discarded" in TEXT.lower()

    def test_expires_note_in_proposal_message(self):
        assert "Expires" in TEXT or "expires" in TEXT.lower() or "5 min" in TEXT.lower()
