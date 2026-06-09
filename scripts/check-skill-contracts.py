#!/usr/bin/env python3
"""Static DhruvaOS skill contract checks.

This is intentionally dependency-free. It does not prove that Hermes will execute a
skill correctly, but it catches the highest-risk drift seen in docs and prompts.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / "skills" / "dhruvaos"
LEGACY_DIR = ROOT / "skills"
SCALAR_KEYS = ("name", "tier", "outbound", "requires_approval")


def frontmatter(text: str) -> dict[str, str]:
    if text.startswith("---\n"):
        start = 4
        end = text.find("\n---", start)
        if end == -1:
            return {}
        block = text[start:end]
    else:
        # Legacy skills/*.yaml files start with scalar YAML and then `---`.
        end = text.find("\n---")
        block = text[:end] if end != -1 else text
    data: dict[str, str] = {}
    for line in block.splitlines():
        if not line or line.startswith(" ") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"')
    return data


def fail(failures: list[str], path: Path, message: str) -> None:
    failures.append(f"{path.relative_to(ROOT)}: {message}")


def check_skill(path: Path, failures: list[str]) -> None:
    text = path.read_text()
    meta = frontmatter(text)
    name = meta.get("name", path.parent.name)

    for required in ("name", "description"):
        if not meta.get(required):
            fail(failures, path, f"missing required frontmatter `{required}`")
    tests_path = meta.get("tests")
    if tests_path and tests_path != "null":
        resolved_tests = path.parent / tests_path
        if not resolved_tests.exists():
            fail(failures, path, f"declared tests path does not exist: `{tests_path}`")

    tier_raw = meta.get("tier", "0")
    try:
        tier = int(tier_raw)
    except ValueError:
        fail(failures, path, f"invalid tier `{tier_raw}`")
        tier = 0

    outbound = meta.get("outbound") == "true"
    requires_approval = meta.get("requires_approval") == "true"
    if outbound and (tier < 2 or not requires_approval):
        fail(failures, path, "outbound skill must be tier >=2 and requires_approval: true")

    if re.search(r"150703\d+", text):
        fail(failures, path, "hard-coded Discord channel ID; use DISCORD_*_CHANNEL_ID")

    lower = text.lower()

    # Any skill whose frontmatter declares writes to GBrain must mention the
    # single-writer / flock contract somewhere in its body or constraints.
    declares_gbrain_writes = "writes:" in text and bool(
        re.search(r"writes:\s*\[[^\]]*[a-zA-Z]", text)
    )
    if declares_gbrain_writes:
        mentions_lock = any(
            needle in lower
            for needle in ("flock", "single-writer", "single writer", "write lock", "gbrain-write.lock")
        )
        if not mentions_lock:
            fail(failures, path, "skill declares GBrain writes but missing flock / single-writer contract reference")

    # Conceptual constraint checks — skills now describe rules in prose, not specific
    # implementations. Verify the IDEA survives, not the wording.
    if name == "add-task":
        # Must mention JSON-encoding user input to prevent injection.
        mentions_json_encode = ("json" in lower) and (
            "inject" in lower or "interpolat" in lower or "encode" in lower
        )
        if not mentions_json_encode:
            fail(failures, path, "add-task missing JSON-encoded-input / injection-prevention guard")

    if name == "research-synthesis":
        # Must mention slug sanitization AND keeping output inside ~/brain/resources/.
        mentions_slug = ("slug" in lower) or ("sanitiz" in lower)
        mentions_resources_path = "brain/resources" in text
        if not (mentions_slug and mentions_resources_path):
            fail(failures, path, "research-synthesis missing slug-sanitize / ~/brain/resources/ path guard")

    if name == "correction-handler":
        # Must mention an immutable / policy filter AND that it protects approval gates.
        mentions_policy = ("immutable" in lower) or ("policy filter" in lower) or ("safety policy" in lower)
        mentions_approval = "approval" in lower
        if not (mentions_policy and mentions_approval):
            fail(failures, path, "correction-handler missing immutable policy filter / approval-gate guard")

    if name == "connection-detector":
        # Must mention the 20-minute stale-fact-rewrite guard and Discord silence.
        mentions_guard = "stale-fact-rewrite" in lower or "stale_fact_rewrite" in lower
        mentions_silent = "silent" in lower or "no discord" in lower
        if not (mentions_guard and mentions_silent):
            fail(failures, path, "connection-detector missing stale-fact-rewrite guard / silence contract")


def check_legacy_drift(path: Path, failures: list[str]) -> None:
    legacy = LEGACY_DIR / f"{path.parent.name}.yaml"
    if not legacy.exists():
        return
    deployed_meta = frontmatter(path.read_text())
    legacy_text = legacy.read_text()
    legacy_meta = frontmatter(legacy_text)
    for key in SCALAR_KEYS:
        if key in legacy_meta and key in deployed_meta and legacy_meta[key] != deployed_meta[key]:
            fail(
                failures,
                legacy,
                f"legacy `{key}: {legacy_meta[key]}` drifts from deployed `{deployed_meta[key]}`",
            )
    if re.search(r"\b(AgentQL|Firecrawl)\b", legacy_text):
        fail(failures, legacy, "legacy stub references retired AgentQL/Firecrawl research path")


def main() -> int:
    failures: list[str] = []
    skill_paths = sorted(SKILLS_DIR.glob("*/SKILL.md"))
    if not skill_paths:
        print("FAIL: no deployed skills found", file=sys.stderr)
        return 1

    for path in skill_paths:
        check_skill(path, failures)
        check_legacy_drift(path, failures)

    if failures:
        print("Skill contract check failed:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print(f"PASS: {len(skill_paths)} deployed skill contracts clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
