# Investing Intelligence System — Build Plan

## Project Intent

Build a portfolio-aware investing intelligence system that turns a holdings snapshot and fresh
financial information into evidence-backed research, then evolves into important-news alerting
and decision support.

This is a project inside DhruvaOS, but its first versions are runtime-neutral. The initial
implementation does not depend on Hermes, GBrain, Discord, or any particular model provider.
Those can become adapters later; they are not prerequisites for the core system.

## Current Design Decisions — 2026-07-27

### System roles

Use the smallest stack that covers the current need:

- **Google Finance:** portfolio dashboard, scheduled research tasks, market context, earnings
  calendar, and fast portfolio/watchlist questions.
- **Ekpa:** portfolio-aware news, filings, position research, and important-move alerts. Treat it
  as a read-only portfolio intelligence layer, not as the system of record for decisions.
- **ChatGPT:** independent deep research, source reconciliation, thesis challenge, and final
  synthesis when a question deserves more scrutiny than a template briefing.

Do not add another research platform until this combination demonstrates a real gap. More tools
would currently create duplicated outputs and conflicting interpretations.

### Alpaca connection

**Decision: do not connect directly to Alpaca yet.** Connect the brokerage to Ekpa using its
read-only flow if the account is supported, and use Ekpa’s portfolio view for the current manual
research phase.

The reason is separation of risk and responsibility: Ekpa’s public product description says its
brokerage connection is read-only, cannot place or cancel orders, and cannot move cash. Direct
Alpaca access is valuable later because Alpaca exposes account, positions, orders, calendar,
portfolio history, streaming, and market-data APIs—but those capabilities are unnecessary for the
manual research phase and introduce credential and execution risk.

Direct Alpaca integration becomes eligible only when a later phase needs one of these capabilities:

- A custom event monitor that must receive raw market/news streams.
- Exact position, order, fill, and account-history data outside Ekpa’s refresh cycle.
- Paper-trading experiments or a separately approved execution workflow.

When that time comes, start with a paper account and separate credentials. Never give a research
agent live trading credentials, and never make live execution part of an alerting phase by
implication.

Vendor facts were checked against [Ekpa’s public product description](https://goekpa.com/) and
[Alpaca’s Trading API documentation](https://docs.alpaca.markets/us/docs/trading-api) on
2026-07-27.

### What “durable decision history” means

This is not a large trading database. It is a small, timestamped journal attached to each material
event or position:

```text
date · ticker · event · evidence links · thesis impact · options considered · decision/action
· reason · review date · later outcome
```

Its purpose is to prevent hindsight rewriting and let us evaluate whether alerts and analysis were
actually useful. It is deferred for now, but Phase 2 should leave room for it.

### Valuable additions

The next highest-value inputs are personal context, not more vendors:

- Investment horizon and objective.
- A short thesis for each concentrated or actively managed position.
- Maximum acceptable concentration or loss boundaries.
- Upcoming earnings, filings, and known catalysts.
- Benchmark and sector exposure for detecting accidental concentration.
- A clear distinction between “research further,” “monitor,” and “consider changing position.”

Tax-lot optimization, brokerage execution, automated rebalancing, and custom email/SMS routing are
out of scope until the research workflow proves its value.

## Operating Principle

Every phase is a complete, usable system on its own. A later phase may reuse concepts and data
formats from an earlier phase, but it must not require an unfinished earlier phase to function.
Each phase is a better replacement for the previous user experience, not an incomplete feature
added onto it.

```text
Phase 1: Manual Research Brief
    ↓
Phase 2: Manual Portfolio Decision Brief
    ↓
Phase 3: Important-News Event Monitor
    ↓
Phase 4: Event-Triggered Decision Support
    ↓
Phase 5: Calibration and Review
```

## Non-Goals and Safety Boundary

- “All relevant news” is not a valid operating requirement. Relevance must be defined by the
  portfolio, investment thesis, time horizon, and materiality rules.
- The system may analyze holdings and present options, but it must not place trades, alter
  brokerage positions, or send an external message without an explicit approval boundary.
- A holdings screenshot is an input, not ground truth. Ticker, quantity, cost basis, account,
  and timestamp must be extracted with confidence and visibly confirmed when uncertain.
- News, filings, earnings releases, transcripts, and analyst commentary must be labeled by
  source type. Facts, interpretations, and speculation must not be blended.
- A fast alert is not automatically a useful alert. False positives, duplicates, stale stories,
  and market-wide noise must be measured before increasing automation.

## Shared Concepts

### Portfolio snapshot

At minimum: issuer, ticker, position quantity when visible, approximate position size or weight
when available, source image or input, capture time, and extraction confidence. Optional context:
cost basis, account, investment thesis, time horizon, risk tolerance, and watchlist.

### Research event

At minimum: issuer or affected entity, event type, publication time, source, source tier,
materiality, affected thesis or risk, factual summary, uncertainty, and whether the event is new
or a duplicate.

### Decision brief

A human-readable output separating:

- What happened
- What is verified
- Why it may matter to this portfolio
- What could make that interpretation wrong
- What should be watched next
- Possible actions, if requested, clearly labeled as options rather than executed decisions

## Source Hierarchy

The system should prefer, in order:

1. Regulatory filings and official exchange notices.
2. Company investor-relations releases, earnings reports, guidance, and transcripts.
3. Official government, central-bank, or industry data where relevant.
4. High-quality financial reporting with named sources and publication timestamps.
5. Analyst research and commentary, explicitly labeled as opinion or estimate.

Any source connector used in a phase must expose its URL, publication time, retrieval time, and
source category so the final report can be audited.

## Phase 1 — Manual Research Brief

### Purpose

Produce one trustworthy, on-demand research brief from a holdings screenshot and a user-supplied
research window. This phase proves that the system can identify the portfolio correctly, find
material information, and explain it without inventing certainty.

### User experience

The user supplies a holdings screenshot and optionally names a lookback window, themes, or one
question. The system returns a report for that single run. No persistent monitoring or proactive
notification is required.

### Required behavior

- Extract visible holdings into a normalized portfolio table.
- Mark every uncertain extraction instead of silently guessing.
- Research relevant company, sector, macro, filing, earnings, and corporate-action information.
- Deduplicate stories that describe the same event.
- Prefer primary sources and attach citations to material claims.
- Separate verified facts, interpretation, and unresolved questions.
- Explain portfolio relevance without pretending to know the user’s full thesis when it was not
  provided.
- Make no trade and send no alert.

### Completion gate

Phase 1 passes only when a user can inspect one report and answer “what happened, how do we know,
why might it matter, and what remains uncertain?” Every position in the report must either be
traceable to the screenshot or marked unknown. Every material claim must have a source.

### Standalone verification

- Run with a new screenshot and no prior system state.
- Confirm the normalized holdings table against the image.
- Check that each report claim has a source and timestamp.
- Check that the report contains no unsupported buy, sell, or hold instruction.
- Repeat with an ambiguous or cropped screenshot and confirm uncertainty is surfaced.

## Phase 2 — Manual Portfolio Decision Brief

### Purpose

Provide a stronger, still-manual system that combines the current portfolio with explicit thesis,
time-horizon, and risk context. It is a complete replacement for Phase 1, not a required second
step after it.

### User experience

The user supplies a holdings snapshot plus any available thesis and constraints. A single manual
run returns a portfolio-level brief that ranks what deserves attention and describes decision
options and watch conditions.

### Required behavior

- Run independently from a fresh portfolio snapshot.
- Reuse Phase 1’s evidence discipline, but add position size, concentration, thesis, horizon,
  and risk context when available.
- Rank events by likely portfolio materiality rather than headline popularity.
- Compare new evidence with the stated thesis and identify whether it strengthens, weakens, or does
  not yet change that thesis.
- Present base, upside, and downside interpretations where the evidence supports them.
- State what additional evidence would change the conclusion.
- Keep recommendations advisory and explicit; do not execute or imply certainty.

### Completion gate

Phase 2 passes only when the report is more useful for portfolio decisions than Phase 1 while
remaining auditable: position context is visible, thesis impact is explained, counterevidence is
included, and uncertainty is not hidden behind a score.

### Standalone verification

- Run with a fresh screenshot and manually supplied thesis context, without importing a Phase 1
  report.
- Remove the thesis context and confirm the system degrades honestly instead of fabricating one.
- Check that event ranking changes when position size or thesis relevance changes.
- Check that suggested options are not phrased as executed actions.
- Have an independent reviewer trace the highest-priority conclusion back to its sources.

## Phase 3 — Important-News Event Monitor

### Purpose

Replace the manual research trigger with a monitor that detects new, portfolio-relevant events and
flags only those that clear a defined materiality bar.

### User experience

The user configures the portfolio and monitoring rules once. When a genuinely important event is
detected, the system produces a concise evidence-backed flag. Routine noise remains silent or is
available for review.

### Required behavior

- Ingest news, filings, earnings releases, transcripts, and other approved sources.
- Identify affected holdings and distinguish new events from updates, duplicates, and commentary.
- Apply explicit materiality rules based on issuer, event type, thesis relevance, and expected
  portfolio impact.
- Preserve source and timing metadata.
- Deliver a notification through a configurable channel only after dry-run validation.
- Do not turn the flag into an automatic trade or an unreviewed position recommendation.

### Completion gate

Phase 3 passes only when it can demonstrate that important events are surfaced, duplicate and
low-value events are suppressed, notification delivery is reliable, and every alert can be
replayed from its source evidence.

### Standalone verification

- Replay a known historical set containing important events, duplicates, and irrelevant headlines.
- Measure detection, duplicate suppression, and false-positive behavior separately.
- Verify notification failure does not erase the underlying event record.
- Verify the system can be run without Phase 1 or Phase 2 being active.

## Phase 4 — Event-Triggered Decision Support

### Purpose

Turn a material event into a timely decision brief: what changed, how it affects the current
position and thesis, what options exist, and what evidence would justify waiting.

### User experience

An important event creates an alert and an attached decision brief. The user can acknowledge,
request deeper analysis, or reject the interpretation. No external action occurs automatically.

### Required behavior

- Combine event evidence with the current portfolio snapshot and decision context.
- Re-run verification before producing a recommendation.
- Distinguish “monitor,” “research further,” and potential portfolio actions.
- Show counterarguments, uncertainty, and time sensitivity.
- Require explicit user approval before any future integration could draft or send an external
  message or interact with a brokerage.

### Completion gate

Phase 4 passes only when an alert is both timely and decision-useful, with a clear audit trail from
event to sources to portfolio impact to user choice.

### Standalone verification

- Trigger the system from a captured event without requiring Phase 3 to be running.
- Confirm the brief identifies stale, conflicting, or insufficient evidence.
- Confirm user rejection and approval are both recorded distinctly.
- Confirm no action is executed from an alert alone.

## Phase 5 — Calibration and Review

### Purpose

Measure whether the system is improving decisions rather than merely generating more information.

### Required behavior

- Review alerts for relevance, timeliness, factual accuracy, and usefulness.
- Track false positives, missed events, duplicate alerts, and thesis changes.
- Compare the system’s interpretation with later evidence without rewriting history.
- Identify which source types and event classes deserve more or less attention.
- Produce a review report that can change monitoring rules deliberately.

### Completion gate

Phase 5 passes only when the system can show where it was useful, where it failed, and what rule
changed as a result. It must not optimize for alert volume.

## Upgrade Rules

- Do not begin Phase 2 until Phase 1’s completion gate passes on multiple fresh screenshots.
- Do not begin Phase 3 until Phase 2 demonstrates that materiality can be explained, not just
  scored.
- Do not enable proactive notifications until Phase 3 has replay evidence and a dry-run report.
- Do not add brokerage or outbound execution to this plan without a separately approved phase.
- When upgrading, preserve the previous phase as a fallback mode until the new phase passes its
  own standalone gate.
- Every phase must be runnable from a documented input, produce inspectable artifacts, and fail
  visibly when source or extraction confidence is inadequate.

## Initial Build Order

1. Capture and normalize one real holdings screenshot.
2. Write the Phase 1 input/output contract and source policy.
3. Implement and test the Phase 1 manual brief.
4. Run Phase 1 against multiple screenshots and revise the extraction and relevance rules.
5. Define the Phase 2 thesis and decision-context schema.
6. Implement Phase 2 as a standalone manual run.
7. Only after the Phase 2 gate passes, design event ingestion and notification delivery for Phase 3.
