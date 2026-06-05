---
name: correction-handler
version: 1.0.0
tier: 2
outbound: false
requires_approval: true
description: "Receive behavioral correction from Dhruva, interpret it, write as permanent GBrain fact. Triggered by /correct command."
schedule: null
gbrain:
  reads: ["concepts/corrections.md"]
  writes: ["concepts/corrections.md"]
tests: tests/correction-handler/
platforms: [linux]
prerequisites:
  env_vars:
    - ANTHROPIC_API_KEY
    - DISCORD_CORRECTIONS_CHANNEL_ID
metadata:
  hermes:
    tags: [Corrections, GBrain, Learning, Discord, Command]
---

# Correction Handler

Triggered by `/correct <text>` in Discord #corrections.
Example: `/correct Don't send email summaries longer than 3 bullets. I want short.`

Interpret the correction, classify it, write it permanently to GBrain, and acknowledge.
This is how DhruvaOS gets smarter about Dhruva's preferences over time.

## Step 1 — Parse Correction Text

Extract everything after `/correct` as the correction text.

If the text is empty: post to #corrections: "Usage: /correct <what I did wrong and what you want instead>"

## Step 2 — Interpret the Correction (Tier 2 Reasoning)

Using your reasoning (Sonnet quality), analyze the correction text and determine:

1. **What behavior is being corrected?** — what did DhruvaOS/Drew do that was wrong?
2. **What should the new behavior be?** — the corrected action, rule, or preference
3. **Correction type:**
   - **BEHAVIOR** — how Drew acts or responds (e.g., "don't do X when Y happens")
   - **FACT** — a factual update to a belief or piece of information
   - **PREFERENCE** — output style, format, length, tone preferences
   - **FORMAT** — how information should be structured or presented
4. **Permanent rule** — a clear, imperative statement the AI can follow consistently

For example:
- Input: "Don't send email summaries longer than 3 bullets"
- Type: PREFERENCE
- Rule: "Email summaries must be ≤3 bullet points. Never exceed this regardless of how many emails there are."

## Step 3 — Write to GBrain corrections.md

Use the `file` tool to read `~/brain/concepts/corrections.md` (or create if missing):

```bash
ls ~/brain/concepts/corrections.md 2>/dev/null || (mkdir -p ~/brain/concepts && echo "# DhruvaOS Corrections Log" > ~/brain/concepts/corrections.md)
```

Read the current content, then **append** the new correction entry in this format:

```markdown
## [YYYY-MM-DD] — [brief title, 3-6 words]

**Type:** [BEHAVIOR|FACT|PREFERENCE|FORMAT]
**What Drew did:** [description of the incorrect behavior]
**Corrected behavior:** [what Drew should do instead]
**Permanent rule:** [imperative statement — this is what GBrain indexes for future reference]

---
```

The `Permanent rule:` line is the most important — it's what GBrain uses when retrieving corrections to guide future behavior.

## Step 4 — Ingest into GBrain

After writing the file, signal GBrain to ingest the update via terminal:

```bash
gbrain import ~/brain/concepts/corrections.md 2>&1
gbrain embed --stale 2>&1
```

If gbrain not in PATH: use `/home/dhruva/.bun/bin/gbrain` as fallback.
Note: do NOT use `--no-embed` flag — verify flag exists before using (`gbrain import --help`).

If file write in Step 3 failed, skip this step and go to error handling immediately.

## Step 5 — Acknowledge in Discord

Use the `messaging` tool to post to channel ID `1507031153209638953` (#corrections):

```
✅ Understood. [one sentence summary of what was corrected]

**Rule added:** [the permanent rule statement]
*This correction is now permanent in GBrain.*
```

No approval needed — this is an internal correction acknowledgment.

## Step 6 — Done

Correction is now in GBrain and will be retrieved whenever relevant context is needed.
Future sessions that search GBrain will find this correction and apply it.

## Error Handling

| Failure | Action |
|---------|--------|
| File write fails | Post error to #corrections, give user the formatted entry to save manually |
| GBrain ingest fails | Acknowledge in Discord anyway — file write is the durable record |
| Cannot interpret correction | Post to #corrections: "I want to make sure I understand. [restate understanding and ask for clarification]" |
