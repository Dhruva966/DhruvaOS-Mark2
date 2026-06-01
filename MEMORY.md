# DhruvaOS Mark 2 — Memory (GBrain)

## Overview

GBrain is the compounding memory layer. It replaces Mem0 + Qdrant + Graphify from Mark 1
with a single system: PGLite (embedded Postgres + pgvector), markdown brain files, hybrid
search (FTS + vector RRF), entity graph auto-linking, and a nightly dream cycle that
consolidates and compounds knowledge.

The brain gets smarter every day — automatically.

---

## Brain Repository Structure

```
~/brain/
├── people/
│   └── <name>.md              # One file per person: name, relationship, notes, history
├── companies/
│   └── <company>.md           # UCLA, Charlie's Cleaners, target companies, etc.
├── concepts/
│   ├── corrections.md         # Agent behavior corrections (written by correction-handler)
│   └── <concept>.md           # Ideas, frameworks, mental models
├── projects/
│   ├── tasks.md               # Current task list (updated by task-prioritization skill)
│   └── <project>.md           # DhruvaOS, class projects, side projects, etc.
├── daily/
│   ├── briefing-<date>.md     # Morning briefings (written by morning-briefing skill)
│   └── recap-<date>.md        # Evening recaps (written by evening-briefing skill)
├── resources/
│   └── research-<topic>-<date>.md   # Research synthesis outputs
├── UCLA/
│   └── <topic>.md             # Courses, clubs, research interests, professors, deadlines
├── goals/
│   ├── short-term.md          # 1-year goals
│   └── long-term.md           # 5-year goals, career vision
└── charlie/
    └── context.md             # STUB: Charlie's Cleaners business context
```

---

## GBrain Configuration

```json
// ~/.gbrain/config.json
{
  "engine": "pglite",
  "search_mode": "balanced",
  "embedding_provider": "zeroentropy",
  "query_expansion": false,
  "brain_path": "~/brain"
}
```

**Search mode rationale (balanced):**
- `balanced` = 12K token budget, 25 chunks, no LLM expansion
- Correct for a solo user at moderate query volume
- `conservative` (4K / 10 chunks) = use if costs spike unexpectedly
- `tokenmax` = unlimited budget, LLM expansion on — reserve for deep research queries only

**Embedding provider:** ZeroEntropy (default, free, integrated). Do not add OpenAI embedding
unless ZeroEntropy fails for a specific use case.

---

## Initial Setup

### Step 1: Install and verify GBrain
```bash
bun install -g github:garrytan/gbrain
gbrain upgrade    # ensure ≥0.42.1.0
gbrain --version
```

### Step 2: Create brain directory structure
```bash
mkdir -p ~/brain/{people,companies,concepts,projects,daily,resources,UCLA,goals,charlie}
```

### Step 3: Write config
```bash
mkdir -p ~/.gbrain
cat > ~/.gbrain/config.json << 'EOF'
{
  "engine": "pglite",
  "search_mode": "balanced",
  "embedding_provider": "zeroentropy",
  "query_expansion": false,
  "brain_path": "~/brain"
}
EOF
```

### Step 4: Initialize the brain
```bash
gbrain apply-migrations --yes
gbrain onboard --check --json    # should show all green
```

---

## Obsidian Vault Ingest

GBrain treats the Obsidian vault as a regular markdown directory. No special plugin needed.

```bash
# Import existing Obsidian vault (skip embedding for speed)
gbrain import ~/path/to/your-obsidian-vault --no-embed

# Generate embeddings for all imported files
gbrain embed --stale

# Health check
gbrain onboard --check --json

# Build entity graph (auto-link people, companies, concepts)
gbrain extract links --source db

# Build timeline (auto-date events)
gbrain extract timeline --source db

# Verify search works
gbrain search "test query"
```

**After import:** review `gbrain onboard` output for warnings. Common issues:
- Files with no frontmatter → normal, GBrain handles them
- Duplicate entity names → merge manually in `~/brain/` before re-import
- Large attachments (images, PDFs in vault) → GBrain skips binaries, only processes markdown

---

## Braindump Guide

Your Obsidian vault is small. Use this questionnaire to build a comprehensive brain.
Go category by category. Write in `~/brain/` directly — one markdown file per topic.
GBrain will ingest and link them during the next dream cycle.

---

### Category 1: People (create `~/brain/people/<firstname-lastname>.md` for each)

For each important person in your life, answer:
- Who are they? (name, role, where you met)
- How do you know them / how important is this relationship?
- What are 2-3 things you know about them personally or professionally?
- Last meaningful interaction? Any open threads?
- What do you want from or can you offer to this relationship?

**Who to include:** family members, close friends, professors (past + UCLA target), mentors,
collaborators on projects, important Twitter/social follows, people at companies you want to work at.

Aim for 20-40 people files initially.

---

### Category 2: Projects (create `~/brain/projects/<project-name>.md` for each)

For each active or recent project:
- What is it? One-sentence description.
- What's the current status? (idea / building / paused / done)
- What's the goal? What does success look like?
- Current blockers or open questions?
- Who else is involved?
- What are the next 3 concrete steps?

**Include:** DhruvaOS (this project), any school projects, side projects, experiments.

---

### Category 3: UCLA

File: `~/brain/UCLA/overview.md`
- What do you want to study? (major, potential double major)
- What research areas are you most interested in?
- Which professors at UCLA do you want to work with / find?
- Which clubs or organizations do you want to join?
- What internship targets do you have for freshman summer?
- What GPA goal are you aiming for?
- What does a great UCLA experience look like for you?

---

### Category 4: Goals

File: `~/brain/goals/short-term.md`
- What do you want to accomplish in the next 12 months?
- What does your life look like by the end of freshman year?
- What skills do you want to have by then?
- What projects do you want to have shipped?

File: `~/brain/goals/long-term.md`
- Where do you want to be at 25?
- What kind of work do you want to do?
- What impact do you want to have?
- What does financial success look like to you?
- What kind of person do you want to become?

---

### Category 5: Skills

File: `~/brain/concepts/skills.md`
- What are you already good at? (programming languages, tools, soft skills)
- What do you want to learn in the next year?
- What are you actively learning right now?
- What resources are you using to learn? (courses, books, projects)

---

### Category 6: Companies

File: `~/brain/companies/<company>.md` for each
- Which companies fascinate you? Why?
- What do they build that you find interesting?
- Anyone you know who works there?
- Would you want to work there? In what role?

---

### Category 7: Topics + Learning

File: `~/brain/concepts/topics-i-follow.md`
- What topics do you read about regularly?
- What are the most interesting papers, posts, or episodes you've encountered recently?
- What do you believe that most people disagree with?
- What are you most curious about right now?

---

### Category 8: Tools and Workflow

File: `~/brain/concepts/tools-and-workflow.md`
- What software/tools do you use every day?
- What workflows have you built that save you time?
- What are the most painful things in your current workflow?
- What would make your digital life 10x better?

---

### Category 9: Charlie's Cleaners

File: `~/brain/charlie/context.md`
- What is Charlie's Cleaners? (type of business, what it does)
- Who owns/runs it?
- How is it relevant to you?
- What metrics would be useful to monitor?
- What are the current challenges or opportunities?

---

### Category 10: Content I Consume

File: `~/brain/concepts/content-diet.md`
- Which newsletters do you read? (name, frequency, why)
- Which YouTube channels? (name, type of content, why)
- Which podcasts? (name, format, why)
- Which Twitter/X accounts are most valuable to you?
- Which subreddits, Discord servers, or communities?

---

## Dream Cycle Setup

The dream cycle is what makes GBrain compound. Run nightly without fail.

### Install crontab
```bash
crontab -e
# Add these two lines:
0 2 * * * /home/dhruvaos/.bun/bin/gbrain sync --repo ~/brain && /home/dhruvaos/.bun/bin/gbrain embed --stale
0 3 * * * /home/dhruvaos/.bun/bin/gbrain dream
```

### Verify
```bash
gbrain dream --dry-run    # simulate without writing; shows what would run
```

### What happens each night
1. **2:00 AM** — sync brain repo to GBrain DB, embed any new/changed files
2. **3:00 AM** — dream cycle (8 phases):
   - Entity sweep: ensure all entities have canonical files
   - Citation repair: fix broken backlinks
   - Memory consolidation: merge redundant notes, dedup facts
   - Conversation synthesis: compress recent Discord conversations into brain nodes
   - Cross-session pattern detection: surfaces recurring themes
   - Timeline backfill: auto-date events and entity appearances
   - Auto-link creation: typed links between entities
   - Gap analysis: what Dhruva knows but hasn't documented

---

## Search vs Think: When to Use Each

### `gbrain search <query>`
Use when: "what do I know about X?"
Returns: hybrid retrieval (FTS + vector RRF) + synthesized answer + citations + gap analysis

```bash
gbrain search "machine learning papers I've read"
gbrain search "who do I know at Google"
gbrain search "my current projects"
```

### `gbrain think <query>`
Use when: "how has X changed over time?" or "what's the trajectory of Y?"
Returns: entity trajectory + chronological view + anomaly detection + graph traversal

```bash
gbrain think "how have my UCLA goals evolved"
gbrain think "my relationship with project DhruvaOS over time"
gbrain think "career direction"
```

**Rule of thumb:** search for facts, think for trajectories and patterns.

---

## How the Brain Compounds Over Time

| Timeframe | What happens |
|-----------|-------------|
| Day 1 | Raw import done, basic search works |
| Week 1 | Embeddings generated, vector search active, first dream cycle |
| Week 2-4 | Entity graph building, backlinks auto-created, trajectories tracking |
| Month 1-3 | Dream cycle running nightly, patterns emerging, gap analysis surfacing |
| Month 3-6 | Belief + goal trajectory visible, knowledge gaps closing |
| Month 6-12 | Rich entity web, GBrain answers start feeling genuinely intelligent |

The brain is a long game. The first week feels slow. By month 3, it starts feeling magic.

---

## Upgrade Path

```bash
gbrain upgrade                        # auto-update + schema migrations
gbrain apply-migrations --yes         # if manual migration needed
gbrain onboard --check --json         # health check post-upgrade
```

**Before major upgrades:** back up PGLite database:
```bash
cp ~/.gbrain/brain.db ~/.gbrain/brain.db.bak-$(date +%Y%m%d)
```

**When to migrate to Postgres + Supabase:**
- Brain exceeds ~1000 files AND search feels slow
- Multi-device sync becomes needed
- `gbrain onboard --check` recommends migration
- Cost: Supabase Pro ~$25/month
- Migration: `gbrain migrate --to supabase` (bidirectional, lossless)
