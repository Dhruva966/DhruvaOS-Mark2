# DhruvaOS Braindump Guide (Phase 4 Prerequisite)

From BUILD_PLAN.md P4.5: "Braindump questionnaire completed — 30-min session"

This questionnaire seeds GBrain with structured knowledge about Dhruva's context,
goals, and relationships. Run before Phase 4 starts. Takes ~30 minutes.

**How to do it:** Open a terminal, start a chat with Drew on Discord, answer each
section. Or write answers directly into `~/brain/` as markdown files.

---

## Section 1 — Identity and Context (10 min)

Save to: `~/brain/goals/about-me.md`

1. What is your current primary focus for the next 6-12 months?
2. What are you studying at UCLA? What's your major/intended track?
3. What projects are you actively working on right now? (list all, including DhruvaOS)
4. What skills are you deliberately building this year?
5. What are your top 3 goals for Year 1 at UCLA?
6. What does a successful week look like for you?
7. Who are the 3-5 most important people in your professional network right now?

---

## Section 2 — Projects (10 min)

Create one file per active project: `~/brain/projects/<project-name>.md`

For each project, answer:
1. What is it? (1-2 sentences)
2. What's the goal?
3. Current status (active/paused/blocked/shipped)?
4. What's the next action?
5. Who else is involved (if anyone)?
6. What's the deadline or target date?

Active projects to document:
- DhruvaOS Mark 2 (this system)
- [add others]

---

## Section 3 — People (5 min)

Create files for key people: `~/brain/people/<name>.md`

For each person:
1. How do you know them?
2. What's your relationship (friend/professor/mentor/collaborator)?
3. What projects are you working on together?
4. Last meaningful interaction (approximate date)?
5. Anything Drew should remember when their name comes up?

---

## Section 4 — Resources and Learning (5 min)

Save to: `~/brain/resources/learning-list.md`

1. What papers/books/courses are you currently working through?
2. What topics do you want to research deeply in the next 3 months?
3. What's a question you've been thinking about lately?
4. What would you want Drew to track from the internet for you?

---

## How to ingest into GBrain

After writing the files, run:

```bash
ssh dhruva@100.119.229.11 "
export PATH=/home/dhruva/.bun/bin:$PATH
gbrain import ~/brain/goals/ 2>&1
gbrain import ~/brain/projects/ 2>&1
gbrain import ~/brain/people/ 2>&1
gbrain import ~/brain/resources/ 2>&1
gbrain embed --all 2>&1
gbrain onboard --check --json
"
```

Verify: `gbrain onboard --check --json` should show 0 recommendations and stats > initial counts.

---

## After the braindump

Test that GBrain knows you:

```bash
ssh dhruva@100.119.229.11 "
export PATH=/home/dhruva/.bun/bin:$PATH
gbrain think 'What are Dhruva\\'s current goals and priorities?'
gbrain search 'active projects status'
"
```

Good response = GBrain returns specific, accurate information from your files.
Bad response = generic or empty = braindump not indexed yet, retry embed.
