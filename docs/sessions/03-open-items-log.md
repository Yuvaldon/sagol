# Session 0.3 — Open-items log

Date: 2026-11-04 · Track: docs · No source code, tooling or project output touched.
Roadmap row: 0.3 · Commits: `docs: add open-items log and workflow rule (session 0.3)`

## Done

- `docs/OPEN_ITEMS.md` created: rules plus OI-001 … OI-014, collected from the open items
  of handoffs 00, 01 and 02.
- Workflow files updated so every session reads and maintains it: `CLAUDE.md` (read list
  and workflow), `docs/ROADMAP.md` (session steps, row 0.3), `docs/sessions/TEMPLATE.md`
  (open items by id, convention line).

## Decisions

- D-043 open items live in one file (product owner request in this session).

## Checks

- `npm run check`: green (docs-only change).
- Every open item in handoffs 00–02 was reviewed. Not carried over, because they are
  already resolved or informational: `npm install` not run and git init (both resolved in
  0.2); production build reading `.env.local` (intended behavior, documented in 01).

## Open items

- Opened: OI-001 … OI-014 (migrated from earlier handoffs). No items closed.

## Input for the next session (1.1b contracts)

- Read `docs/OPEN_ITEMS.md`. Items targeted at 1.1b: OI-002 (`AuthMode` enum).
- The 1.1b input list in `docs/sessions/02-contracts-entities.md` still applies.
