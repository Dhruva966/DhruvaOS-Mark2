# Omen Runbook — June 5, 2026

Run this directly on Omen (SSH or local terminal). Each section is independent.
Copy-paste the whole block per section.

**PATH fix (run once at start of every SSH session):**
```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/home/dhruva/.hermes/bin:$PATH"
```

---

## Fix 1 — XPosterOS .env (URGENT — workers fail every 2h)

**Why:** DraftGenerator + XPoster fail with `notion_or_llm_not_configured`.
The 6 Notion DB IDs are set but NOTION_API_KEY (auth token) + LLM keys are missing.

```bash
# Verify the keys are present in hermes .env first:
grep -E "^NOTION_API_KEY=|^ANTHROPIC_API_KEY=" ~/.hermes/.env | sed 's/=.*/=<present>'

# Copy keys to xposteros .env:
NOTION_KEY=$(grep "^NOTION_API_KEY=" ~/.hermes/.env | cut -d= -f2-)
ANTHRO_KEY=$(grep "^ANTHROPIC_API_KEY=" ~/.hermes/.env | cut -d= -f2-)

printf "NOTION_API_KEY=%s\nLLM_DEFAULT_PROVIDER=anthropic\nANTHROPIC_API_KEY=%s\n" \
  "$NOTION_KEY" "$ANTHRO_KEY" >> ~/xposteros/.env

# Restart service:
systemctl --user restart xposteros-api

# Verify:
curl -s http://127.0.0.1:8081/system/health
# Expected: {"status":"ok","dry_run":true,...}

# Optional: run workers now instead of waiting for next 2h cron:
cd ~/xposteros && /home/dhruva/.hermes/bin/uv run python -m workers.runner
# Expected: DraftGenerator shows count (not notion_or_llm_not_configured)
```

---

## Fix 2 — Deploy stale-fact-rewrite

**Why:** Skill is fully built on Mac (SKILL.md + Python script + 7 passing tests) but never deployed.
Nightly 3:30am cron doesn't exist yet.

```bash
# Create target dirs:
mkdir -p ~/.hermes/scripts ~/.hermes/skills/dhruvaos/stale-fact-rewrite

# On Mac first — scp from DhruvaOS repo:
# (run this from Mac terminal, not Omen)
# scp "/Users/dhruvavutukury/DhruvaOS Mark 2/skills/dhruvaos/stale-fact-rewrite/stale-fact-rewrite.py" \
#     dhruva@100.119.229.11:~/.hermes/scripts/stale-fact-rewrite.py
# scp "/Users/dhruvavutukury/DhruvaOS Mark 2/skills/dhruvaos/stale-fact-rewrite/SKILL.md" \
#     dhruva@100.119.229.11:~/.hermes/skills/dhruvaos/stale-fact-rewrite/SKILL.md

# On Omen — after scp completes:
# Verify files arrived:
ls -la ~/.hermes/scripts/stale-fact-rewrite.py
ls -la ~/.hermes/skills/dhruvaos/stale-fact-rewrite/SKILL.md

# Dry-run test (no writes — safe to run anytime):
python3 ~/.hermes/scripts/stale-fact-rewrite.py --dry-run
# Expected: "N active fact(s) to check" (or "no facts yet" if dream hasn't run)

# Register Hermes cron at 3:30am (after dream at 3am):
hermes cron create "30 3 * * *" "Stale fact rewrite pass" \
  --skill stale-fact-rewrite --no-deliver \
  --model ollama/phi4-mini

# Verify cron registered:
hermes cron list | grep stale
```

---

## Fix 3 — Import braindump to GBrain (P4.5 partial)

**Why:** braindump-questions.md has Q1-2 answered with biographical info.
Importing makes GBrain aware of Dhruva's background for all future reasoning.

```bash
# On Mac first — scp the file:
# scp "/Users/dhruvavutukury/DhruvaOS Mark 2/wiki/braindump-questions.md" \
#     dhruva@100.119.229.11:~/brain/daily/braindump-2026-06-05.md

# On Omen — after scp completes:
gbrain import ~/brain/daily/braindump-2026-06-05.md --no-embed
gbrain embed --stale
gbrain onboard --check --json | head -10

# Verify import worked:
gbrain search "Dhruva Vutukury"
# Expected: returns biographical context (Livermore, UCLA, ECE, sister Suma, etc.)

gbrain stats | head -5
# Expected: pages count > previous 45
```

---

## Fix 4 — Verify all deployed skills (after P3.3 quality firewall gate)

```bash
hermes skills list
# Expected: all dhruvaos skills shown as enabled

# Check crons still active:
hermes cron list
# Expected: morning-briefing (8am), evening-briefing (9pm), xposteros-workers (every 2h), stale-fact-rewrite (3:30am)

# Check system crontab (dream, embed, backup):
crontab -l | grep -v "^#"
# Expected: 3 entries at 2am, 3am, 4:30am
```

---

## Fix 5 — P4.7 Brain health check

```bash
# After dream cycle has run at least once (or run manually):
gbrain doctor --remediation-plan --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Score: {d.get(\"score\",\"N/A\")}')"

# If score < 70:
gbrain doctor --remediate --yes --target-score 70 --max-usd 2

# Re-check:
gbrain onboard --check --json
```

---

## P3.3 Quality Firewall Gate (Dhruva does this in Discord)

```
1. Open Discord → #corrections
2. Send: /test-outbound Hello this is a test message
3. Check logs: tail -20 ~/.hermes/logs/gateway.log | grep model
   → Must show: claude-sonnet-4-6
4. Verify: [APPROVAL REQUIRED] preview appears in #corrections
   → Nothing sent to external systems yet
5. React 👍 on the preview → verify action executes
6. Send second test → reply /deny <id> → verify discarded + logged
```

Done condition: gate fires 100% of the time. Mark P3.3 ✅ in BUILD_PLAN.md after passing.

---

## Status after running this runbook

| Check | Command |
|-------|---------|
| XPosterOS healthy | `curl -s http://127.0.0.1:8081/system/health` |
| Workers no longer failing | Run workers → no `notion_or_llm_not_configured` |
| stale-fact-rewrite deployed | `ls ~/.hermes/scripts/stale-fact-rewrite.py` |
| stale-fact-rewrite cron active | `hermes cron list \| grep stale` |
| braindump in GBrain | `gbrain search "Dhruva Vutukury"` returns results |
| All crons active | `hermes cron list && crontab -l` |
