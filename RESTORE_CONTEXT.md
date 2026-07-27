# Restore Context

## Repo State

| Item | Value |
|------|-------|
| Repo | `/Users/dhruvavutukury/conductor/workspaces/DhruvaOS Mark 2/lagos` |
| Remote | `origin` → `https://github.com/Dhruva966/DhruvaOS-Mark2.git` |
| Branch | `hermes-research-digest-planning` |
| Target branch | `origin/main` |
| Latest commit | `8accb7a chore: record maintenance loop observation` |
| Worktree | `BUILD_PLAN.md` modified; `INVESTING_BUILD_PLAN.md` new; `insights-report-2026-07-25.html` untracked and preserved untouched |

## Product Intent

Build an investing intelligence system inside DhruvaOS as a runtime-neutral project. It starts
with a manual holdings/news research brief and later evolves into important-news monitoring and
decision support. Each phase must be a complete, independently usable vertical slice.

## Non-Negotiables

- Phase 1 and Phase 2 must work independently; later phases are replacement-grade upgrades, not
  unfinished dependencies.
- Google Finance is the dashboard/scheduled-brief layer.
- Ekpa is the portfolio-aware, read-only news/filings/position-intelligence layer.
- ChatGPT is the independent researcher, source reconciler, and thesis challenger.
- Do not connect directly to Alpaca yet. Consider direct Alpaca only for a later custom monitor,
  exact order/history data, paper trading, or separately approved execution.
- Never provide live trading credentials to a research agent.
- No brokerage execution, automated rebalancing, or custom email/SMS routing in the current scope.
- Prefer filings, official company/IR material, government/industry data, then quality reporting;
  label analyst opinion separately.

## Implemented So Far

- Created [`INVESTING_BUILD_PLAN.md`](INVESTING_BUILD_PLAN.md) with five phases:
  manual research brief, manual portfolio decision brief, important-news event monitor,
  event-triggered decision support, and calibration/review.
- Added standalone completion gates, verification checks, shared portfolio/event/decision-brief
  concepts, source hierarchy, upgrade rules, and initial build order.
- Added the investing project pointer to [`BUILD_PLAN.md`](BUILD_PLAN.md).
- Recorded current design decisions in the investing plan, including the deferred direct Alpaca
  connection and the meaning of a future durable decision history.
- No runtime code, Hermes configuration, GBrain configuration, or credentials were changed.

## Verification

Documentation-only verification completed:

```bash
git diff --check
grep -n '^##\|^###' INVESTING_BUILD_PLAN.md
```

No application tests were run because no application code changed.

## Next Best Steps

1. Receive the holdings screenshot or a ticker/quantity list.
2. Confirm the normalized portfolio and any uncertain fields before research.
3. Define the Phase 1 input/output contract: research window, source policy, report sections,
   and acceptance criteria.
4. Run the first manual research brief using Google Finance, Ekpa, and current cited research.
5. Only after repeated Phase 1 success, add thesis/risk context for the standalone Phase 2 brief.

## Files To Read First Next Session

- `CLAUDE.md`
- `AGENTS.md`
- `INVESTING_BUILD_PLAN.md`
- `BUILD_PLAN.md`
