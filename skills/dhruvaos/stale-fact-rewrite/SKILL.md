---
name: stale-fact-rewrite
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Nightly: detect stale GBrain facts using phi4-mini, expire old versions, insert updated facts. Automated at 3:30am via Hermes cron --no-agent. Can also be invoked manually by Drew."
schedule: "30 3 * * *"
author: dhruvaos
platforms: [linux]
gbrain:
  reads: ["*"]
  writes: ["*"]
tests: tests/
metadata:
  hermes:
    tags: [gbrain, dream, maintenance, facts, nightly]
---

# Stale-Fact-Rewrite

You are Drew running a nightly GBrain maintenance pass. This skill detects active facts
that have become stale (outdated or contradicted by recent context) and rewrites them.

This is internal maintenance only. No outbound messages. No approval gate.

Automated path: Hermes cron runs this at 3:30am via `--no-agent --script stale-fact-rewrite.py`.
Manual path: Drew runs it on request by following the steps below.

---

## Step 1 — Run the core script

```bash
export PATH=/home/dhruva/.bun/bin:/home/dhruva/.hermes/bin:/home/dhruva/.local/bin:$PATH
python3 ~/.hermes/scripts/stale-fact-rewrite.py 2>&1
```

Wait for completion. Capture all output (stdout + stderr).

For a dry-run (no writes, preview only):
```bash
python3 ~/.hermes/scripts/stale-fact-rewrite.py --dry-run 2>&1
```

---

## Step 2 — Parse results

From the output, extract:
- Total facts checked (line: `N active fact(s) to check`)
- Number of STALE facts found (lines starting with `STALE #`)
- Number of rewrites (from summary line `🧠 Stale-fact-rewrite: N rewrite(s)`)
- Number of errors

---

## Step 3 — Report to Discord

**If 0 rewrites and 0 errors**: stay silent. Do NOT post anything to Discord.

**If any rewrites occurred**: post a brief summary to #logs:

```
🧠 Stale-fact-rewrite: {N} rewrite(s)
{list each: old fact → new fact, one per line, max 5 shown}
```

**If errors occurred**: post to #alerts:

```
⚠️ stale-fact-rewrite: {N} error(s) — check ~/.gbrain/stale-fact-rewrites.jsonl
```

---

## Notes

- Script location: `~/.hermes/scripts/stale-fact-rewrite.py`
- Log file: `~/.gbrain/stale-fact-rewrites.jsonl`
- Max facts per run: 50 (by design — keeps runtime under 5 minutes)
- Model: phi4-mini via Ollama (local, free, ~90s timeout per fact)
- API key: sourced automatically from `~/.hermes/.env`
- Never writes directly to `~/.gbrain/brain.pglite/`
- Uses `gbrain call forget_fact` + `gbrain call extract_facts` for all updates

## Error Handling

| Failure | Action |
|---------|--------|
| Script not found | Post error to #alerts, stop |
| phi4-mini (Ollama) offline | Script logs error; 0 rewrites → silent exit |
| gbrain-write.lock busy | Script exits non-zero; log, do not retry until next nightly run |
| 0 rewrites, 0 errors | Silent exit — no Discord post |
| Errors in rewrite script | Post count to #alerts |

## Done Condition

Skill is complete when:
1. `stale-fact-rewrite.py` has run to completion (or failed with logged output)
2. If 0 rewrites and 0 errors: silent exit
3. If rewrites: summary posted to #logs (or whichever log channel is active)
4. If errors: error count posted to #alerts
