# xposteros-control

Control surface for XPosterOS — Dhruva's Notion-first X posting system running on Omen.

**Base URL:** `http://127.0.0.1:8081` (localhost — Hermes and XPosterOS both run on Omen)
**Auth:** `Authorization: Bearer $XPOSTEROS_API_TOKEN`

---

## Trigger phrases

- `xposteros health` / `xposteros status`
- `xposteros run workers` / `run xposteros pipeline`
- `xposteros list drafts` / `review xposteros drafts`
- `xposteros approve draft <id>`
- `xposteros create brain dump "<title>" "<content>"`
- `xposteros check queue` / `what's queued for X`
- `xposteros post now <queue_item_id>`

---

## Operations

### Health check
```bash
curl -s http://127.0.0.1:8081/system/health
```
Expected: `{"status":"ok","dry_run":<bool>,"posting_window":"08:00-22:00","platform":"x"}`

Report dry_run status clearly. If dry_run=true, note that Notion writes are blocked.

---

### Run worker pipeline
```bash
/home/dhruva/xposteros/deploy/run-workers.sh
```
Workers run in sequence: NotionSync → DraftGenerator → Reviewer → RandomScheduler → XPoster → MetricsSnapshot.
Report counts: brain dumps processed, drafts created, posts queued, posts attempted.

---

### List review-ready drafts
```bash
curl -s -H "Authorization: Bearer $XPOSTEROS_API_TOKEN" \
  http://127.0.0.1:8081/drafts
```
Filter response to drafts with `status == "review_ready"`. For each draft show:
- Draft ID (short form: first 8 chars)
- Draft text (full, up to 280 chars)
- Brain dump title if available

If no review_ready drafts: report "No drafts awaiting review."

---

### Approve a draft (requires Discord 👍)

**Step 1 — Post preview to #corrections:**
Post to Discord #corrections channel (DISCORD_CORRECTIONS_CHANNEL_ID):
```
📤 [XPOSTEROS DRAFT] Approval required

Draft ID: {draft_id[:8]}
Platform: X

---
{draft_text}
---

React 👍 to approve • Reply /xposteros deny {draft_id} to reject
```

**Step 2 — On 👍 reaction from Dhruva:**
```bash
curl -s -X POST \
  -H "Authorization: Bearer $XPOSTEROS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"draft_id": "{draft_id}"}' \
  http://127.0.0.1:8081/approvals/draft
```

**Step 3 — Confirm:**
Post to #corrections: `✅ Draft {draft_id[:8]} approved and queued for posting.`

**NEVER approve a draft without showing the preview in #corrections first.**
**NEVER call /approvals/draft unless Dhruva has reacted 👍.**

---

### Create brain dump from Hermes
```bash
curl -s -X POST \
  -H "Authorization: Bearer $XPOSTEROS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "{title}",
    "raw_content": "{content}",
    "source_url": null,
    "tags": []
  }' \
  http://127.0.0.1:8081/events/brain-dump
```
Expected: WorkerResult with `status="success"`, `output.persisted=true` (or false if dry_run).

---

### Check queue
```bash
curl -s -H "Authorization: Bearer $XPOSTEROS_API_TOKEN" \
  http://127.0.0.1:8081/queue/next
```
Returns next scheduled queue item or null. Report scheduled_at time in Dhruva's timezone.

---

### Trigger immediate post
Only use when Dhruva explicitly asks. Requires dry_run=false.
```bash
curl -s -X POST \
  -H "Authorization: Bearer $XPOSTEROS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"queue_item_id": "{id}"}' \
  http://127.0.0.1:8081/queue/post-now
```
**Confirm with Dhruva in #corrections before calling this.**

---

## Environment variables (in ~/.hermes/.env on Omen)

| Var | Value |
|-----|-------|
| `XPOSTEROS_API_TOKEN` | Bearer token for XPosterOS API |
| `XPOSTEROS_API_URL` | `http://127.0.0.1:8081` |

XPosterOS .env lives at `/home/dhruva/xposteros/.env` (chmod 600, never printed).

---

## Service management

```bash
# Status
systemctl --user status xposteros-api

# Restart (after config or code changes)
systemctl --user restart xposteros-api

# Logs
journalctl --user -u xposteros-api -n 50 --no-pager
```

---

## Dry-run mode

XPosterOS starts with `XPOSTER_DRY_RUN=true`. In this mode:
- All Notion writes are blocked
- X posting is blocked
- Health check reports `dry_run: true`
- Brain dump events return `persisted: false`

To enable live mode: set `XPOSTER_DRY_RUN=false` in `/home/dhruva/xposteros/.env` and restart the service.
**Do not enable live mode without Dhruva's explicit approval.**

---

## Subsystem context

XPosterOS is a standalone FastAPI + Next.js app. Hermes controls it via HTTP API.
- Notion is the canonical store (6 databases: Brain Dumps, Post Drafts, Posting Queue, Post History, Settings, Style Samples)
- Frontend (Next.js) is deployed on Vercel — separate from Hermes
- Workers run via Hermes cron (xposteros-workers, every 2 hours)
- GitHub repo: https://github.com/Dhruva966/linkedIn-XPoster
- Local repo on Omen: /home/dhruva/xposteros/
