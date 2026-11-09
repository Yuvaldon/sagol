# Session A2 — Audit of M1, and its record

Date: 2026-11-09 · Track: audit, then docs
Roadmap row: A2 · Commit: `docs: record audit A2 (session A2)`

The audit ran read-only and reported in chat. After the owner accepted the findings and answered the
questions, the same session recorded them. No code changed.

## Done

- **`docs/audits/A2.md`** (new): 13 findings, the owner's answers, what was checked.
- **`DECISIONS.md`:** D-101 (commands store blank optional text as NULL), D-102 (private fields and placements
  are read with their own `view`). Index rows for D-018, D-045 and D-096 updated.
- **`OPEN_ITEMS.md`:** OI-047 to OI-058 opened. OI-008 updated: the owner chose to set up the remote now.
- **`FEATURE_MAP.md`:** cards V3, V4, V9, V10, V12 and the audit table.
- **`ARCHITECTURE.md`:** `config/panels` in the folder list (note 11).
- **`ROADMAP.md`:** A2 ☑.

## How to see it

Read `docs/audits/A2.md`. Nothing on screen changed.

## Decisions

- D-101 and D-102, both approved by the owner in the A2 review.

## Open items

- Opened: OI-047 … OI-058. Updated: OI-008.

## Input for the next session

- **Next: V3, timeline grid.** Its card now also holds OI-048 (what "no unit" means on a row), OI-057
  (midnight) and OI-058 (reduced motion).
- **OI-008:** the remote is set up after this commit, if the owner created the empty repository. The first CI
  run closes it, in the session that sees it.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V3 builds the engine registry, the timeline core and view state in the URL, which every later view
  reuses.
