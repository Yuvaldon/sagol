# Session 0.6 — Personal number and invite links

Date: 2026-11-05 · Layer/track: docs
Roadmap row: 0.6 · Commits: `docs: personal number decision and invite-link item (session 0.6)`

## Done

- `docs/DECISIONS.md`: D-069 and its index row; D-066 row marked `ref D-069`.
- `docs/schema.sql`: comments on `soldier_private.personal_id` and
  `account_link_requests.claimed_personal_id` (no structural change).
- `docs/OPEN_ITEMS.md`: OI-026. `docs/ROADMAP.md`: row 0.6.

## Decisions

- D-069: `personal_id` is the military personal number, not the national id. No check-digit
  validation. UI label "מספר אישי".

## Checks

- `npm run check`: green.

## Open items

- Opened: OI-026 (docs/contracts session, before 2.2).

## Input for the next session

- Before 2.2, a docs/contracts session must resolve OI-026 (owner decision on org-wide vs
  sub-unit links, then schema + contracts). UI sessions (4.x, 5.1) label the field "מספר אישי"
  (D-069).
- The next pending row is 1.3 (domain availability and rules). A1 follows 1.4.

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 · Effort: high
- Reason: 1.3 is new domain logic (availability partition, rule evaluation and conflicts).
