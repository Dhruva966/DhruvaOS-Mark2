# DhruvaOS Mark 2 — Skills

## Overview

DhruvaOS uses Hermes Agent's self-improving skill loop. Deployed custom skills are
`SKILL.md` files in `skills/dhruvaos/<name>/` and are copied to
`~/.hermes/skills/dhruvaos/<name>/SKILL.md`. Each file has YAML frontmatter followed by
a markdown implementation body.

Two categories:
1. **Starting skills** — seeded manually at deploy time; define the initial capability floor
2. **Runtime skills** — authored by Hermes when it encounters novel tasks; extend capabilities dynamically

The goal: a closed set of starting skills bootstraps DhruvaOS into usefulness, then the
self-improving loop takes over. Dhruva never needs to manually define every possible task.

---

## Starting Skills (8 custom seeds + 2 GBrain built-ins)

| Skill | Tier | Outbound | Schedule | GBrain | Trust Gate |
|-------|------|----------|----------|--------|-----------|
| `morning-briefing` | 2 | false | 8am daily | read: tasks, context | auto (#briefings is internal) |
| `evening-briefing` | 2 | false | 9pm daily | write: day summary | auto (#briefings is internal) |
| `add-task` | 0 | false | on demand | write: tasks-inbox (staging only) | auto |
| `email-triage` | 1 (triage) / 2 (draft) | false (triage) / true (draft) | on demand | read: people/ | auto (triage) / approval (draft) |
| `calendar-read` | 1 | false | on demand | read: tasks, deadlines | auto |
| `task-prioritization` | 1 | false | on demand | read+write: tasks | auto |
| `research-synthesis` | 2 | false | on demand | write: resources/ | auto |
| `correction-handler` | 2 | false | #corrections trigger | write: permanent fact | **approval** (permanent behavioral rules) |
| `signal-detector` | 0 | false | every inbound | write: entities+ideas | auto (GBrain built-in) |
| `brain-ops` | 1 | false | every response | read: context | auto (GBrain built-in) |

---

## Skill Format

```yaml
# ~/.hermes/skills/dhruvaos/<name>/SKILL.md
name: <skill-name>
version: 1.0.0
tier: <0|1|2|3>
outbound: <true|false>            # true = another human will read this output
requires_approval: <true|false>   # DhruvaOS convention; enforce in skill body/runtime
description: "<one sentence>"
schedule: <null | cron-expression> # documentation only; Hermes cron is configured separately
gbrain:
  reads: ["<brain-glob>"]         # e.g. ["people/*", "projects/*"]
  writes: ["<brain-glob>"]        # e.g. ["daily/*"]
tests: tests/
---
# Implementation follows here (plain text steps or structured actions)
```

Hermes only requires `name` and `description`. Other fields are DhruvaOS review and safety
conventions. Tests are repo-local contract tests; Hermes does not provide `--mock-tools`.

---

## Starting Skill Specs

### morning-briefing
```yaml
name: morning-briefing
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Full daily briefing: calendar + email digest + tasks + news/research"
schedule: "0 8 * * *"
gbrain:
  reads: ["projects/*", "goals/*", "daily/*"]
  writes: ["daily/briefing-{{date}}.md"]
tests: tests/morning-briefing/
---
Status: STUB — scaffold present, content TBD in Phase 2.
Content when implemented:
  1. Fetch today's calendar events (Google Calendar API / Hermes calendar tool)
  2. Fetch top 5 unread emails, classify, surface action items
  3. Load task list from GBrain, sort by priority
  4. Search GBrain for recent research + ongoing project context
  5. Fetch curated news/research digest (Exa search on tracked topics)
  6. Compose briefing, post to #briefings
  7. Write briefing summary to ~/brain/daily/briefing-{{date}}.md
```

### evening-briefing
```yaml
name: evening-briefing
version: 1.0.0
tier: 2   # synthesis + insight — Tier 1 produces formulaic output
outbound: false
requires_approval: false
description: "Evening recap and next-day prep"
schedule: "0 21 * * *"
gbrain:
  reads: ["daily/briefing-{{date}}.md"]
  writes: ["daily/recap-{{date}}.md"]
tests: tests/evening-briefing/
---
Status: STUB — scaffold present, content TBD in Phase 2.
Content when implemented:
  1. Load today's briefing from GBrain
  2. Assess what was accomplished vs planned
  3. Surface unfinished tasks for tomorrow
  4. Post recap to #briefings
  5. Write daily recap to ~/brain/daily/recap-{{date}}.md
```

### email-triage
```yaml
name: email-triage
version: 1.0.0
tier: 1          # for triage; escalates to 2 for drafting replies
outbound: false  # triage is internal; reply drafts use separate outbound approval
requires_approval: false
description: "Classify inbox, summarize threads, surface action items"
schedule: null   # triggered on demand or by #tasks command
gbrain:
  reads: ["people/*", "projects/*"]
  writes: []     # no brain writes; use research-synthesis for saving intel
tests: tests/email-triage/
---
Steps:
  1. Connect to Gmail via Google API OAuth (or Hermes email tool if configured)
  2. Fetch unread threads (max 50)
  3. For each thread: classify (action required / FYI / spam / newsletter)
  4. Group by sender, urgency, project context
  5. Load sender context from GBrain people/
  6. Post digest to #tasks with classifications
  7. Flag threads needing replies for separate /reply command (outbound, Tier 2)
```

### calendar-read
```yaml
name: calendar-read
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Read upcoming calendar events and return a structured agenda"
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: []
tests: tests/calendar-read/
---
Status: STUB — scaffold present, content TBD in Phase 2.
Content when implemented:
  1. Connect to Google Calendar via OAuth-backed tool/API
  2. Fetch today's and next 7 days' events
  3. Normalize time, title, attendees, and location
  4. Cross-reference deadlines from projects/tasks.md
  5. Return agenda block for morning-briefing and task-prioritization
```

### add-task
```yaml
name: add-task
version: 1.0.0
tier: 0
outbound: false
requires_approval: false
description: "Append a new task to the task list — triggered by /task <text>"
schedule: null
gbrain:
  reads: []
  writes: ["projects/tasks-inbox.md"]
tests: tests/add-task/
---
Steps:
  1. Parse task text from /task command argument
  2. Extract due date and urgency markers from the text if present
  3. Format: "- [ ] <text> [due: <date>] [added: <today>]"
  4. Append to ~/brain/projects/tasks-inbox.md via gbrain ingest
  5. Confirm to Discord #tasks: "Added: <task text>"
```

### task-prioritization
```yaml
name: task-prioritization
version: 1.0.0
tier: 1
outbound: false
requires_approval: false
description: "Load task list, rank by urgency+importance, update GBrain"
schedule: null
gbrain:
  reads: ["projects/*", "goals/*"]
  writes: ["projects/tasks.md"]
tests: tests/task-prioritization/
---
Steps:
  1. Load current task list from ~/brain/projects/tasks.md
  2. Merge ~/brain/projects/tasks-inbox.md into tasks.md if staging entries exist, then clear the inbox file
  3. Fetch calendar for deadlines context
  4. Score each task: urgency (deadline proximity) × importance (goal alignment)
  5. Re-rank and write updated list to GBrain
  6. Post ranked list to #tasks
```

### research-synthesis
```yaml
name: research-synthesis
version: 1.0.0
tier: 2
outbound: false
requires_approval: false
description: "Deep-dive a topic, return structured summary, write to brain"
schedule: null
gbrain:
  reads: ["concepts/*", "resources/*"]
  writes: ["resources/research-{{topic}}-{{date}}.md"]
tests: tests/research-synthesis/
---
Steps:
  1. Receive topic query from Discord #research
  2. Search GBrain for existing knowledge on topic
  3. Run Exa search for current sources
  4. Use Exa native content extraction for top sources
  5. Synthesize: what's known, what's new, gaps, key takeaways
  6. Write structured summary to ~/brain/resources/
  7. Post synthesis to #research
```

### correction-handler
```yaml
name: correction-handler
version: 1.0.0
tier: 2
outbound: false
requires_approval: true   # permanent behavioral rules must be reviewed before writing
description: "Receive behavioral correction from Dhruva, write as permanent GBrain fact"
schedule: null   # triggered by #corrections channel message starting with /correct
gbrain:
  reads: []
  writes: ["concepts/corrections.md"]
tests: tests/correction-handler/
---
Steps:
  1. Parse correction text from #corrections message
  2. Classify: behavior change / factual update / preference update
  3. Write to ~/brain/concepts/corrections.md with date + category
  4. Summarize what was corrected and post acknowledgment to #corrections
  5. Hermes uses Sonnet by default and escalates only if the correction is unusually ambiguous
```

### charlie-monitoring (STUB — NOT IMPLEMENTED)
```yaml
name: charlie-monitoring
version: 0.0.0
status: STUB_NOT_IMPLEMENTED
tier: 1
outbound: false
requires_approval: false
description: "FUTURE: Monitor Charlie's Cleaners business metrics"
schedule: null
gbrain:
  reads: ["charlie/*"]
  writes: ["charlie/metrics-{{date}}.md"]
---
# TODO: Define monitoring targets (revenue, bookings, employees)
# TODO: Identify data source (POS system, booking platform, manual input)
# TODO: Implement metrics collection and alerting thresholds
# TODO: Wire to #charlie Discord channel
# This stub is an intentional extension point — do not implement until scoped.
```

---

## Tiered Trust Model

### Auto-promoted (no Dhruva action required)
- Read-only: search, summarize, calendar read, email triage (no send), task list read
- GBrain reads: any `gbrain search` or `gbrain think` call
- Internal posts to Discord channels (briefings, tasks, research, alerts)
- Write to `~/brain/` (GBrain writes are safe — reversible)

### Requires Dhruva approval before running
- **Write skills**: file writes outside brain/, calendar event creation, email draft creation
- **Shell skills**: any command executed in terminal
- **Approval process**: Discord DM with skill name, code preview, action summary

### Requires approval on EVERY run (never auto)
- **Outbound skills**: email send, LinkedIn post, GitHub comment/push, any external recipient
- Even after approval history, must re-approve each individual outbound action
- This is the quality firewall — it never expires

---

## Runtime Skill Authoring Pattern

When Hermes encounters a task with no matching skill:

```
Step 1: Reason through the task
  - What tools are needed?
  - What tier makes sense?
  - Is any output going to a human other than Dhruva?

Step 2: Execute with existing tools
  - Use browser, search, calendar, shell, etc.
  - Track which tools were used and in what sequence

Step 3: If execution succeeds → write skill
  ~/.hermes/skills/dhruvaos/<task-name>/SKILL.md
  Frontmatter: name, tier, outbound, requires_approval, gbrain.reads/writes
  Body: ordered steps mirroring what just worked

Step 4: Write test
  ~/.hermes/skills/<task-name>/tests/test_basic.py
  Must mock all external tool calls
  Must test happy path + one edge case

Step 5: Quality gate
  python3 -m pytest skills/dhruvaos/<task-name>/tests/
  If fails → patch skill, re-run, do not promote until green

Step 6: Trust gate
  outbound OR shell? → Discord DM to Dhruva (code preview, action summary)
  Dhruva: /approve <skill> or /deny <skill>
  else → auto-promote to trusted

Step 7: Skill available for reuse
  Next time a similar task arrives, Hermes matches and runs the skill directly
```

### Skill review checklist (for Dhruva when reviewing agent-authored skills)
- [ ] Tier is appropriate (not using Tier 2+ for simple triage)
- [ ] `outbound: true` if any external recipient could receive text
- [ ] Shell commands are scoped (no `rm -rf`, no sudo, no network exfil)
- [ ] GBrain writes are to appropriate directories
- [ ] Tests mock all tools (no real API calls in tests)

---

## Skill Lifecycle

```
authored → staged → quality-gate → trust-gate → trusted → in-use
                                                    │
                                             refined over time
                                                    │
                                       escalation >30%/week
                                                    │
                                            tier promoted
                                            (update SKILL.md)
```

Skill deletion: `rm -rf ~/.hermes/skills/dhruvaos/<name>/` + restart Hermes.
Log deletion reason in `decisions/` if it was a trusted skill.

---

## GBrain Built-in Skills (pre-installed, no setup needed)

| Skill | Function | When to use |
|-------|----------|------------|
| `signal-detector` | Captures entities + ideas from every inbound message | Always-on |
| `brain-ops` | Brain-first lookup before any external API call | Every response |
| `idea-ingest` | Ingest a link, article, or tweet into brain | Ad-hoc |
| `media-ingest` | Ingest PDF, video, repo, book, podcast | Ad-hoc |
| `meeting-ingestion` | Process meeting transcript → brain | Ad-hoc |
| `voice-note-ingest` | Transcribe + file voice note | Ad-hoc |
| `soul-audit` | Generate SOUL.md, USER.md, ACCESS_POLICY.md | Periodic |
| `RESOLVER` | Skill dispatcher — reads before any task | Built-in router |

These are seeded via `gbrain skillpack scaffold --all` into the agent workspace.
