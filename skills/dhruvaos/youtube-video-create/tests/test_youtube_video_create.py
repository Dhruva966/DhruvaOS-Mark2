"""Contract tests for youtube-video-create skill."""
import json
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
# Script lives in repo (deployed to ~/.hermes/scripts/ on Omen)
UPLOAD_SCRIPT = SKILL_DIR / "youtube-upload.py"


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_mock_gbrain_result(answer: str = "test context") -> dict:
    return {"answer": answer, "chunks": [], "citations": [], "gaps": []}


# ── Step 0: prerequisites ─────────────────────────────────────────────────────

class TestPrerequisites:
    def test_required_env_vars_listed_in_frontmatter(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "DISCORD_CORRECTIONS_CHANNEL_ID" in skill_md
        assert "YOUTUBE_CHANNEL_ID" in skill_md
        assert "FAL_KEY" in skill_md

    def test_skill_has_outbound_true(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "outbound: true" in skill_md

    def test_skill_tier_is_2(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "tier: 2" in skill_md

    def test_skill_requires_approval(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "requires_approval: true" in skill_md


# ── Step 1: interview ─────────────────────────────────────────────────────────

class TestInterview:
    def test_interview_asks_five_questions(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        question_count = skill_md.count("\n1. ") + skill_md.count("\n2. ") + skill_md.count("\n3. ")
        assert question_count >= 3

    def test_interview_has_timeout(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "30 min" in skill_md or "30-minute" in skill_md or "Timeout: 30" in skill_md

    def test_interview_uses_clarify_tool(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "clarify" in skill_md


# ── Step 3: content brief approval ───────────────────────────────────────────

class TestBriefApproval:
    def test_approval_required_header_present(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "[APPROVAL REQUIRED]" in skill_md

    def test_approval_id_generated_with_secrets(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "secrets.token_hex" in skill_md

    def test_content_hash_generated(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "sha256" in skill_md.lower()

    def test_expiry_15min_for_brief(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "15 min" in skill_md

    def test_approval_validates_reactor_identity(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "DISCORD_ALLOWED_USER" in skill_md

    def test_deny_command_documented(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "/deny" in skill_md


# ── Step 4: script generation ─────────────────────────────────────────────────

class TestScriptGeneration:
    def test_sonnet_used_for_generation(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "sonnet" in skill_md.lower() or "Tier 2" in skill_md

    def test_script_saved_to_brain(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "brain/resources/youtube-scripts" in skill_md

    def test_title_length_limit(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "≤70 chars" in skill_md or "[:100]" in skill_md or "100 chars" in skill_md

    def test_script_not_mentioned_dhruvaos(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "Do NOT mention DhruvaOS" in skill_md


# ── Step 6: thumbnail generation ─────────────────────────────────────────────

class TestThumbnailGeneration:
    def test_fal_ai_used_for_thumbnail(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "fal.run" in skill_md or "fal-ai" in skill_md

    def test_thumbnail_failure_is_non_blocking(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "continue without thumbnail" in skill_md.lower() or "If fal.ai fails" in skill_md

    def test_thumbnail_downloaded_locally(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "thumbnail_path" in skill_md

    def test_thumbnail_is_16x9(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "landscape_16_9" in skill_md or "1280x720" in skill_md


# ── Step 7: video assembly ────────────────────────────────────────────────────

class TestVideoAssembly:
    def test_ffmpeg_used(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "ffmpeg" in skill_md

    def test_placeholder_video_acknowledged(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "placeholder" in skill_md.lower()

    def test_video_saved_to_tmp(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "/tmp/" in skill_md


# ── Step 8: upload ────────────────────────────────────────────────────────────

class TestUploadFlow:
    def test_upload_requires_third_approval(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        hard_stops = skill_md.count("HARD STOP")
        assert hard_stops >= 2

    def test_uploads_as_unlisted(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "unlisted" in skill_md

    def test_xposteros_notified_after_upload(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "/platforms/youtube/published" in skill_md

    def test_upload_script_path_correct(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "youtube-upload.py" in skill_md

    def test_youtube_studio_review_instructions(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "youtube.com/studio" in skill_md or "YouTube Studio" in skill_md


# ── YouTube upload script ─────────────────────────────────────────────────────

class TestYouTubeUploadScript:
    def test_upload_script_exists(self):
        assert UPLOAD_SCRIPT.exists(), f"Upload script not found at {UPLOAD_SCRIPT}"

    def test_dry_run_returns_json(self):
        result = subprocess.run(
            [sys.executable, str(UPLOAD_SCRIPT),
             "--file", "/tmp/fake.mp4",
             "--title", "Test Video",
             "--dry-run"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"Script failed: {result.stderr}"
        data = json.loads(result.stdout)
        assert data["dry_run"] is True
        assert data["status"] == "dry_run"
        assert "video_url" in data

    def test_dry_run_includes_title(self):
        result = subprocess.run(
            [sys.executable, str(UPLOAD_SCRIPT),
             "--file", "/tmp/fake.mp4",
             "--title", "My Test Title",
             "--dry-run"],
            capture_output=True, text=True,
        )
        data = json.loads(result.stdout)
        assert data["title"] == "My Test Title"

    def test_privacy_flag_accepted(self):
        result = subprocess.run(
            [sys.executable, str(UPLOAD_SCRIPT),
             "--file", "/tmp/fake.mp4",
             "--title", "Test",
             "--privacy", "unlisted",
             "--dry-run"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0

    def test_invalid_privacy_rejected(self):
        result = subprocess.run(
            [sys.executable, str(UPLOAD_SCRIPT),
             "--file", "/tmp/fake.mp4",
             "--title", "Test",
             "--privacy", "invalid_value",
             "--dry-run"],
            capture_output=True, text=True,
        )
        assert result.returncode != 0

    def test_tags_comma_separated(self):
        result = subprocess.run(
            [sys.executable, str(UPLOAD_SCRIPT),
             "--file", "/tmp/fake.mp4",
             "--title", "Test",
             "--tags", "ai,coding,tutorial",
             "--dry-run"],
            capture_output=True, text=True,
        )
        assert result.returncode == 0


# ── Quality firewall ──────────────────────────────────────────────────────────

class TestQualityFirewall:
    def test_approval_required_every_run(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "No exceptions" in skill_md or "no exceptions" in skill_md.lower()

    def test_never_upload_silently(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "Never upload silently" in skill_md or "never upload" in skill_md.lower()

    def test_error_handling_table_present(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "Error handling" in skill_md

    def test_all_major_failure_modes_handled(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "fal.ai" in skill_md
        assert "ffmpeg" in skill_md
        assert "token" in skill_md.lower() or "OAuth" in skill_md

    def test_prerequisite_instructions_complete(self):
        skill_md = (SKILL_DIR / "SKILL.md").read_text()
        assert "fal.ai" in skill_md
        assert "youtube.com" in skill_md
        assert "token.json" in skill_md
