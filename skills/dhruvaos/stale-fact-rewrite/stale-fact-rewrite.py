#!/usr/bin/env python3
"""
stale-fact-rewrite — nightly pass to detect and update stale GBrain facts.

Compares active GBrain facts against recent entity pages in the brain.
Uses phi4-mini (Ollama, local, free) to evaluate staleness. For clearly
stale facts, expires the old version and inserts an updated version.

Design:
  - Never writes directly to PGLite (uses gbrain CLI only)
  - Sources ANTHROPIC_API_KEY from ~/.hermes/.env (required by gbrain extract_facts)
  - Skips gracefully if Ollama is down or 0 facts exist
  - Acquires a non-blocking lock so concurrent runs skip safely
  - Diagnostic output → stderr; only rewrite/error summaries → stdout
  - Log: ~/.gbrain/stale-fact-rewrites.jsonl

Run: via Hermes cron --no-agent --script at 3:30am (after gbrain dream at 3am).
     Can also be run manually: python3 stale-fact-rewrite.py [--dry-run]
"""

import datetime
import fcntl
import json
import os
import pathlib
import shutil
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.request

GBRAIN = os.environ.get("GBRAIN_BIN") or shutil.which("gbrain") or "/home/dhruva/.bun/bin/gbrain"
HERMES_ENV = pathlib.Path.home() / ".hermes" / ".env"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
LOG_FILE = pathlib.Path.home() / ".gbrain" / "stale-fact-rewrites.jsonl"
# Use the SAME lock file as dream/embed crons (/tmp is cleared on reboot;
# ~/.gbrain/ is persistent and survives across reboots).
# This prevents stale-fact-rewrite from running concurrently with gbrain dream or embed.
LOCK_FILE = pathlib.Path.home() / ".gbrain" / "gbrain-write.lock"
MAX_FACTS = 50          # cap per run; keeps runtime under 5 min
OLLAMA_TIMEOUT = 90     # seconds per LLM call
INTER_CALL_SLEEP = 0.3  # pause between gbrain calls to avoid hammering


def load_hermes_env() -> dict[str, str]:
    """Parse ~/.hermes/.env and return key=value pairs (without quotes)."""
    env = {}
    if not HERMES_ENV.exists():
        return env
    for line in HERMES_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        # Strip a matched outer quote pair only (avoids stripping embedded quotes).
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
            val = val[1:-1]
        if key:
            env[key] = val
    return env


def build_env() -> dict[str, str]:
    """Merge system env + hermes env + ensure bun/gbrain are in PATH."""
    result = dict(os.environ)
    result.update(load_hermes_env())
    # Ensure bun + local bins are in PATH — they're absent in non-login SSH sessions
    extra = ":".join([
        str(pathlib.Path.home() / ".bun" / "bin"),
        str(pathlib.Path.home() / ".nvm" / "versions" / "node" / "v24.16.0" / "bin"),
        str(pathlib.Path.home() / ".local" / "bin"),
        str(pathlib.Path.home() / ".hermes" / "bin"),
    ])
    result["PATH"] = extra + ":" + result.get("PATH", "/usr/bin:/bin")
    return result


def log(entry: dict) -> None:
    entry.setdefault("ts", datetime.datetime.now(datetime.timezone.utc).isoformat())
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def gbrain_call(tool: str, args: dict, env: dict, timeout: int = 30) -> dict:
    r = subprocess.run(
        [GBRAIN, "call", tool, json.dumps(args)],
        capture_output=True, text=True, timeout=timeout, env=env,
    )
    if r.returncode != 0:
        raise RuntimeError(f"gbrain call {tool}: {r.stderr.strip() or f'exit {r.returncode}'}")
    # Find the first JSON object/array in stdout — skips any warning banners gbrain
    # may emit before the actual result.
    stdout = r.stdout
    start = next((i for i, c in enumerate(stdout) if c in ("{", "[")), -1)
    if start < 0:
        raise RuntimeError(f"gbrain call {tool}: no JSON in stdout: {stdout[:200]!r}")
    return json.loads(stdout[start:])


def ollama_generate(prompt: str, model: str = "phi4-mini") -> str:
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 512},
    }).encode()
    req = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
        return json.loads(resp.read()).get("response", "")


def get_entity_page(entity_slug: str, env: dict) -> str:
    """Return page body (≤2000 chars) or '' if not found/error."""
    if not entity_slug:
        return ""
    try:
        r = subprocess.run(
            [GBRAIN, "get", entity_slug],
            capture_output=True, text=True, timeout=10, env=env,
        )
        if r.returncode == 0:
            return r.stdout[:2000]
    except Exception as e:
        log({"event": "entity_page_error", "entity_slug": entity_slug, "error": str(e)})
    return ""


def evaluate_fact(fact: dict, context: str) -> tuple[bool, str, str]:
    """
    Ask phi4-mini: is this fact stale given recent entity context?
    Returns (is_stale, reason, updated_fact_text).
    Returns (False, "", "") on error or uncertainty.
    """
    prompt = textwrap.dedent(f"""\
        You are a personal knowledge auditor. Check if a stored fact is still accurate.

        FACT (id={fact.get("id", "?")}): {fact.get("fact", "")}
        Kind: {fact.get("kind", "fact")}
        Entity: {fact.get("entity_slug") or "unknown"}
        Recorded: {str(fact.get("created_at", ""))[:10]}

        RECENT CONTEXT FROM PERSONAL BRAIN:
        {context[:1400] if context else "(no context available — answer CURRENT if uncertain)"}

        TASK: Is this fact STALE (no longer accurate)?

        Rules:
        - Answer STALE only when context CLEARLY contradicts or supersedes the fact.
        - Future-tense facts ("planning to X", "will attend X", "going to X") are stale
          when context confirms the event already happened or was cancelled.
        - If uncertain → answer CURRENT. Do not guess.
        - Never invent updates — base updates only on what context actually states.

        Respond with valid JSON only, no other text:
        If current: {{"stale": false}}
        If stale:   {{"stale": true, "reason": "one sentence", "updated_fact": "corrected text"}}
    """)

    def _parse_json(text: str) -> dict | None:
        """Extract first JSON object from text, handling markdown code fences."""
        # Strip ```json ... ``` fences if present
        import re as _re
        stripped = _re.sub(r"```(?:json)?\s*", "", text).strip()
        for candidate in (text, stripped):
            s = candidate.find("{")
            e = candidate.rfind("}") + 1
            if s < 0 or e <= s:
                continue
            try:
                data = json.loads(candidate[s:e])
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue
        return None

    try:
        response = ollama_generate(prompt)
        data = _parse_json(response)
        if data is None:
            log({"event": "eval_parse_error", "fact_id": fact.get("id"),
                 "error": "no JSON object found in response"})
            return False, "", ""
        if data.get("stale") and data.get("updated_fact"):
            return True, str(data.get("reason", "")), str(data["updated_fact"])
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        log({"event": "eval_ollama_error", "fact_id": fact.get("id"), "error": str(e)})
        raise  # re-raise Ollama errors so caller can abort the whole run
    return False, "", ""


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    mode_label = "[DRY-RUN] " if dry_run else ""

    # Ensure lock dir exists before trying to open lock file
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Acquire exclusive non-blocking lock — skip if another instance is running
    lock_fd = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("[stale-fact-rewrite] another instance running — skipping", file=sys.stderr, flush=True)
        return

    try:
        _run(dry_run, mode_label, lock_fd)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def _run(dry_run: bool, mode_label: str, _lock_fd) -> None:
    start_ts = datetime.datetime.now()
    print(f"[stale-fact-rewrite] {mode_label}start {start_ts.isoformat()}", file=sys.stderr, flush=True)

    env = build_env()

    if "ANTHROPIC_API_KEY" not in env or not env["ANTHROPIC_API_KEY"]:
        msg = "ERROR: ANTHROPIC_API_KEY not found in ~/.hermes/.env"
        print(f"[stale-fact-rewrite] {msg}", file=sys.stderr, flush=True)
        log({"event": "run_error", "error": "ANTHROPIC_API_KEY missing"})
        print(f"⚠️ stale-fact-rewrite: {msg}", flush=True)  # stdout → Discord
        sys.exit(1)

    # 1. Get active facts
    try:
        result = gbrain_call("recall", {"limit": MAX_FACTS}, env)
        facts = result.get("facts", [])
    except Exception as e:
        msg = f"ERROR fetching facts: {e}"
        print(f"[stale-fact-rewrite] {msg}", file=sys.stderr, flush=True)
        log({"event": "run_error", "error": str(e)})
        print(f"⚠️ stale-fact-rewrite: {msg}", flush=True)  # stdout → Discord
        sys.exit(1)

    n = len(facts)
    print(f"[stale-fact-rewrite] {n} active fact(s) to check", file=sys.stderr, flush=True)

    if n == 0:
        print("[stale-fact-rewrite] no facts yet — run gbrain dream first to extract facts",
              file=sys.stderr, flush=True)
        log({"event": "run_complete", "checked": 0, "rewrites": 0, "errors": 0,
             "duration_s": 0, "dry_run": dry_run})
        return

    # 2. Verify Ollama is reachable — use /api/tags (free list, no inference cost)
    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags")
        with urllib.request.urlopen(req, timeout=10):
            pass
    except (urllib.error.URLError, OSError) as e:
        msg = f"ERROR: Ollama unreachable: {e}"
        print(f"[stale-fact-rewrite] {msg}", file=sys.stderr, flush=True)
        log({"event": "run_error", "error": f"Ollama unreachable: {e}"})
        print(f"⚠️ stale-fact-rewrite: Ollama unreachable — check Ollama service", flush=True)
        sys.exit(1)

    # 3. Evaluate each fact
    rewrites = errors = 0
    for fact in facts:
        fid = fact.get("id", "?")
        try:
            context = get_entity_page(fact.get("entity_slug") or "", env)
            is_stale, reason, updated = evaluate_fact(fact, context)

            if not is_stale:
                continue

            old_text = fact.get("fact", "")
            print(f"[stale-fact-rewrite] {mode_label}STALE #{fid}: {old_text[:70]}", file=sys.stderr, flush=True)
            print(f"  → {updated[:70]}", file=sys.stderr, flush=True)

            if not dry_run:
                # INSERT the updated fact FIRST via extraction pipeline.
                # NOT setting is_dream_generated — that flag skips extraction entirely.
                # Insert-before-expire ensures no fact is permanently lost if the process
                # crashes between the two operations.
                extract_result = gbrain_call("extract_facts", {
                    "turn_text": updated,
                }, env, timeout=60)
                time.sleep(INTER_CALL_SLEEP)

                inserted = extract_result.get("inserted", 0)
                if inserted == 0:
                    log({
                        "event": "rewrite_no_insertion",
                        "fact_id": fid,
                        "old_fact": old_text,
                        "attempted_new_fact": updated,
                        "reason": reason,
                        "extract_result": extract_result,
                    })
                    errors += 1
                    print(f"[stale-fact-rewrite] WARNING #{fid}: extract_facts inserted 0 — old fact preserved, logged", file=sys.stderr, flush=True)
                    continue

                # Expire the old fact only after the replacement is confirmed inserted.
                try:
                    gbrain_call("forget_fact", {
                        "id": int(fid),
                        "reason": f"stale-fact-rewrite: {reason[:120]}",
                    }, env)
                except (TypeError, ValueError):
                    log({"event": "fact_error", "fact_id": fid,
                         "error": f"non-integer fact id, cannot expire: {fid!r}"})
                    errors += 1
                    continue
                time.sleep(INTER_CALL_SLEEP)

            log({
                "event": "rewrite",
                "dry_run": dry_run,
                "fact_id": fid,
                "old_fact": old_text,
                "new_fact": updated,
                "reason": reason,
                "entity_slug": fact.get("entity_slug"),
            })
            rewrites += 1

        except (urllib.error.URLError, OSError):
            # Ollama died mid-run — abort rather than leaving partial state
            print("[stale-fact-rewrite] Ollama connection lost — aborting run", file=sys.stderr, flush=True)
            errors += 1
            break
        except Exception as e:
            print(f"[stale-fact-rewrite] ERROR on #{fid}: {e}", file=sys.stderr, flush=True)
            log({"event": "fact_error", "fact_id": fid, "error": str(e)})
            errors += 1

        time.sleep(INTER_CALL_SLEEP)

    # 4. Summary
    duration = int((datetime.datetime.now() - start_ts).total_seconds())
    log({"event": "run_complete", "checked": n, "rewrites": rewrites,
         "errors": errors, "duration_s": duration, "dry_run": dry_run})

    # Hermes --no-agent: stdout delivery to Discord.
    # Only write to stdout (→ Discord) if something happened.
    # Diagnostic lines above all go to stderr → invisible to Hermes.
    if rewrites:
        print(f"\n🧠 Stale-fact-rewrite: {rewrites} rewrite(s), {errors} error(s) in {duration}s",
              flush=True)
    elif errors:
        print(f"⚠️ stale-fact-rewrite: {errors} error(s) — see {LOG_FILE}", flush=True)
    # 0 rewrites + 0 errors → nothing printed to stdout → Hermes silent delivery


if __name__ == "__main__":
    main()
