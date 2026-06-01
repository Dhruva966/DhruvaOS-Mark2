# brain/ — Knowledge Base

Purpose: Conventions for `~/brain/` markdown content. GBrain ingests these files.
Quality of the brain directly determines quality of DhruvaOS's context and reasoning.

→ Root context: [../CLAUDE.md](../CLAUDE.md)

---

## Key Directories

| Directory | Contents | Owner |
|-----------|----------|-------|
| `people/` | One .md per person | Dhruva + correction-handler |
| `companies/` | One .md per organization | Dhruva |
| `concepts/` | Ideas, frameworks, corrections | Dhruva + correction-handler |
| `projects/` | Projects + tasks.md | Dhruva + task-prioritization |
| `daily/` | Briefings + recaps (date-stamped) | Hermes skills (auto-write) |
| `resources/` | Research outputs, bookmarks | Hermes skills + Dhruva |
| `UCLA/` | UCLA-specific context | Dhruva |
| `goals/` | Short + long-term goals | Dhruva |
| `charlie/` | Charlie's Cleaners context | Dhruva (stub) |

---

## Allowed Patterns ✅

```markdown
<!-- ✅ Correct person file -->
---
title: "Alice Chen"
date: "2025-06-01"
tags: ["person", "UCLA", "professor", "computer-science"]
source: "manual"
---

# Alice Chen

UCLA CS professor. Research: distributed systems. Met at orientation June 2025.
Potential research advisor. Approachable, office hours Tuesdays.

**Open threads:** Email intro after fall orientation week.
```

```markdown
<!-- ✅ Correct project file -->
---
title: "DhruvaOS Mark 2"
date: "2025-06-01"
tags: ["project", "active", "ai", "personal-os"]
source: "manual"
---

# DhruvaOS Mark 2

Always-on personal AI OS. Hermes + GBrain. Jarvis-style.

**Status:** Phase 0 (infrastructure setup)
**Goal:** Phase 4 complete (self-improving loop running) by end of summer 2025
**Next steps:**
- [ ] Install Hermes + GBrain on Omen
- [ ] Import Obsidian vault
- [ ] Configure Discord bot
```

```markdown
<!-- ✅ Correct correction file entry -->
---
title: "Behavioral Corrections"
date: "2025-06-01"
tags: ["meta", "corrections"]
source: "correction-handler"
---

# Behavioral Corrections

## 2025-06-01 — Briefing format
When writing morning briefings, lead with calendar, then email, then tasks.
Do not lead with news unless Dhruva explicitly requests it.
```

---

## Forbidden Patterns ❌

```markdown
<!-- ❌ Brain file without frontmatter — won't auto-link in GBrain -->
# Alice Chen

UCLA professor. Met orientation.
<!-- Missing --- frontmatter block — GBrain can't extract entity metadata -->
```

```markdown
<!-- ❌ Vague, low-signal content — wastes embedding space -->
---
title: "Stuff"
---
Things I'm thinking about. Various ideas. Miscellaneous.
```

```markdown
<!-- ❌ API keys or secrets in brain files -->
---
title: "API Keys"
---
My OpenAI key is sk-proj-abc123...
<!-- NEVER — brain files may be synced or backed up -->
```

---

## What NOT to Do

1. **Never store secrets in brain files.** No API keys, passwords, tokens. Brain files
   may be backed up, synced, or read by GBrain's embedding process (which calls external APIs).

2. **Never create brain files with no frontmatter.** GBrain can still ingest them, but
   they won't auto-link correctly. Every new file needs the `---` frontmatter block.

3. **Never leave tasks.md as a free-form dump.** `projects/tasks.md` has a canonical
   format that task-prioritization skill expects: one task per line, each with a priority
   signal (deadline, importance marker). Freeform text breaks the skill.

4. **Never skip ingesting after adding brain files.** Files in `~/brain/` are invisible
   to GBrain until `gbrain embed --stale` is run. New files appear in the next sync
   cycle (2am cron) if not ingested manually.

5. **Never delete brain files without checking GBrain backlinks.** GBrain's auto-link
   graph may reference deleted files. After deletion, run:
   `gbrain extract links --source db` to repair the graph.

---

## Brain File Naming Convention

```
people/<firstname-lastname>.md       # e.g., people/alice-chen.md
companies/<company-slug>.md          # e.g., companies/google.md
projects/<project-slug>.md           # e.g., projects/dhruvaos-mark-2.md
resources/<topic>-<date>.md         # e.g., resources/llm-routing-2025-06-01.md
UCLA/<topic>.md                      # e.g., UCLA/cs-major-planning.md
goals/short-term.md                  # fixed name
goals/long-term.md                   # fixed name
daily/briefing-<YYYY-MM-DD>.md      # auto-written by morning-briefing skill
daily/recap-<YYYY-MM-DD>.md         # auto-written by evening-briefing skill
```

All lowercase, hyphenated, no spaces.
