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

    if re.search(r"\b(?:gbrain|\$GBRAIN_BIN) (import|embed|dream|apply-migrations|upgrade)\b", text):
        if "flock -n /tmp/gbrain-write.lock" not in text:
            fail(failures, path, "GBrain write command is missing shared flock lock")

    if name == "add-task":
        for needle in ("TASK_PAYLOAD_B64", "base64.b64decode", "Do **not** substitute raw task text"):
            if needle not in text:
                fail(failures, path, f"add-task missing JSON injection guard `{needle}`")

    if name == "research-synthesis":
        for needle in ('re.sub(r"[^a-z0-9]+"', "Path(\"~/brain/resources\").expanduser().resolve()", "Unsafe research output path"):
            if needle not in text:
                fail(failures, path, f"research-synthesis missing safe slug/path guard `{needle}`")

    if name == "correction-handler":
        for needle in ("Immutable policy filter", "outbound approval gates", "Tier 2+ model routing"):
            if needle not in text:
                fail(failures, path, f"correction-handler missing immutable policy guard `{needle}`")


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
