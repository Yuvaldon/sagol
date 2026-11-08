# Session 0.7 — Move to vertical slices

Date: 2026-11-08 · Track: docs
Roadmap row: 0.7 · Commits: `docs: move to vertical slices (session 0.7)`

## Done

- **`docs/FEATURE_MAP.md`** (new): working rules, dependency graph and the reasons for the order,
  shared pieces, slice cards V0 to V17 (what the owner sees, work per layer, open items, decisions),
  audits, the Stone 3 tokens, and the mapping from replaced roadmap rows.
- **`CLAUDE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AUDIT.md`, `sessions/TEMPLATE.md`** updated to the
  new method. Roadmap rows 2.x to 7.x and 8.5 are replaced by slices; rows 8.1 to 8.4 keep their ids.
- **`OPEN_ITEMS.md`:** every open item now targets a slice or a row that exists.

## How to see it

Non-code track, nothing to run yet. Read `docs/FEATURE_MAP.md`, section 4.

## Decisions

All approved by the owner in this session:

- D-075: one session = one slice, one commit = one layer.
- D-076: the adapter grows by slice, no stubs, no dead controls, contract suite with a `seed` port.
- D-077: Stone 3 is the visual direction; Heebo is self-hosted.
- D-078: audits follow milestones (A1 to A7); A1 may run alongside V0.
- D-079: the bootstrap owner role holds every valid pair. D-060 leaves no other workable answer.
- D-080: `fake-indexeddb` for data tests.
- D-081: start-of-session reading follows the slice.
- D-082: M5 (go-live) before M6 (completion features).

## Checks

- `npm run check`: green (372 tests). `npm run build` not run: no code changed.

## Open items

- Closed: OI-017 (D-079).
- Opened: OI-030 (V4), OI-031 (V5), OI-032 (owner, later), OI-033 (V0, V1, V3).
- Moved to slices, with notes: OI-002 to OI-007, OI-011 to OI-013, OI-018, OI-019, OI-021, OI-023,
  OI-024, OI-026 to OI-028. The old rows no longer exist. OI-021, OI-023, OI-024, OI-027 and OI-028
  are split by slice, and their notes say which part lands where.
- Partly resolved: OI-015 (part c, D-081). A note was added to OI-008.

## Input for the next session

- **Next: V0, walking skeleton.** Card in `docs/FEATURE_MAP.md`, section 4. It is the largest slice.
  If it will not fit, split at "sign in and see the empty frame", before the bootstrap form.
- **Audit A1 is still `☐`.** It may run alongside V0 without asking (D-078). Accepted findings become
  open items with a target slice.
- **Design source:** the Stone 3 values are in the map, section 6, and the source is the canvas linked
  there. The owner's PDF export of that canvas was not read (no PDF tooling on this machine).
- **Stale comments to fix when V0 touches those files:** they name old rows, in
  `src/ui/AppRoot.tsx`, `src/ui/theme/tailwind.css` and `scripts/guardrails.config.ts`.
- **Not created:** `.env.local`. V0's handoff must give the owner this step, or the app must not need it.
- **Not built yet:** the commit-layer guard. It is V0's first commit, so V0's own commits are guarded.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V0 sets the patterns of every layer, the security path and the design language, and later
  slices repeat whatever it gets wrong.
