# Spec — Situation picture ("תמונת מצב")

Status: proposed, not scheduled; the joint design (OI-222, D-272) is replaced by the assumed defaults below (D-170). The slice gets its V-number,
and P-n get D-numbers, when it starts.
Context: rotation (D-257); routine reads a chosen date range.

#### Vnn — Situation picture
**Owner sees:** a "תמונת מצב" module under the presence work: for one unit and one rotation, a row per soldier
with days in base, days home and the gap from the unit's middle, sorted by who was home least; above it the
unit's spread (fewest, middle, most). Copy as text or as an image, like דוח 1. Nothing is stored: it is computed
from the approved leaves.
- **contracts:** `SituationQuery { unit_id, deployment_id | range }`; `PANEL_IDS.situation`.
- **config:** `SITUATION.fairGapDays` (2: a soldier more than 2 days from the middle is marked).
- **domain:** `daysTally(soldierIds, days, availability) → Map<SoldierId, { base, home, outside }>` in
  `src/domain/availability/`; `spreadOf(values) → { min, median, max }`; one `servesOn` (whole-unit membership)
  replaces the three copies (P-3).
- **data:** none (reads existing queries).
- **logic:** `useSituation(query)`: the soldiers by duty unit and rotation membership, the tally, the spread, the
  text lines.
- **ui + i18n:** the module: unit and rotation pickers, a spread strip, a soldier-row table, copy text and image.
- **Open items:** OI-222.
- **Decisions:** D-008, D-019, D-076, D-105, D-211, D-214, D-221, D-257, D-259, D-269, D-272, D-285, D-293.

## User stories

- Company commander: "Halfway through the rotation I want to see who has been home least, before I approve
  the next requests."
- Battalion commander: "Per company, is the leave spread fair?"
- Platoon commander: "I send the battalion a picture of my platoon's days, like the morning report."

## Meaning

- **Days counted:** the rotation's days up to today (or to its end if over); in routine, the chosen range.
- **Home day:** a day an approved leave whose effect is `unavailable` covers (the same test as the board's
  "only who is missing", `isAvailable(..., APPROVED_ONLY)`).
- **Base day:** a counted day the soldier serves in the unit and is not home. **Outside:** a counted day the
  soldier was not a member (joined late, left early) — shown, never counted as base or home.
- **Middle:** the median of home days among the unit's soldiers who served the whole span; **gap** = home − median.
- Pending and future leaves are not counted; a toggle "כולל מתוכנן" adds approved future leaves up to the
  rotation's end.

## Data model

None (D-019, D-272).

## Permissions

`useModuleAccess` (`src/logic/permissions/hooks.ts:68`): shown to who may view the unit's leaves (`leaves:view`
over the unit). Rows are the soldiers the policy lets the actor read; nothing new is granted.

## Server commands

None.

## Screens and flows

- **Module:** pickers for unit (D-105 tree) and rotation (default: the one in view, as the planner).
- **Spread strip:** "הכי מעט {min} · אמצע {median} · הכי הרבה {max} ימים בבית".
- **Table:** name, platoon (sub-unit), base, home, gap (marked when beyond `fairGapDays`), outside. Sortable by
  each column; default by home ascending. Pressing a row opens the soldier's leaves on the board for that range.
- **Copy:** "העתקת טקסט" and "העתקת תמונה", the same two actions as דוח 1.

## Hebrew wording

| Where | Text |
|---|---|
| Module | תמונת מצב |
| Columns | ימים בבסיס · ימים בבית · פער מהאמצע · מחוץ ליחידה |
| Spread | הכי מעט {min} · אמצע {median} · הכי הרבה {max} ימים בבית |
| Toggle | כולל מתוכנן |
| Copy | העתקת טקסט · העתקת תמונה |
| Empty | אין עדיין ימים לספור בסבב הזה |

## Edge cases

- The rotation has not started: the empty state, plus "כולל מתוכנן" if it has a plan.
- A soldier attached in (`attached-memberships.md`): counted in the host by duty unit.
- An `available` leave type (course on base): neither home nor away; a base day.
- A routine range over `DATE_WINDOW.maxDays` (186): refused by the picker, like the board.

## Acceptance tests

Unit: `daysTally` (home, base, outside; effect `available` is base; pending ignored); `spreadOf` (odd, even,
empty); `servesOn` matches the three old call sites on their existing tests.

e2e:
- A rotation with 4 soldiers and known leaves: the table's numbers, the spread, the marked gap.
- Copy text matches the table; copy image renders.
- A soldier without `leaves:view` over the unit does not see the module.
- Mobile, RTL, axe on the module.

## Proposed decisions

- **P-1** The situation picture is derived from approved leaves and memberships, per rotation; nothing is stored.
- **P-2** A home day is an approved `unavailable` leave day; days outside membership are shown apart.
- **P-3** Whole-unit membership in a rotation has one domain function, used by rules, the planner, the rotation
  checks and the situation picture.

## Integration map

**Where it lives.** A new work module in the `presence` section: `WORK_SECTIONS`
(`src/config/panels/index.ts:80`, today `['deployments', 'rules']`) gains `situation`; `ModuleDrawer`'s `GROUPS`
(`src/ui/shell/ModuleDrawer.tsx:61`) and `useNavigationEntries` (`src/ui/shell/moduleEntries.ts`, typed by
`WorkModule`) pick it up. The module's UI in `src/ui/modules/presence/` beside דוח 1.

**Reuse.**
- The tally generalizes the inline `awayDays` in `src/logic/board/hooks.ts:78-93` (the board's 'absent' sort,
  `src/logic/board/rows.ts:149`, D-214), which then calls `daysTally`; one count for both.
- `createAvailabilityContext` (`src/domain/availability/days.ts`) is the only "is home" test.
- The soldier set: `unitStateOn` (`src/logic/roster/roster.ts:52`) and the rotation members.
- Copy: `reportImage(ImageLine[])` (`src/ui/modules/presence/reportImage.ts`) is generic; the text follows
  `src/logic/presence/reportText.ts`.

**Genuinely new.**
- `daysTally`, `spreadOf` and the soldier-row table. The table engine's rows are leaves, so this needs its own
  table component on TanStack Table. No chart library: the spread strip is three numbers.
- Unifying whole-unit membership (P-3), a live bug tracked as OI-292 (A8 fixes), which may land it before this
  slice: today `inDeployment` (`src/domain/availability/rules.ts:308`, correct),
  `servedDays` (`src/logic/leaves/planner.ts:126`, misses the subtree) and `WHOLE_UNIT`
  (`src/logic/leaves/rotation.ts:19`) disagree. This slice puts one `servesOn` in domain and moves all three to
  it, first.
- `dayReport` caps at 7 days (`src/config/report/index.ts`, `maxSpanDays`), so the picture does not reuse it.

**Entry points.** Commander and unit manager: the drawer's presence group, and a "תמונת מצב" link in the
rotation's details. Soldier: none (another soldier's days are not theirs to see).

**Indicators.** The gap mark only, since it answers the feature's question (who is behind). No count on the
module entry: it is a report, not a queue.

**Effects.**
- Rules/heat row: untouched; the shared `servesOn` must keep their tests green.
- דוח 1 V30: shares the copy mechanism only.
- Filters V33: the board's 'absent' sort now calls `daysTally`; test that it sorts the same.
- Rotations V26/V31: read only; the planner's `servedDays` fix changes who a plan may include
  (subtree members), so its tests are extended.
- Permissions V10: policy-scoped rows; test a platoon commander sees only their platoon.
- Import/export V12, PWA: none.
- Parity: pure reads over the same queries; identical.

**Rules.** Tally in domain, assembly in logic, thresholds in config, strings in i18n; no UI reaches another
module's UI (the row link goes through the URL).

## Dependencies

None to ship. Reads attached memberships correctly once they exist.

## Assumptions

The joint-design questions (D-272), each with the default this spec builds on (D-170); the owner corrects by
reading:

1. **Numbers looked at first:** days home per soldier and the unit's spread (fewest, middle, most).
2. **A course or medical absence of an `unavailable` type:** counted as home, like any unavailable leave; a type
   that should not count is set to `available` (one rule, D-032).
3. **Fairness:** the gap in days from the unit's median, not a ratio; "outside" days are shown apart.
4. **Level:** the chosen unit as a whole, with the sub-unit as a column; a platoon is picked as its own unit.
5. **Future approved leaves:** not counted by default; "כולל מתוכנן" adds them.

Only approved leaves count.
