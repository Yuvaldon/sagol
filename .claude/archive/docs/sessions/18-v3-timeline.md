# Session V3 — Timeline grid

Date: 2026-11-09 · Slice: V3
Roadmap row: V3 · Commits, in order:

- `634996a test(e2e): axe waits for animations to end and names each failing element`
- `ba4bb2a docs: timeline decisions D-103 to D-108 (session V3)`
- `a636fed feat(domain): week math and the time left until the next day`
- `4511511 feat(config): the date window and the timeline's density`
- `4670370 feat(logic): view state in the URL, the timeline rows, today at midnight and unit states`
- `ddc4066 feat(config): a narrow weekday format for the days header`
- `28a9054 feat(config): the timeline's row height on touch screens`
- `49d9f06 feat(ui): the timeline grid, the engine registry and the workspace bars`
- `e75b939 refactor(logic): a soldier row has only its unit state`
- `cea1c2b fix(ui): a timeline row's hairline leaves its name the whole row as a touch target`
- `8632d3d test(e2e): timeline demo, reduced motion, and selects scoped to their dialog`
- `741fe47 fix(ui): the drawer lies over the bars and the days header`
- `3853572 test(e2e): the drawer covers the bars`
- `docs: close V3 (session V3)`

## Done

- **e2e first (OI-059):** axe waits for running animations to end, and a failure names each element. The red step was a
  race: the same code passed on the next CI run.
- **domain:** `addDays`, `daysBetween`, `weekdayOf`, `startOfWeek`, `millisecondsUntilNextDay` (a 25-hour night is
  tested).
- **config:** `DATE_WINDOW` (7 days, links up to 62), `TIMELINE_LAYOUT` (rows 36, 44 on touch, groups 32, header 28,
  names 124, days at least 64), the `weekdayNarrow` format.
- **logic:**
  - `view-state/search.ts`: `view`, `from`, `to`, `filter`, `panel`, `entity` and `parent` are typed in the URL.
    `useChangeSearch` keeps what it does not change, so a panel keeps the window and the filter.
  - `useDateWindow`, `useViewFilter` and `useActiveView`.
  - `session/today.ts`: today turns at midnight, and `useCan` is keyed by today.
  - `timeline/`: `timelineItems` and `useTimeline`.
  - `unitStateOn` and `SoldierRow.unitState` (four states).
- **i18n + ui:**
  - `ui/engines/registry` and the timeline engine: a pure `core` with tests, `view/TimelineGrid` with TanStack Virtual,
    and an `adapter` with tests.
  - The `Viewport`, the two-bar workspace, and `UnitSelector`, `ViewSwitcher` and `WindowNavigator`.
  - `useIsDesktop`, `unitStateLabel`, `formatDateRange`, and `EmptyNotice` with a heading level.
  - `docs/Design.md` extended.
- **e2e:** `e2e/timeline.spec.ts` (the board, links, the back button, a name to its soldier, sideways scroll, the drawer
  over the bars, reduced motion). The other specs pick selects inside their dialog.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization if the store is empty.

1. The main screen is now the board. You are its first row, under "ללא יחידה". Today's day is marked by a dark number and
   a faint column. The bar shows this week, for example "8–14 בנוב׳".
2. From "יחידות", add a company and two platoons under it. A unit selector appears in the bar, at "כל הארגון".
3. From "חיילים", add soldiers with ranks and units. Close the drawer. The board groups them under headers such as
   "פלוגה ב׳ · מחלקה א", the most senior first.
4. Open one soldier and move them to another platoon, keeping today's date. Pick the old platoon in the selector: they
   are still there, with the days from today on muted.
5. Press the arrow to the next week. The URL holds `from` and `to`, and "היום" appears. Press the browser's back button,
   then "היום".
6. Copy the URL, open it in a new tab: same unit, same week.
7. Press a name on the board: their page opens in the drawer, and closing it leaves the board as it was.
8. On a phone, or a narrow window: the dates and the unit are at the top, the modules at the bottom, the grid scrolls
   sideways, and the names stay.

## Decisions

- D-103 to D-108, approved in the V3 plan: the window in the URL, the unit in the shared filter, who is a row and how rows
  are grouped, the four unit states, today at midnight, and the two-bar layout.
- **D-109, decided while building, approved by the owner at the end of V3:** a row is grouped by its unit on today if the soldier is in the
  view today, and otherwise on the first day they are. D-105 said "today when the window holds it". Read literally, a
  soldier who left the platoon yesterday would land under a unit outside the selected one.
- No `app` commit: the router already takes `WorkspaceSearch` from `@logic`.

## Checks

- `npm run check`: green (615 tests). `npm run build`: green, with the size warning of OI-045 (now 1.36 MB).
- Playwright: 43 passed and 3 skipped (mobile-only checks on desktop), with `--workers=3` (OI-061).
- CI: green on the V3 push (https://github.com/Yuvaldon/sagol/actions/runs/42694686347), `check` and `e2e`.
- **Found by the demo and the screenshots, and fixed:**
  - The row's border took one pixel of the 44 px name button on mobile.
  - On desktop the bars and the days header painted over the drawer's scrim. The viewport now isolates its own stacking,
    and a test checks the paint order.
- **A note for later specs:** React Aria makes what lies outside a modal `inert`. Screen readers skip it, but Playwright's
  role queries still find it, so a spec picks a select inside its dialog.
- **Not covered on screen:** an actor with partial permissions (none exists before V9), and "לא ידוע" / "יחידה אחרת",
  which are tested in `logic`.

## Open items

- Closed: OI-033 (mobile timeline), OI-048 (D-106), OI-057 (D-107), OI-058 (reduced-motion e2e), OI-059 (axe waits for
  animations; CI green).
- Opened: OI-060 (V10, the board without `organization:view`), OI-061 (V4, local e2e worker count).

## Input for the next session

- **Next: V4, leaves on the timeline.** Ask about OI-030 (what a bar's color means) at the start.
- **Bars on the grid:** `TimelineResourceRow` is the neutral row. V4 adds the bars to it and draws them in
  `view/TimelineGrid.tsx`. Put the lane math in `core`, next to `gridLayout`, `dayOffset` and `spansOf`, and translate
  leaves only in `adapter/model.ts`. The days a row is out of view are already muted.
- **Window and filter:** `useTimeline(window, today, filter)` is where leaves by window join. `DateWindow.days` lists every
  day.
- **A new engine** (V13) is one entry in `ui/engines/registry`. The switcher and the viewport follow it.
- **Config order:** two `config` commits landed after `logic`, because the UI needed values the plan missed. Each commit
  still passed `npm run check`.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V4 writes the first leave commands (state machine, the rule gate, reason checks) and the lanes of the timeline
  engine, which V5, V7 and V8 build on.
