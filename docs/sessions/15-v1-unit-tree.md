# Session V1 — Unit tree

Date: 2026-11-08 · Slice: V1
Roadmap row: V1 · Commits, one per layer:

- `b59a710 feat(ui): message for a unit that is not empty`
- `a2462bc feat(contracts): session.can hint, policy targets and unit_not_empty`
- `9d26d2e feat(domain): unit policy targets and the archive check`
- `ee10a71 feat(config): panel ids, the parent URL param and drag constants`
- `2a7ea15 feat(data): unit levels and units with generic reference commands`
- `c1b89e4 feat(logic): unit tree hooks, the can hint and panel state in the URL`
- `104f1ea feat(ui): units drawer, form pattern, palette and the unit tree module`
- `ee1235a feat(app): typed workspace search params on the router`
- `d0b8c86 test(e2e): unit tree demo in Playwright`
- `docs: close V1 (session V1)`

## Done

- **contracts:** `PolicyTarget`, `PermissionCheck`, `SessionPermissions`, and the issue code `unit_not_empty`.
- **domain:** `unitTarget`, `placementTarget`, `archiveUnitIssues`. `PolicyTarget` comes from contracts.
- **config:** `PANEL_IDS`, `PanelId`, `NEW_ENTITY`, the `parent` param, drag and sheet constants.
- **data:** `reference.ts` holds the generic reads, create, update, archive and reorder, in the order of D-090,
  with the version guard. `unit_levels`, `units` with `move`. `actor.ts` holds the actor, the snapshot and
  `session.can`. `checks.ts` holds `colorKeyIssues` and `propertiesIssues`. The contract suite grew by 42 cases,
  with denial paths through seeded grants, in `contract-tests/units.ts`.
- **logic:** `useCan` (fails closed), `useModuleAccess`, `usePanel` and `WorkspaceSearch`, tree rows, drop plans,
  form inputs, unit and level hooks and hints.
- **i18n + ui:** `Drawer`, `SmallDialog`, `ActionMenu`, `EntityForm`, notices, `IconButton`, `SelectField`,
  `ColorField`, 12 palette tokens, the units and levels modules. `docs/Design.md` is settled (D-024).
- **app:** typed search params, kept across the session gate's redirects.
- **e2e:** `e2e/unit-tree.spec.ts`, with helpers in `e2e/support/workspace.ts`, which V0's spec now shares.

## How to see it

Run `npm run dev` and open <http://localhost:5173>. Sign in and claim the organization as in V0, if the store is
empty.

1. Press "יחידות" in the bar. A drawer opens on the left, or a bottom sheet on a narrow window.
2. Open "דרגים" and add גדוד, פלוגה and מחלקה. Reorder them by the handle or by the row's menu.
3. Back in "עץ היחידות", add a unit, then use the row's menu for "הוספת יחידת משנה". Pick a level and a color.
4. Press a unit's name to rename it.
5. Drag a row by its handle: onto the middle of another row it moves inside, and onto the top or bottom edge it
   lands before or after that row.
6. Drag a parent onto its own child. A red message refuses it, and nothing moves.
7. In a row's menu, "העברה ליחידה אחרת" does the same without dragging, and never offers a cycle.
8. Archive a unit that has sub-units: refused with a message. Archive an empty one: a warning says there is no
   way back for now, then it disappears.
9. Copy the address with the drawer open, reload or open it in a new tab: the same panel and form return.
10. Open a second tab. A unit added in one appears in the other. Edit a unit in both and save both: the second
    gets a clear message and offers to load the new version.

## Decisions

- D-087 a moved unit lands last; D-088 archiving; D-089 permissions of the unit commands; D-090 the order of checks;
  D-091 `session.can`; D-092 the drawer. All approved by the owner in one package.
- D-093: a new issue code lands after its message, because the map in `ui` is total and a commit is one layer. The
  session's proposal, told to the owner while building.
- `SessionPermissions` is its own interface for the same reason, recorded in D-091. The call is still `session.can`.

## Checks

- `npm run check`: green (509 tests). `npm run build`: green. Playwright: green, 18 passed and 2 skipped (the
  mobile-only tests on desktop).
- **Found by the demo and fixed:** after a row was archived, focus fell to the body and Escape no longer closed the
  drawer. The drawer now recovers focus on the next key.
- **Drop targets:** they come from the real pointer and `elementsFromPoint`, not from dnd-kit's measured rects, so
  a list that scrolls during a drag stays right. The first failure of the test that led here turned out to be
  the test aiming at a row at the list's edge, where auto-scroll moves the list. Whether the old code had a real
  bug is not proven. The new way is simpler and is the one tested.
- **Not run:** the CI job, because there is no git remote (OI-008). `prefers-reduced-transparency` and
  `prefers-reduced-motion` were not exercised. A drag held at the edge while auto-scroll runs is not tested.
- **Not built:** the drawer has an entry animation and closes without one.

## Open items

- Closed: OI-011, OI-043.
- Updated: OI-019, OI-021, OI-023, OI-033 (now V3 only).
- Opened: none.

## Input for the next session

- **Next: V2, roster.** Card in `docs/FEATURE_MAP.md`, section 4. After it comes audit A2, in a separate session.
- **A new reference table is a spec:** add a `ReferenceSpec` as in `data/local/unitLevels.ts`, add its resource to
  `ReferenceResource`, and use `createReferenceCommands`, `createReferenceRepository`. `command_ranks` has no
  `sort_order`, so `createReferenceRepository`'s ordering needs a choice there.
- **A new module:** `Drawer` hosts it, `usePanel` opens it, a panel id joins `config`, `WorkspaceSearch` covers it.
  `UnitsDrawer` knows its two panels by name, so V2 should turn this into a small panel map in the shell.
- **Archiving a soldier:** `archiveIssues` in `data/local/units.ts` already ignores placements of archived soldiers.
- **A new issue code:** message first, then the code (D-093). Adding a method to an implemented interface breaks
  the implementer's layer in the contracts commit: declare it apart, as with `SessionPermissions`.
- **Shell heredocs:** still fail with long Hebrew text here. Use the file tool.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: V2 follows V1's patterns but touches private fields, membership history and the last-access-manager
  invariant, and it is the last slice before audit A2.
