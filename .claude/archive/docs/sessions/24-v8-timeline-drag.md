# Session V8 — Timeline drag

Date: 2026-11-11 · Slice: V8
Roadmap row: V8 · Branch: `v8-timeline-drag` · Commits, in order:

- `2d27fdc chore(tooling): the commit-msg check joins a path split at its spaces, as in a worktree`
- `06363b8 docs: V8 decisions D-143 and D-144 (session V8)`
- `89d6656 feat(config): the timeline's drag, the phone's lanes and the draft param (D-143, D-144, OI-067)`
- `482160e feat(logic): what a timeline drag may do and sends, and a new leave's draft in the URL (D-143)`
- `25f0e3d feat(ui): drag math in the timeline core, tested (D-143)`
- `dbb2f3c refactor(ui): rule answers move to patterns, so the timeline can show them too (D-143)`
- `f7cc308 feat(ui): drag to move, resize and create on the timeline, with live rule feedback and a touch path`
- `5a891c7 fix(ui): a drag starts on a mark too, since its button stops the press from reaching the row (D-143)`
- `495e73b test(e2e): V8 demo of drag to create, move and resize, the rule card, and the touch path (D-143, D-144)`
- `37a0c32 fix(ui): ... (review of V8)`
- `docs: close V8 (session V8)`

The session was worked under the owner's autonomy instruction of 2026-11-11: product questions took the recommended
option and were recorded as decisions (D-143, D-144). It stopped once on a usage limit and resumed from the pushed branch.

## Done

- **tooling:** the commit-msg hook failed in a worktree, whose path has spaces; the check joins the split path.
- **docs:** D-143 (move, resize and create by drag, live feedback, the drop as one `update`), D-144 (the touch path, and
  taller lanes on a phone for OI-067).
- **config:** `TIMELINE_DRAG` (threshold, handle, hold, edge scroll), `TIMELINE_LANES_TOUCH`, the search param `draft`.
- **logic:** `useTimelineEditing` (who may move which leave, on whose row a leave may be created, the edit a move sends,
  whether it returns to pending, the leave as rules see it); the day-offset helpers; `NewLeaveDraft` in the URL, carried by
  `usePanel`; `newLeaveValues` takes a draft.
- **ui:** the pure drag math in `engines/timeline/core/drag.ts`; the pointer in `view/useDrag.ts` (mouse past a threshold,
  a finger after a hold, Escape, edge scrolling, a press after a drag does not open the mark); ghosts in the grid; taller
  lanes on a phone; `adapter/boardDrag.ts` and `DragOverlay.tsx` (the card, the refusal, the rule dialog); the new-leave
  form opens from a draft. `RuleViolations`, `RuleGateDialog`, `RuleWarnings`, `ruleAnswer` and `ruleText` moved to
  `ui/patterns/rules`, since an engine never imports a module; `RuleBrief` is new.
- **e2e:** `e2e/drag.spec.ts`: on desktop, drag-create, move, resize, Escape, a press that still opens, a soft rule on the
  card and the acknowledgment on drop, with axe mid-drag; on a phone, a held finger creates and moves, a bar is 28 high
  in a 44 px target, a tap still opens.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization if the store is empty.

1. Open "יחידות", add "מחלקה א". Open "חיילים", add "יעל שחר" in "מחלקה א", placed from 1 January. Add a leave type "בית".
2. On Yael's row, press on Monday and drag to Tuesday. A dashed box marks the days, and a card says "בקשה חדשה · יעל שחר"
   and the days. Release: the new-leave form opens with Yael and the two days. Choose "בית", "לאשר מיד", send.
3. Drag the bar two days to the left (later days in RTL): the card follows the days; release and the bar stays there.
   Drag its left end one day further: it grows by a day. Start a drag and press Escape: it goes back.
4. Open "כללים" and add a rule "לפחות אחד" with "לפחות" 1 and no unit. Drag the bar a day: the ghost has a dashed edge
   and the card names "לפחות אחד" with "רך". Release: the dialog asks; "שמירה בכל זאת" saves it.
5. On a phone (or the browser's device mode with touch): hold a finger still on an empty day, then release: the form
   opens for that day. Hold on a bar, then move: it follows the finger. A finger that moves at once scrolls the board.

## Decisions

- D-143 and D-144, decided under the owner's autonomy instruction: a drop on the same days sends nothing; a hard rule
  is shown before the drop and still sent, so the command's refusal shows (the command is the authority); a drag on
  empty days opens the form, since a leave needs a type; on a phone a finger holds first, and lanes step by 44.

## Checks

- `npm run check`: green (815 tests). `npm run build`: green, with OI-045's size warning.
- Playwright, the whole suite with two workers: 59 passed, 5 skipped (each demo of `drag.spec.ts` runs on its own
  device). A first run had two desktop failures in `rules.spec.ts` and `timeline.spec.ts` while source files changed
  under the dev server mid-run; both passed on a rerun, and the whole suite then passed untouched.

## Review (D-126)

A fresh subagent reviewed the branch's diff read-only: nothing must-fix; a drop sends only the dates, through the gate.
Fixed in this slice: a press on the sticky name column of a scrolled board could mark the day under it; a second drop
while the first waited could clear its ghost (now one drop at a time); Escape also closed a drawer under the drag; a held
drop lost its edge. Left: the rows rebuild on each day a drag crosses (OI-097); a draft link for a soldier the actor
cannot ask for opens a blank form, as any invalid value does; the badge icon's stroke and the "N ימים" text are as V4
and V5 wrote them.

## Open items

- Closed: OI-067 (taller lanes on a phone, D-144).
- Opened: OI-097 (V13, rows rebuilt during a drag).

## Input for the next session

- **Next: audit A4** (filters and rules: UI warnings equal command results). Open a separate read-only session with the
  prompt in `docs/AUDIT.md` (D-051). V8 adds one more place where a warning meets a command: the drag's card
  (`useLeaveRuleWarnings` over the moved leave) against `leaves.update`'s gate.
- After A4, M4 starts with V9 (account linking).

## Recommendation for the next session (D-052)

- Model: Claude Opus 5.5 · Effort: high
- Reason: A4 compares every rule warning on screen with the commands' answers across logic, data and ui, a read-heavy audit.
