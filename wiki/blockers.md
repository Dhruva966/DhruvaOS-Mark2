# DhruvaOS Blockers — Action Required When Awake

_Last updated: 2026-06-05 (overnight autonomous session)_

---

## P1 Remaining Actions (Dhruva does these)

### 1. Tailscale ✅ DONE — Authenticated

Omen IP: `<TAILSCALE_IP>` | Hostname: `dhruva-omen-by-hp-laptop-15-dh1xxx`
SSH from anywhere: `ssh dhruva@<TAILSCALE_IP>`

---

### 2. Cloudflare Tunnel — Free URL (Changes on Restart)

Current trycloudflare.com URL (ephemeral — changes each PM2 restart):

```
https://inner-sunglasses-responsibility-ringtones.trycloudflare.com
```

To use for SSH from outside LAN (until Tailscale is authorized):
- Client needs cloudflared installed
- Add to `~/.ssh/config` on client:
  ```
  Host omen-tunnel
    ProxyCommand cloudflared access ssh --hostname inner-sunglasses-responsibility-ringtones.trycloudflare.com
    User dhruva
  ```

**Use Tailscale instead once auth done — stable hostname, no URL changes.**

---

### 3. Notion Databases — Create Manually in UI

Notion integration token already in `~/.hermes/.env` as `NOTION_TOKEN` and `NOTION_API_KEY`.
Tasks DB ID already set: `NOTION_TASKS_DB_ID=d5257e87-f58d-4dc4-ae2f-4b969af052e7` (existing Snoopy AI schema).

**TODO:** Create proper DhruvaOS Tasks DB with correct schema:
- Fields: Title (title), Status (status type), Priority (select), Due (date), Project (relation), Source (select)
- Open in Notion → "..." → Add connections → "Hermes Agent" integration
- Update `NOTION_TASKS_DB_ID` in `~/.hermes/.env` on Omen with new ID

Projects, People, Daily Briefings DBs — create when ready (lower priority than Tasks).

---

### 4. AppArmor — Switch to Enforce Mode (After 2 Weeks)

Currently in **complain mode** (logs violations, doesn't block). Safe to leave for now.

After running for 2 weeks without issues:
```bash
ssh dhruva@<LAN_IP> "sudo aa-enforce dhruvaos-hermes"
```

Then add to `~/.config/systemd/user/hermes-gateway.service` under `[Service]`:
```ini
AppArmorProfile=dhruvaos-hermes
```

---

## P2 Verification (Do When Awake)

### 5. Morning Briefing — Verify First Run (8am PST June 5)

Check Discord #briefings for 4 messages (calendar, inbox, tasks, research).
If fails, check logs: `ssh dhruva@<LAN_IP> "tail -100 ~/.hermes/logs/gateway.log"`

### 6. Google Calendar Verification

```bash
ssh dhruva@<LAN_IP> "set -a; source ~/.hermes/.env; set +a; \
  source ~/.hermes/hermes-agent/venv/bin/activate && \
  python3 ~/.hermes/scripts/google_api_helper.py calendar | head -20"
```

Should return JSON with calendar events.

### 7. GBrain Dream Cron — Verify at 3am

Check crontab has the dream cron:
```bash
ssh dhruva@<LAN_IP> "crontab -l"
```

Expected: `0 3 * * * flock -n /tmp/gbrain-write.lock /home/dhruva/.bun/bin/gbrain dream ...`

---

## What's Done (Don't Re-Do)

- UFW active: deny all incoming except port 22, deny all outgoing except 443/80/53/22/123
- auditd: rules loaded, watching .env file + crontab + systemd units
- AppArmor: profile loaded in complain mode at `/etc/apparmor.d/dhruvaos-hermes`
- All API keys merged to `~/.hermes/.env` on Omen (Notion, Gmail, Google Calendar, Supabase, Discord)
- 5 Phase 2 skills deployed to `~/.hermes/skills/dhruvaos/`
- Google API helper script at `~/.hermes/scripts/google_api_helper.py` (tested OK)
- Hermes config: `cron_mode: approve`, `timezone: America/Los_Angeles`, Notion MCP added
- Morning briefing cron: 8am PST, deliver=discord
- Evening briefing cron: 9pm PST, deliver=discord
- Dream cron: 3am daily via system crontab
- Tailscale installed, waiting for browser auth
- cloudflared installed, trycloudflare.com tunnel running via PM2
- Hermes restarted with new config (active, PID running)
