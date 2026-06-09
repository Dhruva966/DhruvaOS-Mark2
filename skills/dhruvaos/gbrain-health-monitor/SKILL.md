---
name: gbrain-health-monitor
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Hourly: ping GBrain MCP at 127.0.0.1:3131/health, auto-recover via PM2 restart if down, post to #alerts on failure or recovery. Silent when healthy."
author: dhruvaos
platforms: [linux]
prerequisites:
  env_vars:
    - DISCORD_ALERTS_CHANNEL_ID
gbrain:
  reads: []
  writes: []
tests: tests/
metadata:
  hermes:
    tags: [GBrain, Health, Monitoring, Alerts, Recovery, Hourly]
---

# GBrain Health Monitor

You are Drew, Dhruva's personal AI OS agent. This skill runs every hour.
Check whether GBrain MCP is responding, auto-recover if down, and alert #alerts only on failure or recovery.
Be silent when everything is healthy.

---

## Step 1 — Check GBrain health endpoint

Use `terminal`:

```bash
HTTP_STATUS=$(curl -s -o /tmp/gbrain_health.json -w "%{http_code}" --connect-timeout 5 --max-time 10 http://127.0.0.1:3131/health 2>/dev/null)
echo "HTTP_STATUS=$HTTP_STATUS"
cat /tmp/gbrain_health.json 2>/dev/null || echo "NO_RESPONSE"
```

Parse result:
- If `HTTP_STATUS=200` AND response body contains `"status":"ok"` → GBrain is healthy.
- Any other status (000, 404, 500, connection refused, timeout) → GBrain is DOWN.

---

## Step 2 — If healthy: read failure state and decide action

Use `terminal`:

```bash
COUNT_FILE="$HOME/.gbrain/health-failures.count"
PREV=$(cat "$COUNT_FILE" 2>/dev/null || echo "0")
echo "PREV_FAILURES=$PREV"
```

- If `PREV_FAILURES=0`: GBrain healthy and was already healthy → **STOP. Do NOT post anything. Task complete.**
- If `PREV_FAILURES > 0`: GBrain just RECOVERED. Reset counter, post recovery notice to #alerts.

Reset counter:
```bash
echo "0" > "$HOME/.gbrain/health-failures.count"
```

Post recovery to #alerts using `messaging` tool (channel: `$DISCORD_ALERTS_CHANNEL_ID`):
```
✅ GBrain MCP recovered after [PREV_FAILURES] consecutive failure(s). Now responding at :3131/health.
```

Then **STOP**.

---

## Step 3 — If DOWN: attempt PM2 auto-recovery

Use `terminal`:

```bash
export PATH="/home/dhruva/.nvm/versions/node/v24.16.0/bin:/home/dhruva/.bun/bin:/home/dhruva/.local/bin:/usr/local/bin:/usr/bin:/bin"
PM2="/home/dhruva/.nvm/versions/node/v24.16.0/bin/pm2"
"$PM2" restart gbrain-mcp 2>&1
```

Wait 10 seconds, then re-check health:

```bash
sleep 10
HTTP_STATUS_RETRY=$(curl -s -o /tmp/gbrain_health_retry.json -w "%{http_code}" --connect-timeout 5 --max-time 10 http://127.0.0.1:3131/health 2>/dev/null)
echo "HTTP_STATUS_RETRY=$HTTP_STATUS_RETRY"
cat /tmp/gbrain_health_retry.json 2>/dev/null || echo "NO_RESPONSE"
```

- If retry returns `200` with `"status":"ok"` → PM2 restart fixed it. Set `RECOVERED_BY_RESTART=true`.
- Otherwise → still down, `RECOVERED_BY_RESTART=false`.

---

## Step 4 — Update failure counter

Use `terminal`:

```bash
COUNT_FILE="$HOME/.gbrain/health-failures.count"
PREV=$(cat "$COUNT_FILE" 2>/dev/null || echo "0")
NEW=$((PREV + 1))
echo "$NEW" > "$COUNT_FILE"
echo "FAILURE_COUNT=$NEW"
```

---

## Step 5 — Alert #alerts

Use `messaging` tool to post to `$DISCORD_ALERTS_CHANNEL_ID`.

If `RECOVERED_BY_RESTART=true`:
```
✅ GBrain MCP was down but auto-recovered via PM2 restart. Failure #[FAILURE_COUNT] — monitoring.
```

If still down (not recovered):
```
🚨 GBrain MCP DOWN — failure #[FAILURE_COUNT]. :3131/health not responding. PM2 restart attempted but failed. Manual check needed.
PM2 status: [include output of: pm2 list | grep gbrain-mcp]
```

Only alert on:
- First failure (COUNT=1)
- Every 3rd consecutive failure after that (COUNT divisible by 3: 3, 6, 9…)
- Recoveries (handled in Step 2)

This prevents alert spam during extended outages.

---

## Completion

After posting (or deciding to stay silent), output a one-line status to the session log:
```
[gbrain-health-monitor] STATUS=[healthy|down|recovered] FAILURES=[count] at [ISO timestamp]
```
