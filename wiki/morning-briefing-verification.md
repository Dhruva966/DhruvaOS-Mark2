# Morning Briefing Verification — June 5, 2026

## Expected behavior at 8:00 AM PST

Hermes should post **4 separate Discord messages** to #briefings in order:

1. **Header + Calendar** — "Good morning, Dhruva. [date]" + today's events + next 3 days
2. **Inbox** — Email action items (top 5 ACTION_REQUIRED) + FYI/newsletter count
3. **Tasks** — Top 5 tasks from GBrain
4. **Research + Footer** — 1-2 news items from Exa + any error notes

## If it doesn't fire

Check logs:
```bash
ssh dhruva@100.119.229.11 "tail -100 ~/.hermes/logs/gateway.log | grep -A5 'morning'"
```

Common issues and fixes:

### Issue: Cron job didn't trigger
Check job status:
```bash
ssh dhruva@100.119.229.11 "PATH=/home/dhruva/.local/bin:$PATH && hermes cron list"
```
Expected: `e5c41a6e8f1f [active]` with `Next run: 2026-06-05T08:00:00-07:00`

If `state: paused`: 
```bash
ssh dhruva@100.119.229.11 "PATH=/home/dhruva/.local/bin:$PATH && hermes cron resume e5c41a6e8f1f"
```

### Issue: Skill not found
```bash
ssh dhruva@100.119.229.11 "PATH=/home/dhruva/.local/bin:$PATH && hermes skills list | grep morning"
```
If missing: re-run `scp skills/dhruvaos/morning-briefing/SKILL.md dhruva@10.0.0.31:~/.hermes/skills/dhruvaos/morning-briefing/SKILL.md`

### Issue: Gmail/Calendar auth failed
The briefing should still post with error sections. Look for "⚠️ Calendar unavailable" or "⚠️ Inbox unavailable" in the briefing.

Test credentials manually:
```bash
ssh dhruva@100.119.229.11 "set -a; source ~/.hermes/.env; set +a; source ~/.hermes/hermes-agent/venv/bin/activate && python3 ~/.hermes/scripts/google_api_helper.py test"
```
Expected: `OK — token valid, expires: 2026-06-05 xx:xx`

### Issue: Nothing in #briefings at all
1. Check Hermes is running: `ssh dhruva@100.119.229.11 "systemctl --user status hermes-gateway"`
2. Check GBrain is running: `ssh dhruva@100.119.229.11 "bash -s" < scripts/health-check.sh`
3. Trigger briefing manually: in Discord, send to Drew: `morning briefing`

## Testing other skills

Once briefing is verified, test other Phase 2/3 commands:

```
In Discord #tasks:
/task "test task due tomorrow"
→ Expect: "✅ Task added: test task due tomorrow"

In Discord #research:
/research DhruvaOS AI agent architecture
→ Expect: 🔬 Research results in #research channel

In Discord #corrections:
/correct When I say /research, keep summaries under 5 bullet points
→ Expect: "✅ Understood. [summary of correction]"
```

## Notion Tasks DB note

Current NOTION_TASKS_DB_ID (`d5257e87`) is a Snoopy AI database with wrong schema.

To create proper Tasks DB:
1. Open Notion → New page → Turn into Database (full page)
2. Add columns: Name (title), Status (status type — NOT select), Priority (select: Low/Normal/High), Due (date), Source (select: Discord/Manual)
3. "..." menu → "Add connections" → "Hermes Agent" integration
4. Copy the DB ID from the URL (hex after the last `/`)
5. SSH to Omen: `echo 'NOTION_TASKS_DB_ID=<new-id>' >> ~/.hermes/.env`
6. Restart Hermes: `systemctl --user restart hermes-gateway`
