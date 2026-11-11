# Session 0.4 — Audit process and next-session recommendation

Date: 2026-11-04 · Track: docs · No source code, tooling or project output touched.
Roadmap row: 0.4 · Commits: `docs: audit process and next-session recommendation (session 0.4)`

## Done

- `docs/AUDIT.md`: who does what, what an audit checks (only what automated checks miss),
  what it must not report, the prompt for the audit session, and model/effort guidance.
- `docs/ROADMAP.md`: audit rows A1 … A8 at the end of each phase, an explanation under the
  status legend, row 0.4.
- `CLAUDE.md`: execution sessions never audit and remind the owner when an audit row is
  next or still pending; every session recommends the next session's model and effort.
- `docs/sessions/TEMPLATE.md`: audit reminder line and a "Recommendation for the next
  session" section with a guide.

## Decisions

- D-051 phase audits are separate, read-only sessions.
- D-052 each session recommends the model and effort for the next one.

## Checks

- `npm run check`: green (docs-only change).

## Open items

- No open items touched. OI-015 trigger check: 20 rows in OPEN_ITEMS, 52 entries in
  DECISIONS. Not reached.

## Input for the next session (1.2 domain)

- Unchanged from `docs/sessions/04-contracts-commands.md` ("Input for the next session").
  Read it as well: this note is a docs interlude, not 1.2's predecessor in content.
- Items targeted at 1.2: OI-009, OI-010, OI-016.

## Recommendation for the next session (D-052)

- Model: the strongest available Claude model · Effort: high
- Reason: 1.2 writes the permission policy and the leave state machine, the security core
  that the data layer and the database policies will mirror.
