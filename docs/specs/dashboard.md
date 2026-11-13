# Spec: Dashboard ("דשבורד")

Status: proposed, not scheduled. The slice gets its V-number, and its P-n get D-numbers, when it starts.
Context: both. On 2026-11-13 the owner renamed it from "situation picture" ("תמונת מצב") and asked for charts and key
figures, not a single number. His example was a fairness table or heat map showing who is mostly on base and who is
mostly at home (D-170: recorded as decided). The joint design of OI-222 (D-272) is replaced by this spec and its
assumptions.

#### Vnn: Dashboard
**Owner sees:** a "דשבורד" module in the presence work. For one unit and one rotation, or a routine range, it shows:
- a row of key figures;
- a fairness heat map, a row per soldier and a column per week, coloured by days at home;
- a daily presence chart, with the days that broke a rule marked;
- the spread of days at home per sub-unit;
- days at home by leave type.

Every number is derived from the approved leaves and the memberships the actor may read. Nothing is stored. The
fairness table can be copied as text or as an image, like דוח 1.
- **contracts:** `DashboardQuery { unit_id, deployment_id | range }`; `PANEL_IDS.dashboard`; `DASHBOARD_WIDGETS`
  (the widget ids, an ordered vocabulary).
- **config:** `DASHBOARD.fairGapDays` (2: a soldier more than 2 days from the median is marked);
  `DASHBOARD.heatBuckets` (the share-of-week thresholds of the heat map's 4 steps).
- **domain:** `daysTally(soldierIds, days, availability, membership) → Map<SoldierId, { base, home, outside }>`
  and `spreadOf(values) → { min, median, max }` in `src/domain/availability/`. Membership comes from
  `createRotationMembership` (D-336); there is no second copy.
- **data:** none. The module reads existing queries.
- **logic:** `useDashboard(query)` builds each widget's rows from one tally (P-4), plus the text lines for copying.
- **ui + i18n:** the module, its pickers, the five widgets (CSS and inline SVG on theme tokens, no chart library,
  P-5), and the copy actions.
- **Open items:** OI-222.
- **Decisions:** D-008, D-019, D-076, D-105, D-211, D-214, D-221, D-257, D-259, D-269, D-272, D-285, D-293, D-333,
  D-336.

## User stories

- Company commander: "Halfway through the rotation I want to see, at a glance, who is mostly on base and who is mostly
  at home, before I approve the next requests."
- Battalion commander: "Per company and platoon, is the leave spread fair, and on which days were we below the
  minimum?"
- Platoon commander: "I send the battalion a picture of my platoon's fairness table, like the morning report."

## Meaning

- **Days counted:** the rotation's days up to today, or to its end if it is over. In routine, the chosen range.
- **Home day:** a day covered by an approved leave whose effect is `unavailable`. This is the board's test
  (`isAvailable(..., APPROVED_ONLY)`).
- **Base day:** a counted day on which the soldier serves (`createRotationMembership(...).servesOn`, D-336) and is not
  at home.
- **Outside day:** a counted day on which the soldier was not a member. It is shown separately and never counted.
- **Median:** the median of home days among the soldiers who served the whole span. **Gap** = home days − median.
- Pending and future leaves are not counted. The "כולל מתוכנן" toggle adds approved future leaves up to the end of
  the rotation, in every widget at once.

## Widgets (P-2)

All five widgets read the same tally and the same soldier set, so they never disagree.

| # | Widget | What it shows | Built from |
|---|---|---|---|
| 1 | **Key figures** | Soldiers in the unit; present today (number and %); at home today; average home days per soldier; the gap between most and fewest home days; requests awaiting the actor (only with `requests:view`, from the existing inbox count) | the tally, `spreadOf`, the inbox query |
| 2 | **Fairness heat map** (the owner's example) | One row per soldier and one column per week of the span. A cell is shaded in 4 steps by the share of that week the soldier was at home. A cell with no service days is blank and hatched. Row-end columns: base, home, gap (marked beyond `fairGapDays`). The default sort is by home days, so mostly-on-base soldiers come first and mostly-at-home soldiers last. Sortable by every column. | `daysTally` per week |
| 3 | **Daily presence** | One bar per day: present soldiers, with the unit's lowest rule minimum as a line where a rule exists. Days with a rule violation get the heat row's mark. | the tally per day, `heatRow` (`src/logic/rules/evaluation.ts:111`) |
| 4 | **Spread per sub-unit** | One strip per direct sub-unit: the fewest, median and most home days, as a range bar with the median marked. It answers the battalion's question. | `spreadOf` per sub-unit (D-105 tree) |
| 5 | **Home days by type** | Horizontal bars: total home days per leave type, in the type's colour (D-112). | the tally split by type |

- A widget with nothing to show (no rules, one sub-unit) is not drawn (D-076).
- Each widget's figures are also available as text: a visually hidden table under each chart, for assistive tech, and
  the copy text. Colour is never the only carrier: the heat map's cells hold the day count in their accessible name,
  and the steps also differ in pattern density.

## Data model

None (D-019, D-272). Nothing is stored: no aggregate, no cache table, no scheduled job (P-1).

## Permissions (P-3)

- The module is shown to whoever may view the unit's leaves (`leaves:view` over the unit), through `useModuleAccess`
  (`src/logic/permissions/hooks.ts:68`). A soldier never sees another soldier's days, so a soldier has no entry.
- The rows are the soldiers the policy lets the actor read. A sub-unit the actor does not cover is not in widget 4.
  Leave types follow the same policy. Requests awaiting the actor appear only with `requests:view`.
- Totals are computed over the visible rows only. A figure never counts a soldier the actor cannot read, so the
  dashboard can never reveal hidden soldiers through an aggregate.

## Server commands

None.

## Free tier (P-1)

- Everything is computed on the client, over the queries the board already makes for the same range: leaves,
  memberships, rules and the inbox count. Opening the dashboard adds no new server query and no new function.
- The span is bounded by `DATE_WINDOW.maxDays` (186). A battalion of about 600 soldiers × 186 days is about 110,000
  availability checks. That is pure, memoised work done in milliseconds, so it needs no worker and no server
  aggregate.

## Screens and flows

- **Module:** a unit picker (the D-105 tree) and a rotation picker (the default is the rotation in view, as in the
  planner), or a routine range. The "כולל מתוכנן" toggle.
- **Layout:** key figures on top. Below them, the heat map at full width (it is the main widget). Then daily presence
  and spread per sub-unit side by side on desktop and stacked on mobile. Home days by type comes last.
- **Interaction:**
  - Pressing a heat-map row opens that soldier's leaves on the board for the span. The link goes through the URL, so
    no UI component reaches into another module.
  - Pressing a day bar opens the day's report (`DayReportDialog`, existing).
- **Copy:** "העתקת טקסט" and "העתקת תמונה" on the heat map. The image is the table (name, base, home, gap) through
  `reportImage(ImageLine[])`.

## Hebrew wording

| Where | Text |
|---|---|
| Module | דשבורד |
| Key figures | חיילים ביחידה · נוכחים היום · בבית היום · ממוצע ימים בבית · פער בין הכי הרבה להכי מעט · ממתינות לי |
| Heat map | הוגנות: מי בעיקר בבסיס ומי בעיקר בבית |
| Heat map columns | שבוע {n} · ימים בבסיס · ימים בבית · פער מהחציון |
| Heat cell (accessible) | {name}, שבוע {n}: {home} ימים בבית מתוך {days} |
| Daily presence | נוכחות יומית |
| Minimum line | מינימום {min} |
| Sub-unit spread | פיזור ימי בית לפי תת-יחידה |
| Spread label | הכי מעט {min} · חציון {median} · הכי הרבה {max} |
| By type | ימי בית לפי סוג |
| Toggle | כולל מתוכנן |
| Copy | העתקת טקסט · העתקת תמונה |
| Empty | אין עדיין ימים לספור בסבב הזה |

## Edge cases

- The rotation has not started: the empty state, plus "כולל מתוכנן" if the rotation has a plan.
- A soldier who joined late or left early has outside days, shown as hatched cells. They are not in the median, which
  counts only soldiers who served the whole span.
- An `available` leave type (a course on base) counts as neither home nor away: it is a base day, and it is not in
  widget 5.
- A routine range over `DATE_WINDOW.maxDays` (186) is refused by the picker, as on the board.
- An attached soldier (`attached-memberships.md`, `missions.md`) is counted in the host by duty unit.
- A one-week span: the heat map has one column and stays useful as the fairness table.

## Acceptance tests

Unit:
- `daysTally`: home, base and outside days; an `available` effect counts as base; pending leaves are ignored. It
  matches the board's `awayDays` on the board's existing tests.
- `spreadOf`: odd, even and empty inputs.
- Each widget's rows from one fixture: totals agree across widgets; the heat buckets fall on the step boundaries.
- Permission scoping: a fixture where a platoon commander's figures equal the tally over their platoon alone.

e2e:
- A rotation with 4 soldiers and known leaves: the key figures, the heat-map cells, the marked gap, the spread and the
  totals by type.
- Copy text matches the table, and the copy image renders.
- A soldier without `leaves:view` over the unit does not see the module.
- A platoon commander sees only their platoon. The key figures count only it, and widget 4 is not drawn.
- Mobile layout, RTL, axe on every widget (the hidden tables are found).

## Proposed decisions

- **P-1** The dashboard is fully derived, from approved leaves, memberships (D-336), rules and the inbox count, over
  queries the board already makes. Nothing is stored, nothing runs on a schedule, and nothing new runs on the server
  (free tier).
- **P-2** The five widgets of the table above, in that order. A widget with nothing to show is not drawn.
- **P-3** Every figure is computed over the soldiers the actor may read. Aggregates never include hidden rows.
- **P-4** One tally per query feeds every widget, so they cannot disagree. The board's 'absent' sort reads the same
  `daysTally`.
- **P-5** Charts are CSS and inline SVG on theme tokens, with no chart library: no new dependency, no bundle cost.
  Every chart has a text equivalent.

## Integration map

**Where it lives.** A new work module in the `presence` section. `WORK_SECTIONS` (`src/config/panels/index.ts:80`)
gains `dashboard`. `ModuleDrawer`'s `GROUPS` (`src/ui/shell/ModuleDrawer.tsx:61`) and `useNavigationEntries`
(`src/ui/shell/moduleEntries.ts`) pick it up. The UI goes in `src/ui/modules/presence/` beside דוח 1, with the widget
primitives (a heat grid, a bar series, a range bar) in `src/ui/primitives/` so a later report can reuse them. This is
a new UI component, which D-333 as amended allows.

**Reuse.**
- Membership: `createRotationMembership` (D-336) is the only test of who serves on which day.
- The tally generalizes the board's inline `awayDays` (`src/logic/board/hooks.ts:81`), which then calls `daysTally`,
  so the dashboard and the board use one count.
- `createAvailabilityContext` (`src/domain/availability/days.ts`) is the only "is at home" test.
- Rule marks: `heatRow` (`src/logic/rules/evaluation.ts:111`) and `useRuleData` (`src/logic/rules/hooks.ts:121`).
- The soldier set: `unitStateOn` (`src/logic/roster/roster.ts:52`).
- Copy: `reportImage(ImageLine[])` (`src/ui/modules/presence/reportImage.ts`). The text follows
  `src/logic/presence/reportText.ts`.
- The day report: `DayReportDialog`.

**Genuinely new.**
- `daysTally` and `spreadOf`.
- The three chart primitives and the five widgets.
- The heat map's soldier rows need their own table on TanStack Table, because the table engine's rows are leaves.
- `dayReport` caps at 7 days (`src/config/report/index.ts`, `maxSpanDays`), so it is not reused for the span.

**Entry points.** Commander and unit manager: the presence group in the drawer, and a "דשבורד" link in a rotation's
details. Soldier: none.

**Indicators.** The gap mark and the rule-violation day marks only. The module entry has no count, because the
dashboard is a report, not a queue.

**Effects.**
- Rules and the heat row: read only.
- דוח 1 (V30): shares the copy mechanism.
- Filters (V33): the board's 'absent' sort calls `daysTally`. Test that it sorts the same.
- Rotations (V26, V31): read only.
- Permissions (V10): policy-scoped rows and aggregates (P-3).
- Import/export (V12) and PWA: none.
- Parity: pure reads, identical on both adapters.

**Rules.** The tally lives in domain, the assembly in logic, thresholds in config, strings in i18n, and colours are
theme tokens (heat steps included).

## Dependencies

None to ship. It reads attached and mission memberships correctly once they exist.

## Assumptions

D-170 defaults; the owner corrects them by reading:

1. **The five widgets, in that order.** The heat map is the main one, after the owner's example.
2. **A course or medical absence of an `unavailable` type** counts as home, like any unavailable leave. A type that
   should not count is set to `available` (one rule, D-032).
3. **Fairness** is the gap in days from the unit's median, not a ratio. Outside days are shown separately.
4. **Level:** the chosen unit as a whole, with sub-units in widget 4. A platoon is picked as its own unit.
5. **Future approved leaves** are not counted by default. "כולל מתוכנן" adds them.
6. **Weeks** are the heat map's columns, because days are too many for 186 days on a phone. A one-week span shows
   one column.
