# Session 0.5 — Decision index (OI-015, partial)

Date: 2026-11-04 · Track: docs · No source code, tooling or project output touched.
Roadmap row: 0.5 · Commits: `docs: decision index and OI-015 trigger (session 0.5)`

## Done

- `docs/DECISIONS.md`: an index at the top, one row per decision (D-001 … D-062) with
  topic, every affected layer, and the later entries that supersede, amend, refine or
  extend it (taken from each entry's status line). Entry bodies unchanged; D-062 appended.
- `docs/OPEN_ITEMS.md`: OI-015 updated (see below).
- `docs/ROADMAP.md`: row 0.5.
- `docs/sessions/TEMPLATE.md`: a new D-entry adds its index row and fills "changed by".

## Decisions

- D-062 decision index; read rule unchanged (every session still reads every
  start-of-session document); no archive of closed items now; new trigger for the rest of
  OI-015. Product owner decision in this session.

## Checks

- `npm run check`: green. Docs only, no new tests.
- Index rows (62) = entries (62).

## Open items

- OI-015: part (b) done; (a), (c), (d) stay open with the new trigger (D-062). Baseline
  recorded in its Notes.
- No other open items touched.

## Input for the next session (1.2b domain)

- Unchanged from `docs/sessions/06-domain-policy.md` ("Input for the next session").
- Every new D-entry adds its index row (D-062).

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: 1.2b sets new domain rules (leave state machine, link matching, filter canonical
  form) that later layers and the server mirror.
- The phase 1 audit (A1) follows 1.4. It is not next.
