# Session A3 record — V5 merged, audit A3 recorded

Date: 2026-11-10 · Track: tooling (the V5 pull request), then docs
Roadmap rows: V5 (merged), A3 and 0.9 · Branches: `v5-approval` (merged), `a3-audit`

The audit ran in its own read-only session and reported in chat. The owner accepted every finding and every technical
recommendation, and answered the two product questions: a leave of an archived soldier can only be cancelled, and inactive
soldiers stay out of the new-leave form until V6. This session closed V5 and then recorded the audit. No `src/` file changed.

## Done

- **V5 merged.** Its CI failed on V4's leaves demo: "Test timeout of 30000ms exceeded" on the runner, with other demos
  passing only on retry. Measured here: the two longest demos take 22 s with two workers, spread over 7-8 steps of 1.5-5 s,
  steady over three repeats, with no race and no dependency reload of the dev server. `playwright.config.ts` now gives a
  test 60 s (`DEMO_TIMEOUT_MS`), with the measurement in a comment, and the V5 handoff says so. CI then passed 53 of 53
  with no retry, and the pull request merged with its commits.
- **`docs/audits/A3.md`** (new): ten findings in part 1, seven recommendations in part 2, the five questions and their
  answers, what was checked.
- **`DECISIONS.md`:** D-123 (one edit command), D-124 (an archived soldier's leave: only cancel), D-125 (active soldiers
  only in the new-leave form until V6), D-126 (done = merged with CI green, after the CI suite locally and a read-only
  review of the diff), D-127 (one green commit per layer, no fixed order), D-128 (the open-items archive, one slice per
  item, the current state in ARCHITECTURE and Design.md), D-129 (two behaviors of the leaves panel from V5). The index and
  the "Changed by" column of the entries they change are updated.
- **`OPEN_ITEMS.md`:** the findings as items, the multi-slice items split, closed rows moved to the new
  `docs/OPEN_ITEMS_ARCHIVE.md`, and the file's rules follow D-128.
- **`ARCHITECTURE.md`:** the leave workflow as it stands now (commands, comments, screens, what V7 changes), the view
  engines read their state from the URL through `logic`, iron rule 1 with D-127.
- **`FEATURE_MAP.md`:** the working rules and "done" follow D-126 to D-128; the cards V6 to V10 and M6 list the new items
  and decisions; A3 done.
- **`ROADMAP.md`:** A3 ☑ with its report, row 0.9, the session steps, and what ☑ means on `main`.
- **`CLAUDE.md`, `AUDIT.md`:** the commit rule, the end of a slice (CI suite, diff review, merge), the archive, the current
  state; audits read `main`.

## How to see it

No screen changed. The report is `docs/audits/A3.md`; the decisions are D-123 to D-129 at the end of `docs/DECISIONS.md`.

## Decisions

- D-123 to D-129, above. D-124 and D-125 are the owner's answers. The others follow the audit's technical recommendations,
  which the owner accepted.
- The e2e budget is a tooling setting, like OI-061's worker count, not a decision: the comment in `playwright.config.ts`
  and the V5 handoff hold the measurement.

## Checks

- V5: `npm run check` green (722 tests), the whole Playwright suite green locally (53 passed, 3 skipped as mobile-only),
  CI green on the pull request.
- This branch changes documents only. CI runs on its pull request.

## Open items

- Closed: OI-015 (D-128). Split and closed: OI-021 → OI-068, OI-069; OI-023 → OI-070 … OI-074; OI-027 → OI-074, OI-075;
  OI-028 → OI-090, OI-091.
- Opened from A3: OI-076, OI-077, OI-083, OI-084, OI-085 (V7); OI-078, OI-079, OI-082, OI-086, OI-087, OI-089 (V6);
  OI-080 (V14); OI-081 (V15); OI-088 (V13).
- Widened: OI-049 (leaves too, V10), OI-060 (the new-leave form too, V10).
- Moved to `docs/OPEN_ITEMS_ARCHIVE.md`: every closed row, 35 of them.

## Input for the next session

- **Next: V6, tags and filters** (the owner chose M3 after M2, OI-031). In scope: OI-012 (a product question, asked at the
  start), OI-070, OI-078 (its second part asked at the end), OI-079, OI-082, OI-086, OI-087, OI-089, OI-090.
- D-126 applies from V6: run the whole Playwright suite locally before the handoff, review the diff read-only before the
  merge, and list the review's findings in the handoff.
- D-127: no fixed layer order; keep each commit green and one layer.
- D-128: move the rows you close to the archive, and update the current state in `ARCHITECTURE.md` (filters, the board)
  and `Design.md` (the filter bar, chips, the present and absent panel).
- OI-079 builds the one source of filter data in `logic`; V7's rules and the heat row read it too.

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 (the strongest available) · Effort: high
- Reason: V6 opens the shared filter model on screen, which V7's rules and the heat row lean on, and it starts the review
  step of D-126.
