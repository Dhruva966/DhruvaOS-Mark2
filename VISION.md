# DhruvaOS — Vision

## The Feeling

You wake up. Before you've had coffee, your inbox is already triaged. Your schedule for today
is organized. The research you were going to spend an hour on last night? Synthesized, filed,
and waiting in #research. Three tasks that used to take 45 minutes each? Done.

You text "hey, can you look into X?" and 10 minutes later you have a structured brief.
You say "draft a reply to that email from the recruiter" and 3 minutes later a polished message
is waiting in #corrections for your approval — one reaction and it's sent.

A month from now, you ask it something about a person you met and it remembers. A year from
now, it can tell you how your goals and thinking have changed over time. It knows you. Really
knows you — not in a surveillance way, but in the way a brilliant, trustworthy colleague would
after years of working closely together.

That's DhruvaOS. Tony Stark's Jarvis, built to run your life so you can focus on the things
that actually matter.

---

## What It Is (Not What It Does)

DhruvaOS is not a set of automations. Automations break when conditions change.
DhruvaOS is an agent — it reasons, adapts, and gets smarter. When it encounters something
it doesn't know how to do, it figures it out, then writes itself a skill so it remembers
next time.

It is not a chat assistant you have to prompt carefully. It is a colleague that knows
your context, your priorities, and your preferences — and acts on them proactively.

It is not a productivity hack. It is a permanent multiplier on everything you do.

---

## Core Properties

**Always-on.** Runs 24/7 on the Omen. Doesn't need you to be at your computer.
Morning briefing fires at 8am whether you're awake or not.

**Ambient.** You don't "use" DhruvaOS the way you use an app. It runs in the background,
surfaces what you need, and asks for you when it needs a decision.

**Proactive.** It doesn't wait to be asked. It notices that you have a deadline tomorrow
and reminds you today. It notices that the email from last week is still unanswered.

**Self-improving.** Every novel task it solves teaches it. Every correction you give it
improves it. The dream cycle runs every night and compounds everything it knows.

**Quality-gated.** Anything that leaves DhruvaOS and reaches another human is written at
the highest quality, reviewed by you, and sent only with your explicit approval.
Your voice, your standard, your reputation.

**Loyal.** It does what you actually want, not what's cheapest or easiest. The quality
firewall exists because a system that cuts corners on your behalf isn't working for you.

---

## The 6 Phases (from Mark 1, adapted for Mark 2)

| Phase | Name | What it feels like |
|-------|------|-------------------|
| 1 | Alive | "It responds when I talk to it." |
| 2 | Inbox | "I haven't had to check my email manually in a week." |
| 3 | Menial | "It just handles stuff. I barely think about it." |
| 4 | Self-improving | "I didn't tell it to do that — it figured it out." |
| 5 | Network | "It drafts my LinkedIn posts. I just approve or tweak." |
| 6 | Voice/UI | "I just talk to it. It talks back." |

Phase 4 is the inflection point. Before Phase 4, DhruvaOS does what you've explicitly
built. After Phase 4, it starts building itself. That's when it becomes Jarvis.

---

## What "Smart" Means in Practice

Mark 1 said: "gets smarter every day." Mark 2 makes that concrete.

**Day 1:** DhruvaOS knows what you tell it in setup and whatever is in your Obsidian vault.

**Week 1:** It has processed every Discord conversation. Every mention of a person, project,
or concept is in the brain. Entity graph is forming.

**Month 1:** The dream cycle has run 30 times. Redundant notes are merged. Timelines are
built. Patterns in your thinking are starting to emerge.

**Month 3:** It knows that when you mention a specific person, you probably also care about
a specific project. It knows that you always forget to follow up after certain types of
conversations. It surfaces those gaps before you even notice them.

**Month 12:** You ask it "how has my thinking about X changed?" and it gives you a timeline
of your own beliefs. You ask it "who should I reach out to about Y?" and it knows not just
who you know, but who you know who knows Y, and what you last talked about.

This is not magic. It's the dream cycle running every night on data you've been generating
all along. The brain compounds because every interaction adds signal.

---

## North Star Metrics

Success means:

| Metric | Target |
|--------|--------|
| Morning briefing delivery | Every day by 8:00 AM, without fail |
| Novel task → new skill written | ≥80% of novel tasks produce a reusable skill |
| Outbound sends without approval | 0 — ever |
| Brain growth | ≥10 meaningful nodes/week (via dream cycle) |
| Menial time saved | Dhruva spends <30 min/day on tasks DhruvaOS can handle |
| Correction-handling | Every correction Dhruva gives is written to brain within 5 min |

---

## What DhruvaOS Is Not

- Not a replacement for Dhruva's judgment. It surfaces, drafts, and executes.
  Dhruva decides what matters and approves what goes out.

- Not an always-improving monoculture. The self-improving loop produces new skills,
  but Dhruva reviews every write/shell skill before it becomes trusted.

- Not infallible. It will make mistakes. The correction-handler skill exists exactly for this.
  Every correction improves it permanently.

- Not a privacy risk. The brain lives on the Omen — local, self-hosted, not transmitted
  to any cloud. API calls go to Anthropic/OpenAI but do not contain sensitive brain content
  by default (GBrain retrieves and injects only what's relevant to the query).

---

## Mark 2 vs Mark 1: What Changed

| Dimension | Mark 1 | Mark 2 |
|-----------|--------|--------|
| Infrastructure | Build from scratch (FastAPI, Mem0, Qdrant, Graphify) | Hermes + GBrain (installed, not built) |
| Self-improving | Planned ReviewerAgent + DebateAgent | Real: Hermes skill loop already ships it |
| Memory | Custom Mem0 + Qdrant + graph | Real: GBrain dream cycle already ships it |
| Time to Phase 1 | Months (building infrastructure) | Days (installing Hermes + GBrain) |
| Worker model | 10 hardcoded workers | Dynamic: 8 seeds + agent-authored expansion |

**The vision is identical. The path is dramatically shorter.**

---

## The Promise

DhruvaOS is a personal bet: that the right combination of agent runtime, compounding memory,
and a quality-first ethic can produce something that actually feels like Jarvis — not a
product demo, but a real daily co-pilot that earns trust by being consistently excellent.

The quality firewall is the non-negotiable. Speed without quality is noise.
DhruvaOS is quality-first, always. The approval gate is a feature, not a friction.

When Phase 4 is done and DhruvaOS is writing its own skills, learning from corrections, and
running a dream cycle every night — that's the moment it stops being a tool and starts being
a system. That's the bet.
