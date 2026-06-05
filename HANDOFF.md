# DhruvaOS Mark 2 — Handoff

Defines data contracts and integration points between DhruvaOS subsystems.
Read before building any skill that crosses a subsystem boundary.

---

## Subsystem Boundaries

```
┌─────────────────┐   MCP (HTTP :3131)  ┌─────────────────┐
│  Hermes Agent   │ ◄─────────────────► │  GBrain         │
│  Python 3.11+   │                     │  Bun 1.x        │
└────────┬────────┘                     └────────┬────────┘
         │                                      │
         │ Discord API                          │ reads/writes
         ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│  Discord        │                    │  ~/brain/        │
│  6 channels     │                    │  markdown files  │
└─────────────────┘                    └─────────────────┘
```

---

## Hermes ↔ GBrain: MCP Contract

### Connection
- Protocol: MCP via HTTP (`gbrain serve --http --port 3131 --host 127.0.0.1`) — required for PM2 daemons
- Alternative: MCP via stdio (`gbrain serve`) — for local ad-hoc testing only; incompatible with PM2
- Auth: none required for loopback-only binding; do not expose port 3131 on network interfaces
- Both services must be running: `systemctl --user status hermes-gateway` is active and `pm2 list` shows `gbrain-mcp`

### GBrain operations Hermes calls

| Operation | When | Returns |
|-----------|------|---------|
| `search(query)` | Before any response using external facts | Chunks + synthesized answer + citations |
| `think(query)` | For trajectory/temporal queries | Entity timeline + anomaly flags |
| `ingest(content, path)` | When writing new knowledge to brain | Confirmation |
| `embed(path)` | After ingesting files | Embedding job status |
| `dream()` | Nightly cron, never from active skill | Dream cycle summary |

### Data format: Hermes → GBrain writes

All skill writes to `~/brain/` must follow this format:
```markdown
---
title: "<Title>"
date: "<YYYY-MM-DD>"
tags: ["<tag1>", "<tag2>"]
source: "<skill-name>"
---

# <Title>

<content>
```

Frontmatter is required for GBrain to auto-link and index correctly.

### Data format: GBrain search → Hermes response

GBrain returns:
```json
{
  "answer": "<synthesized answer>",
  "chunks": [{"text": "...", "source": "path/in/brain", "score": 0.87}],
  "citations": ["brain/people/alice.md", "..."],
  "gaps": ["<what's missing from the brain on this topic>"]
}
```

Hermes should include citations when responding to Dhruva if `chunks` is non-empty.

---

## Hermes ↔ Discord: Event Contract

### Inbound (Discord → Hermes)

| Event | Channel | Trigger | Hermes action |
|-------|---------|---------|--------------|
| Message with `/` prefix | any | command | Route to skill dispatcher |
| Message without `/` | #briefings | conversation | Respond conversationally |
| 👍 reaction to Hermes message | #corrections | approval | Execute queued outbound action |
| `/deny <id>` message | #corrections | rejection | Discard queued outbound action, log |
| `/correct <text>` | #corrections | correction | Run correction-handler skill |
| `/approve <skill>` DM | DM | skill approval | Promote skill to trusted |
| `/deny <skill>` DM | DM | skill rejection | Delete skill, log reason |

### Outbound (Hermes → Discord)

| Channel | Content type | Trigger |
|---------|-------------|---------|
| `#briefings` | Daily briefing, ad-hoc updates | APScheduler or direct query |
| `#tasks` | Task list, prioritization updates | Task commands or morning briefing |
| `#research` | Research synthesis | /research command |
| `#alerts` | Urgent notifications, credit watchdog | Triggered events |
| `#charlie` | Charlie's Cleaners (stub) | Future |
| `#corrections` | **Outbound preview** — blocks until approved | Every outbound skill |

**Outbound preview format:**
```
📤 [APPROVAL REQUIRED] <skill-name>
Destination: <email/LinkedIn/GitHub/etc.>
Model: claude-sonnet-4-6 (Tier 2)

---
<full text of outbound message>
---

React 👍 to approve • Reply /deny to reject
```

---

## Skill ↔ GBrain: Read/Write Contract

Every skill YAML declares its GBrain reads and writes in frontmatter:

```yaml
gbrain:
  reads: ["people/*", "projects/tasks.md"]   # glob patterns — what it queries
  writes: ["daily/recap-{{date}}.md"]        # what it creates/updates
```

### Rules
- Skills that only read from GBrain: auto-trust eligible
- Skills that write to GBrain: auto-trust eligible (writes to brain/ are reversible)
- Skills that run shell commands: Dhruva approval required, always
- Skills with `outbound: true`: Tier 2+ + Dhruva approval, always

### Brain write collision prevention (parallel worktrees)
Two skills writing to the same brain file = merge conflict.
Coordinate by writing to date-stamped files:
- daily/briefing-{{date}}.md → each day's file is unique
- projects/tasks.md → single file, never write from two parallel skills

---

## Hermes ↔ External APIs: Tool Contract

| Tool | Provider | Auth | Used by | Status |
|------|---------|------|---------|--------|
| Web search + extract | Exa | `EXA_API_KEY` | research-synthesis, morning-briefing | ✅ key in .env |
| Task DB | Notion API | `NOTION_API_KEY` / `NOTION_TOKEN` | add-task, task-prioritization | ✅ key in .env |
| Calendar | Google Calendar API | OAuth refresh token (headless) | morning-briefing, calendar-read | ✅ token in .env |
| Email | Gmail API | OAuth refresh token (headless) | email-triage, morning-briefing | ✅ token in .env |
| Notion MCP | @notionhq/notion-mcp-server | `NOTION_TOKEN` | all Notion operations | ✅ MCP registered |
| Web extraction (structured) | AgentQL | `AGENTQL_API_KEY` | research-synthesis (optional upgrade) | ⬜ no key yet |
| Browser automation | Browserbase | `BROWSERBASE_API_KEY` | Phase 5 LinkedIn/GitHub | ⬜ Phase 5 |
| Code hosting | GitHub MCP | `GITHUB_TOKEN` | GitHub skill (Phase 5) | ⬜ Phase 5 |

**Google API helper script:** `~/.hermes/scripts/google_api_helper.py`
Headless OAuth via stored refresh token. Test: `set -a; source ~/.hermes/.env; set +a; source ~/.hermes/hermes-agent/venv/bin/activate && python3 ~/.hermes/scripts/google_api_helper.py test`

---

## Integration Checklist

**Phase 1 — Complete (June 5, 2026):**

- [x] `systemctl --user status hermes-gateway` is active
- [x] `pm2 list` shows `gbrain-mcp` online
- [x] Drew responds in Discord #briefings
- [x] `hermes mcp test gbrain` — 88 tools discovered
- [x] `hermes mcp list` — notion + gbrain both ✓ enabled
- [x] `gbrain onboard --check --json` — 0 recommendations, fully onboarded
- [x] Morning briefing cron: 8am PST, deliver=discord
- [x] Evening briefing cron: 9pm PST, deliver=discord
- [x] Dream cron: 3am, system crontab
- [x] UFW active: deny all, allow SSH/HTTPS/DNS/NTP
- [x] auditd rules loaded: watching .env, config, crontab
- [x] AppArmor complain mode: dhruvaos-hermes profile
- [x] Tailscale: authenticated, IP 100.119.229.11

**Phase 2 — Skills deployed (June 5, 2026):**

- [x] `hermes skills list` shows all 8 dhruvaos skills enabled
- [x] Google API credentials tested OK on Omen
- [x] All 18 API keys in ~/.hermes/.env (Notion, Gmail, Calendar, Discord, Supabase, etc.)
- [x] Hermes config: cron_mode=approve, timezone=LA, Notion MCP
- [ ] Morning briefing 8am run verified in #briefings (pending — June 5 8am)
- [ ] Notion Tasks DB proper schema created (current: Snoopy AI schema)
- [ ] /task /research /correct commands tested end-to-end
- [ ] Quality firewall test (P3.3 gate — manual)

---

## Known Coupling Points (collision risk in parallel builds)

| Coupling | Risk | Resolution |
|---------|------|-----------|
| GBrain PGLite DB | Two processes write simultaneously → corruption | Never run two GBrain write operations in parallel |
| `~/.hermes/config.yaml` | Concurrent edits → invalid YAML | Edit sequentially, restart Hermes after each |
| `~/brain/projects/tasks.md` | Two skills write simultaneously | task-prioritization is the only writer; no other skill writes this file |
| Discord bot token | Shared by all Hermes instances | Only one Hermes process running at a time |
