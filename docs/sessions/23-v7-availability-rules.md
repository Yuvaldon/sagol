# Session V7 — Availability rules

Date: 2026-11-10 · Slice: V7
Roadmap row: V7 · Branch: `v7-availability-rules` · Commits, in order:

- `6034b3d docs: V7 decisions D-137 to D-142 (session V7)`
- `cad2c10 test(domain): the unknown-field case of an update uses the status, not the dates`
- `a869597 feat(contracts): leaves.update takes the dates (D-123, OI-076)`
- `7b0558a feat(domain): a leave of an archived soldier is only cancelled, one edit, and violations name who is unavailable (D-123, D-124, D-138)`
- `a7612db feat(contracts): each day of a rule violation names who is unavailable (D-138, OI-075)`
- `69b048c refactor(domain): the gate builds the contract's RuleViolation and ViolationSoldier`
- `638a3a6 feat(config): the rules panel, and day serves it too (D-140, D-141)`
- `8c69be9 feat(data): availability rules, one edit command, and a leave of an archived soldier is only cancelled (D-123, D-124, D-139)`
- `f9e97ea feat(logic): rules, their evaluation for a window, live warnings, acknowledgments and one edit command`
- `cdec2d5 refactor(data): leaves.reschedule leaves the local adapter (D-123)`
- `8712375 feat(contracts)!: leaves.reschedule leaves the contract (D-123, OI-076)`
- `f8b6d4f refactor(domain): isMaterialReschedule goes with the reschedule command (D-123)`
- `2a933e6 refactor(logic): rule form values hold the bar conditions, not a filter, and a leave candidate type for the UI`
- `845b458 feat(ui): the rules drawer, the heat row, live rule warnings and the acknowledgment dialog`
- `5cb763d test(e2e): V7 demo of rules, the heat row, a soft acknowledgment, a hard refusal and a conflict`
- `e5d81e3 fix(logic): ... (review of V7)`, `bf4782c fix(ui): ... (review of V7)`, `5dc5cb3 test(e2e): an edit is one line in the history (D-123)`
- `docs: close V7 (session V7)`

The contract changes did not come first in one commit: a field the domain fills, and a command two layers still sent,
each needed the layer below to move first so every commit stays green (D-127). Each commit says why.

## Done

- **docs:** D-137 to D-142.
- **contracts:** `leaves.update` takes the dates, `leaves.reschedule` left the contract (D-123); `RuleViolation.days[]`
  names who is unavailable (`ViolationSoldier`, D-138).
- **domain:** `archivedSoldierIssues` (D-124); `leaveEditKind` and dates in `isMaterialLeaveUpdate` (D-123); rule targets
  list their unavailable members, and violations name them.
- **config:** panel `rules`; `day` serves it too.
- **data:** `availability_rules` reads and commands, with references, the filter checks and authority on both ends of a
  move (D-139); one `update` per edit; D-124 in `transition` and `update`. Contract suite: `contract-tests/rules.ts`,
  one `seedRule`, the gate on reopen and on a type change, a refused edit that saves nothing, an unseen soldier named.
- **logic:** `rules/` (form model on the bar's conditions, hints by target, heat row, a day's violations, conflicts, live
  warnings); acknowledged ids on create, edit and steps; one edit command; D-124 hints; editable statuses from domain.
- **ui:** the rules drawer, the heat row, `RuleWarnings` in the new-leave and edit forms, one acknowledgment dialog in the
  new-leave form, the edit form, the details steps, the close dialog and the inbox. On a phone the user menu is an icon.
- **e2e:** `e2e/rules.spec.ts`, desktop and mobile, with axe; `approval.spec.ts` now expects one history line per edit.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization if the store is empty.

1. Open "יחידות" and add "מחלקה א". Open "חיילים" and add two soldiers with the unit "מחלקה א". Add a leave type "בית".
2. Press "כללים" in the bar. Press "כלל חדש": name "שניים במחלקה", "לפחות" 2, "היקף" מחלקה א, and create. The row says
   "לפחות 2 · כולם · מחלקה א" with the chip "רך". A row "כללים" appears under the days of the board.
3. Press "+", choose one of the soldiers, the type "בית", and "לאשר מיד". Before sending, a dashed box says the request
   will break "שניים במחלקה" and names who is missing. Press "שליחה": a dialog asks; press "שמירה בכל זאת". The bar is on
   the board.
4. In the "כללים" row, today's cell shows 1 (dashed). Press it: the drawer shows that day's broken rule and who is missing.
   Days before the soldiers joined show it too, because the platoon had nobody then.
5. Add a rule "לפחות אחד", "אכיפה" קשיח, "לפחות" 1, "היקף" מחלקה א. Request a leave for the second soldier today with
   "לאשר מיד": the form warns that a hard rule will refuse it, and sending shows the refusal with only "סגירה".
6. Add a rule "לכל היותר אחד" with "לכל היותר" 1 on מחלקה א: "התנגשויות" lists it with "שניים במחלקה".

## Decisions

- D-137 OI-042 kept; D-138 a violation names who is unavailable (the owner chose names over the recommended counts only);
  D-139 the rule commands; D-140 the rules drawer; D-141 the heat row; D-142 live warnings and one dialog. The owner
  answered the four questions at the start.
- Settled while building and written into D-140 and D-141 before merging: the population uses the filter bar's check
  lists, and a stored filter the form does not read stays until cleared; a heat cell also counts a target evaluated inside
  the unit with nobody in it (D-072).

## Checks

- `npm run check`: green (792 tests). `npm run build`: green, with OI-045's size warning.
- Playwright, the whole suite with two workers: 54 passed, 3 failed. Two were `approval.spec.ts`, which still expected two
  history lines per edit; it now expects one (D-123) and passes. One was the desktop drag test of `unit-tree.spec.ts`
  (code this slice does not touch); it passed twice in a row on rerun. The rules, leaves and filters demos pass after the
  review fixes. CI's run is in the pull request.

## Review (D-126)

A fresh subagent reviewed the branch's diff read-only: no permission holes, the order of checks, D-123, D-124 and the
retry loop held. Fixed in this slice: an edit's live warning ignored a return to pending (logic); a thrown error during an
acknowledged retry was lost (ui); a warning could count the sent leave twice while in flight (ui); rule vocabulary as
literals (ui); an empty priority saved as 0 (logic); an edit would clear a rule's deployment (logic); candidates rebuilt on
every render (ui). Left as is: a rule edit with nothing changed answers success without a version check, as every
reference form does; the heat cell's name puts the count before its words in code.

## Open items

- Closed: OI-042, OI-066, OI-071, OI-075, OI-076, OI-077, OI-083, OI-084, OI-085, OI-091.
- Opened: OI-094 (V10, live warnings for an actor who cannot read everything), OI-095 (V10, the phone's bottom bar is
  full), OI-096 (V15, deployments in logic's rule data and the form).

## Input for the next session

- **Next: V8, timeline drag.** In scope: OI-067. A drag sends `leaves.update` with the dates only (D-123). Live rule
  feedback while dragging: `useLeaveRuleWarnings(candidate, stored)` with the dragged dates, and the command's answer
  through `useRuleGate` + `RuleGateDialog` (`ui/modules/rules`).
- After V8 comes audit A4 (filters and rules: UI warnings equal command results). Remind the owner at the end of V8.

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 (the strongest available) · Effort: high
- Reason: V8 builds pointer and touch drag in the timeline core with live rule feedback, the hardest interaction left.
