# Session V2 — Roster

Date: 2026-11-09 · Slice: V2
Roadmap row: V2 · Commits, in order:

- `docs: roster decisions D-094 to D-100 (session V2)`
- `feat(ui): message for a rank that soldiers hold`
- `feat(contracts): rank_in_use issue code`
- `feat(domain): membership change plan, soldier target and the rank archive check`
- `refactor(ui): a map of what opens in the module drawer`
- `feat(config): soldiers and ranks panels, virtual list constants`
- `feat(data): command ranks, soldiers, private fields and memberships`
- `feat(app): hand the time source to logic`
- `feat(logic): roster view model, forms, hooks and hints; time source port`
- `feat(ui): soldiers and ranks modules, virtual list and date field`
- `refactor(app): return the ports directly now that logic requires time`
- `test(e2e): roster demo in Playwright`
- `docs: close V2 (session V2)`

## Done

- **contracts:** the issue code `rank_in_use`.
- **domain:** `membershipChangeIssues`, `planMembershipChange`, `soldierTarget`, `archiveRankIssues`, `dayBefore`.
  `soldier_private` accepts a unit or organization target for creation (D-096).
- **config:** panels `soldiers` and `command_ranks`, `VIRTUAL_LIST`.
- **data:** `commandRanks.ts`, `soldiers.ts` (soldiers, `soldier_private`, `unit_memberships`, `create`, `update`,
  `archive`, `updatePrivate`, `changeMembership`). `requireAccessManager` in `snapshot.ts` is the helper of OI-021 (a).
  `createReferenceRepository` takes its order, and `ReferenceInputs` gained `afterWrite`. The contract suite grew by 44
  cases in `contract-tests/roster.ts`, and `contract-tests/support.ts` holds what the slices share.
- **logic:** `queries/command.ts` (`useCommand`, now shared), `roster/` (view model, search, history, forms, hooks, hints),
  `useToday`. `LogicPorts` holds `time`.
- **i18n + ui:** `ModuleDrawer` (the panel map V1 asked for), `VirtualList`, `DateField`, `formatDate`, the soldiers and
  ranks modules. `docs/Design.md` extended.
- **e2e:** `e2e/roster.spec.ts`.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization, if the store is empty. Add a
few units from "יחידות" first.

1. Press "חיילים" in the bar. You are already on the list, as the soldier who claimed the organization.
2. Open "דרגות" and add לוחם and then מפקד כיתה. Each new rank starts on top, with its seniority number. Open one and
   change the number: the order follows.
3. Back in "רשימת החיילים", press "חייל חדש". Fill in only the names and press "יצירה". The row says "ללא יחידה".
4. Add another soldier with a rank, a unit and a personal number (try `012-345`). The row shows the rank and the unit.
5. Reload the page and open that soldier. The number reads `12345`, and the unit is still there.
6. Give another soldier `12 345`. "כבר קיים" appears under the field.
7. On a soldier's page, press "העברה ליחידה אחרת", pick a unit and keep today's date. If the placement started today,
   the row is corrected and no history appears. Create a soldier with an earlier placement date, move them, and the
   history shows both rows.
8. Pick a date before the placement: refused on the field. Pick "ללא יחידה" on the placement's first day: refused too.
9. Archive a soldier from the row's menu. The warning says there is no way back and the number stays taken.
10. Archive yourself, or set yourself to "לא פעיל": refused with "חייב להישאר לפחות מנהל גישה אחד בארגון".
11. Archive a rank that someone holds: refused. Archive a unit with a soldier in it: refused until they leave. After
    that, their history shows the unit's name, marked "בארכיון".
12. Type part of a name in the search, without final letters if you like.
13. Open a soldier in a second tab and save there. Saving the first tab's form gets a clear message and offers the new
    version.

## Decisions

- D-094 the drawer and its fields; D-095 ranks; D-096 permissions; D-097 membership changes; D-098 archiving a soldier;
  D-099 unit names in history. All approved by the owner in one package.
- D-100: `app` provides a new port one commit before `logic` requires it. Told to the owner in the plan.
- D-096 adds what the plan left open: `soldier_private` takes a unit or organization target on creation, so the
  check runs before the write (D-090) and the form can ask the same question as the command.

## Checks

- `npm run check`: green (584 tests). `npm run build`: green, with the size warning of OI-045. Playwright: green, 39 passed
  and 3 skipped (the mobile-only tests on desktop).
- **Found by looking at screenshots and fixed:** the date field read backwards in RTL; the empty workspace still said
  there were no soldiers; the move dialog's explanation was unclear.
- **Found by the demo and fixed:** forms keyed by version reset silently when another tab saved, which threw away what
  was typed. They now hold what they opened and answer `stale_version`, as D-012 asks.
- **The access-manager check after a membership change cannot refuse today:** a manager's scope is `organization`, which
  does not depend on a unit (D-059). The card asks for it, so it runs, and the test proves that the last manager can move.
- **Not run:** the CI job, because there is no git remote (OI-008). `prefers-reduced-transparency` and
  `prefers-reduced-motion` were not exercised. Hints for a soldier with partial permissions are tested in `logic` and the
  contract suite, not on screen, because a second linked identity arrives in V9.

## Open items

- Opened: OI-046 (V9).
- Updated: OI-019, OI-021, OI-023, OI-038, OI-045.
- Closed: none.

## Input for the next session

- **Next: audit A2. Open a separate read-only session with the prompt in `docs/AUDIT.md`.** It closes M1. After it comes
  V3, the timeline grid.
- **For V3:** `useToday`, `soldierRows` and `useMemberships` already give rows by unit. A row of the timeline needs a day
  other than today, so `soldierRows` takes `today` as a plain argument.
- **A long list:** `VirtualList` needs `DrawerScrollContext`, so it works inside a drawer only. The timeline has its
  own scroller and would need that part changed.
- **A new module:** add a section to `GROUPS` in `ui/shell/ModuleDrawer.tsx` and a check to `useModuleAccess`.
- **A non-reference table:** `createReferenceRepository` takes a compare function, and a table with a key other than `id`
  writes its own reads, as `soldier_private` does.
- **Shell heredocs:** still fail with long Hebrew text here. Write a script with the file tool, then run it.

## Recommendation for the next session (D-052)

- Model: Opus 5.5, or the strongest available · Effort: high
- Reason: `docs/AUDIT.md` asks for it: an audit is judgment over the whole milestone, with the first full data layer, the
  first UI and the no-bypass rule to check.
