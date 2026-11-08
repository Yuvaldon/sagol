# Session 0.8 — Record audit A1

Date: 2026-11-08 · Track: docs
Roadmap row: 0.8, closes A1 · Commits: `docs: record audit A1 (session 0.8)`,
`docs: time source and time zone decisions (session 0.8)`

## Done

- **`docs/audits/A1.md`** (new): the 13 findings with evidence and outcome, the open questions, and
  what was found in order. The audit ran on 2026-11-05. An earlier docs session stopped on its
  questions and wrote nothing, so this session recorded it. `src/` is unchanged since the audit, so
  the evidence still holds.
- **`OPEN_ITEMS.md`:** OI-034 to OI-042 opened. OI-023 (a, d), OI-004, OI-015 and OI-026 updated.
- **`ARCHITECTURE.md`:** config imports `zod`, domain folders, `docs/audits/` (finding 11).
- **`DECISIONS.md`:** D-069 in the D-030 index row (finding 12).
- **`FEATURE_MAP.md`:** cards V0, V7, V9, V10, the M6 note and the audit table.
- **`ROADMAP.md`:** rows 0.8 and A1.

## How to see it

Non-code track, nothing to run. Read `docs/audits/A1.md`.

## Decisions

- D-083: one source of the current time, `TimeSource`, implemented in `app`. D-084: domain validates
  the organization time zone. Both approved by the owner in this session.
- The owner did not answer the audit's other questions and asked to move on, so each became an open
  item that its target slice asks first.
- The findings the owner deferred to "phase 8, before production" (2, 4, 13) target V10, not row
  8.x. V10 writes those commands and D-082 places it before the backend, so they still close before
  production. The owner can move them.
- Finding 11 was fixed in ARCHITECTURE only, because D-074 already implies `zod` in config. No new
  entry was added.

## Checks

- `npm run check`: green (372 tests). `npm run build` not run: no code changed.

## Open items

- Opened: OI-034 (V9), OI-035 (V0), OI-036 (V9), OI-037 (V14), OI-038 to OI-041 (V10), OI-042 (V7).
- Updated: OI-004, OI-015, OI-023, OI-026. No item closed.

## Input for the next session

- **Next: V0, walking skeleton.** No audit is pending. The card now includes a contracts commit
  (`TimeSource`, D-083) and a domain commit (the time-zone check, D-084). The date adapter moved from
  data to `app`. The claim form writes the first time zone.
- The rest of the input in `docs/sessions/12-vertical-transition.md` still applies: stale comments,
  `.env.local`, and the commit-layer guard as V0's first commit.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V0 sets the patterns of every layer, the security path and the design language, and later
  slices repeat whatever it gets wrong.
