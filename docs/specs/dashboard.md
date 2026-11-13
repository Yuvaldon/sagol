# Spec: Dashboard ("דשבורד")

Status: spec-complete (D-347, D-348), not scheduled. The slice gets its V-number, and its P-n get D-numbers, when it
starts. It is excluded from the current autonomous build: the owner decides when it is built (OI-222).
Context: both (rotation and routine). On 2026-11-13 the owner renamed it from "situation picture" ("תמונת מצב") and
asked for charts and key figures, not a single number (D-338). The same day the owner set its shape: command boards
built from a fixed catalogue of modules, two or three templates or a board of one's own, and a small fixed personal
board for every soldier (D-347, D-348). D-343 names the readers: the platoon commanders run the leaves, the company
commander plans and controls, and a rotation's report owner reads the daily report.

#### Vnn: Dashboard
**Owner sees:** two things.
- **"דשבורד"**, a work module in the presence group, for commanders. For one unit and one rotation (or a routine
  range) it shows a board of modules: big numbers, the fairness heat map, a presence trend against the rules' minimum,
  plan against actual, fairness per platoon, presence per platoon, a distribution, home days by type, who leaves and
  returns soon, what waits for me, and the daily report's status. The board opens on a template that fits the unit
  (a platoon gets "ניהול יציאות", a company "תכנון ובקרה"), with no setup. A commander may pick another template, or
  press "התאמה" and add, remove and reorder modules; "חזרה לתבנית" undoes it. Only that choice is stored.
- **"הסבב שלי"**, at the top of "שלי" for every soldier, commanders included: my days on base and at home in this
  rotation, each against the rotation's total and with its completion rate; my open requests and the share approved;
  my next leave, and the days left in my rotation. It is fixed: nobody configures it.

Every figure is derived from leaves, leave events, memberships (D-336), rules and confirmations the actor may read.
Nothing derived is stored.
- **contracts:** vocabularies `DASHBOARD_MODULE_IDS`, `DASHBOARD_METRIC_IDS`, `DASHBOARD_TEMPLATE_IDS`;
  `DashboardModule` (one module on a board) and `DashboardLayout` (P-6); `SoldierPreferences` gains `dashboard`;
  `PANEL_IDS.dashboard`; query `LeaveEventSpanQuery` (P-9).
- **config:** `DASHBOARD_TEMPLATES` (each template's ordered modules, P-5); `DASHBOARD` thresholds
  (`fairGapDays`, `heatSteps`, `upcomingDays`, `outstandingDays`, `distributionBins`, `outstandingLimit`);
  `WORK_SECTIONS.presence` gains `dashboard`.
- **domain:** in `src/domain/availability/`: `daysTally`, `spreadOf`, `weeksOf`; in a new `src/domain/dashboard/`:
  `leaveAsOf` (replay of `leave_events`), `defaultTemplate`, `layoutModules` (template or custom → modules), and
  `myRotationFigures` (the personal board).
- **data:** `leave_events.list` accepts `LeaveEventSpanQuery { deployment_id, soldier_ids }` besides the per-leave
  thread query, in both adapters, under the same read policy as the thread. No table, no column, no function.
- **logic:** `useDashboardScope()` (URL state), `useDashboardLayout()` (stored choice, edits, reset),
  `useDashboard(scope, modules)` (one tally, each visible module's rows), `useMyRotation()` (the personal board).
- **ui + i18n:** the module with its pickers, the board, the eleven module cards, the edit mode, the "הסבב שלי"
  section; chart primitives on CSS and inline SVG (P-11).
- **Open items:** OI-222.
- **Decisions:** D-003, D-008, D-013, D-019, D-023, D-032, D-041, D-076, D-102, D-105, D-112, D-141, D-170, D-174,
  D-187, D-211, D-214, D-221, D-253, D-257, D-259, D-265, D-269, D-270, D-272, D-285, D-290, D-293, D-333, D-336,
  D-338, D-342, D-343, D-345, D-347, D-348.

## User stories

Platoon commander (מ"מ), who runs the leaves (D-343):
- "Before I approve the next request I want to see who in my platoon is mostly on base and who is mostly at home."
- "I want to see, on one screen, the requests waiting for me and who leaves or comes back in the next days."
- "I send the company a picture of my platoon's fairness table."
- "I want my board to open ready, without setting anything up."

Company commander (מ"פ), who plans and controls (D-343):
- "Is the leave spread fair across my platoons, not only inside each one?"
- "How far has the rotation drifted from the plan we started with?"
- "On which days were we, or will we be, below the minimum, and in which platoon?"
- "I want the heat map too, but under the broad picture, not on top."

Report owner (D-293):
- "Each morning I want to see which units have confirmed today's report, and how many are present and at home."

Any commander:
- "I want to drop the modules I never read and put the one I read first on top, and undo it if I regret it."

Every soldier, commanders included:
- "How many of my rotation's days have I done on base, and how many at home, out of what is planned for me?"
- "Do I have open requests, and how many of my requests were approved?"
- "When is my next leave, and how many days are left in my rotation?"

## Meaning

Shared by every module and by the personal board (P-2):
- **Span:** a rotation (`deployments`, `start_date` … `end_date`), or in routine a chosen range bounded by
  `DATE_WINDOW.maxDays` (186). A rotation with an open end runs to today for past figures; its total is unknown.
- **Counted days:** the span's days up to today, or to the span's end if it is over. "כולל מתוכנן" counts the whole
  span, future days included.
- **Served day:** a day on which the soldier serves in the rotation (`createRotationMembership(...).servesOn`,
  D-336). In routine, a day the soldier holds a membership in the chosen unit's tree.
- **Home day:** a served day covered by an approved leave whose effect is `unavailable` (the leave's override, else
  its type's, D-032): `isAvailable(..., APPROVED_ONLY)` is false. One day counts once, however many leaves cover it
  (D-012).
- **Base day:** a served day that is not a home day. A leave of an `available` type (a course on base) leaves a base
  day.
- **Outside day:** a span day on which the soldier does not serve. It is shown (hatched) and never counted.
- **Full-span soldier:** one with no outside day in the counted days. **Median** of home days is taken over them only.
  **Gap** = a soldier's home days − the median; it is marked beyond `DASHBOARD.fairGapDays` (2).
- **Present today:** a soldier who serves today and is not at home today.
- **Required:** a rule's minimum for a target on a day, as the heat row evaluates it (D-141). "Below the minimum" is a
  day with at least one broken hard or soft target in the chosen unit's tree.
- **Plan (P-9):** the leaves as they stood at the start of the span's first day (organization's day, D-214),
  rebuilt from `leave_events`. **Actual:** the leaves as they are now. Both count home days the same way.
- **A request:** a leave of the soldier, created by the soldier (`created_by` = `soldier_id`), whose type is not in
  the built-in "סבב יציאות" group (D-345). A routine leave, and a leave a commander set for the soldier, are not
  requests. **Open:** status `pending`. **Approval rate:** approved ÷ (approved + rejected) over the span's requests;
  cancelled requests are withdrawn, not decided, and are left out.
- Pending and future leaves are not counted, except where a module says so and under "כולל מתוכנן".

## The command board

### Scope and inputs (P-3)

- **Unit:** a unit from the D-105 tree that the actor holds `leaves:view` over. The picker offers only those. The
  default is the actor's own unit (the policy unit, D-054) when they hold the right there, else the first unit they
  hold it on.
- **Span:** the rotation in view, as in the planner, or a routine range. Default: the current rotation of the unit, else
  the last one; in routine, the board's current window.
- **"כולל מתוכנן":** off by default. On, every module counts the whole span and approved future leaves.
- All three live in the URL (`unit`, `deployment` or `from`/`to`, `planned`), D-023, so a link opens the same board
  for anyone who may read it, filtered by their own rights.
- **Rows:** the soldiers who serve in the span in the unit's tree and whom the policy lets the actor read
  (`unitStateOn`, D-336). Every module counts only these rows (P-4).

### The module catalogue (P-1)

Eleven modules. Each reads the shared tally of the scope, so modules never disagree. A module whose data the actor may
not read, or that has nothing to show for the scope, is not drawn and is not offered in "הוספת רכיב" (D-076).

| Id | Name (proposal) | What it shows | Derivation | Drawn when |
|---|---|---|---|---|
| `stat` | מספר | One big number with a short label and, where one exists, a secondary line (a share, or "מתוך"). It takes one `metric` (table below). A board holds at most one `stat` per metric; consecutive `stat` modules sit in one row. | per metric | per metric |
| `heat_map` | מפת חום: הוגנות | A row per soldier, a column per week of the span (`weeksOf`, Sunday-first, the span's first and last weeks partial). A cell is shaded in `DASHBOARD.heatSteps` (4) steps by the share of the week's served days the soldier was at home; a week with no served day is blank and hatched. Row-end columns: base, home, gap (marked). Sorted by home days ascending (mostly on base first); every column sorts. | `daysTally` per soldier per week | at least one row |
| `presence_trend` | נוכחות מול הנדרש | A bar per counted day: present soldiers. The lowest required minimum of the day, where a rule exists, as a step line. Days below the minimum carry the heat row's mark (hard solid, soft dashed, D-141). Past days solid, future days (under "כולל מתוכנן") lighter. | the tally per day; `heatRow` (`src/logic/rules/evaluation.ts:111`) | at least one counted day |
| `plan_vs_actual` | תכנון מול ביצוע | Per direct sub-unit (or per soldier when the unit has none): two bars, planned home days and actual home days over the counted days, and the difference. A line under it: leaves added, cancelled and moved since the plan. | `leaveAsOf` at the plan instant vs current leaves, one `daysTally` each (P-9) | a rotation span (not a routine range) that has started |
| `fairness_spread` | הוגנות בין תת-יחידות | One strip per direct sub-unit: fewest, median and most home days among its full-span soldiers, as a range bar with the median marked, and the unit's median as a reference line across the strips. | `spreadOf` per sub-unit (D-105 tree) | at least two direct sub-units with rows |
| `presence_by_unit` | נוכחות לפי תת-יחידה | One horizontal bar per direct sub-unit: present today ÷ serving today, with the sub-unit's strictest required minimum for today as a tick where a rule exists. A sub-unit below it is marked. | the tally for today; the rule evaluation for today | at least two direct sub-units with rows |
| `home_distribution` | התפלגות ימי בית | A histogram: how many full-span soldiers have each range of home days, in `DASHBOARD.distributionBins` (6) equal bins from 0 to the most, with the median marked. | `daysTally`, binned | at least three full-span soldiers |
| `home_by_type` | ימי בית לפי סוג | Horizontal bars: home days per leave type over the counted days, in the type's colour (D-112), largest first. The built-in "סבב יציאות" types (D-345) are one bar. | the tally split by the type of the covering leave (the first by type `sort_order` when several cover a day) | at least one home day |
| `upcoming` | יוצאים וחוזרים | The next `DASHBOARD.upcomingDays` (7) days: per day, who leaves (an approved leave starts) and who returns (one ended the day before), names and type. Pending leaves shown dashed (D-290). | approved and pending leaves of the rows | always (empty: "אין יציאות וחזרות בשבוע הקרוב") |
| `outstanding` | ממתין לטיפול | Up to `DASHBOARD.outstandingLimit` (10) items, oldest first: requests awaiting the actor (each opens the request), and the next `DASHBOARD.outstandingDays` (14) days that break a rule counting approved and pending leaves (each opens the rules panel on that day, D-134). A "עוד {n}" line opens the requests hub. | the inbox query (`usePendingRequests`), the rule evaluation ahead | the actor holds `leaves:approve` or sees a rule in the unit |
| `report_status` | סטטוס דוח 1 | Today's report (and tomorrow's after the organization's cut-over hour, as דוח 1 does): each unit section confirmed, not confirmed, or "changed since" (D-293), and the totals present / at home. Pressing it opens the day report. | `useReportConfirmations` (existing) for today | the span is a rotation and the actor may read its confirmations |

### Big-number metrics (`DASHBOARD_METRIC_IDS`)

| Metric | Label (proposal) | Number | Secondary line | Drawn when |
|---|---|---|---|---|
| `present_today` | נוכחים היום | present today | "{n}% מהמשרתים" | the span holds today |
| `home_today` | בבית היום | at home today | "{n}% מהמשרתים" | the span holds today |
| `serving` | משרתים בסבב | rows | "{n} משרתים היום" | always |
| `avg_home_days` | ממוצע ימים בבית | mean home days per full-span soldier, one decimal | "חציון {median}" | at least one full-span soldier |
| `fairness_gap` | פער הוגנות | most − fewest home days among full-span soldiers | "{n} חיילים חורגים" (beyond `fairGapDays`) | at least two full-span soldiers |
| `below_minimum_days` | ימים מתחת למינימום | counted days below the minimum | "הבא: {date}" (the next such day ahead, approved and pending) | the actor sees a rule in the unit |
| `plan_drift` | סטייה מהתכנון | actual − planned home days over the counted days, signed | "{n} שינויים" | as `plan_vs_actual` |
| `awaiting_me` | ממתינות לי | requests awaiting the actor in the unit | none | the actor holds `leaves:approve` over a row |
| `unconfirmed_units` | יחידות שלא אישרו | unit sections not confirmed for today's report | "מתוך {n}" | as `report_status` |

### Templates (P-5)

Templates are code in `config` (`DASHBOARD_TEMPLATES`), keyed by `DASHBOARD_TEMPLATE_IDS` from contracts. They are not
data: no table, no admin screen. A template is an ordered list of `DashboardModule`; a module the actor may not see is
skipped when drawn, never removed from the template.

| Template | For | Modules, in order |
|---|---|---|
| `leaves` "ניהול יציאות" | platoon commanders who run the leaves | `stat` present_today · `stat` home_today · `stat` awaiting_me · `stat` fairness_gap · `heat_map` · `outstanding` · `upcoming` · `presence_trend` |
| `control` "תכנון ובקרה" | the company commander | `stat` present_today · `stat` below_minimum_days · `stat` plan_drift · `stat` fairness_gap · `plan_vs_actual` · `fairness_spread` · `presence_by_unit` · `presence_trend` · `home_distribution` · `heat_map` |
| `report` "דוח יומי" | the report owner | `stat` present_today · `stat` home_today · `stat` unconfirmed_units · `report_status` · `upcoming` · `presence_trend` |

- **The default** (`defaultTemplate(scope, rows)`, pure): `control` when the chosen unit has at least two direct
  sub-units with rows, else `leaves`. It is decided per scope, so a company commander who picks one platoon sees
  `leaves` there. `report` is never a default; it is one press away. Nobody configures a board per commander (P-5).
- `home_by_type` is in no template; it is offered in "הוספת רכיב".

### Layout storage (P-6)

Only the choice is stored, per person, in `soldier_preferences.preferences.dashboard` (D-041):

```ts
DASHBOARD_MODULE_IDS = ['stat', 'heat_map', 'presence_trend', 'plan_vs_actual', 'fairness_spread',
  'presence_by_unit', 'home_distribution', 'home_by_type', 'upcoming', 'outstanding', 'report_status'] as const
DASHBOARD_METRIC_IDS = ['present_today', 'home_today', 'serving', 'avg_home_days', 'fairness_gap',
  'below_minimum_days', 'plan_drift', 'awaiting_me', 'unconfirmed_units'] as const
DASHBOARD_TEMPLATE_IDS = ['leaves', 'control', 'report'] as const
DASHBOARD_MAX_MODULES = 20

DashboardModule = z.discriminatedUnion('module', [
  z.strictObject({ module: z.literal('stat'), metric: z.enum(DASHBOARD_METRIC_IDS) }),
  z.strictObject({ module: z.enum(DASHBOARD_MODULE_IDS).exclude(['stat']) }),
])
DashboardLayout = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('template'), template: z.enum(DASHBOARD_TEMPLATE_IDS) }),
  z.strictObject({ kind: z.literal('custom'), modules: DashboardModules }),  // 0 … DASHBOARD_MAX_MODULES, unique
])
SoldierPreferences += { dashboard: DashboardLayout.nullable().default(null) }   // NULL = the default template
```

- `DashboardModules` is the list with two read rules, so a stored row always parses: an item whose module or metric
  id is no longer in the vocabulary is dropped (a removed module never breaks preferences), and a repeat (the same
  module, or a `stat` with the same metric) keeps the first. Writes are validated strictly: unknown ids, repeats and
  more than `DASHBOARD_MAX_MODULES` are refused (`validation`).
- A layout is one per person, not per unit: it is the shape of the board; the scope chooses what it counts. A custom
  board shown on a scope where a module has nothing to show simply skips it.
- An empty custom board is valid; it shows "הלוח ריק" with "הוספת רכיב" and "חזרה לתבנית".
- Never stored: the default template, any figure, the tally, sort orders of the heat map, the scope (URL).

### Editing (P-7)

- **Template picker** at the board's head: a `Segmented` of the three templates, plus "מותאם אישית" while the layout is
  custom. Picking a template stores `{ kind: 'template' }` (or `null` when it is the scope's default, so the default
  keeps following the scope). Leaving a custom layout asks first ("הלוח המותאם יימחק"), since it is not kept.
- **"התאמה"** enters edit mode on the current board (the template's modules become the starting custom list). Each card
  shows "הזזה למעלה", "הזזה למטה" and "הסרה" (buttons, so keyboard and screen readers work, and RTL needs no mirrored
  drag). On desktop, a card can also be dragged by its handle (react-aria's drag and drop, already a dependency
  through react-aria-components) with the same result. "הוספת רכיב" opens a list of the modules not on the board that
  are drawable for the scope; `stat` opens its metrics. A new module goes last. "סיום" leaves edit mode.
- Each change saves at once through `accounts.updateMyPreferences` (existing serialized saves and D-187 failure
  notice); there is no separate save. An edit that changes nothing is not written.
- **"חזרה לתבנית"** (in edit mode and on an empty board): picks a template, defaulting to the scope's default, and
  stores `null` for the default or `{ kind: 'template' }`.
- Edit mode is local view state; it is not in the URL and holds a history entry (D-337), so Back leaves it.

### Interaction

- A heat-map row opens that soldier's leaves on the board for the span (through the URL; no UI component reaches into
  another module). A heat cell opens the same, scrolled to the week.
- A `presence_trend` bar opens the day's report (`DayReportDialog`). A marked day's mark opens the rules panel on that
  day (D-134).
- A `plan_vs_actual` or `fairness_spread` strip, and a `presence_by_unit` bar, narrow the board's unit to that sub-unit
  (URL `unit`), and Back returns (D-332).
- `upcoming` and `outstanding` items open the leave details, the request or the rules panel.
- **Copy:** the heat map has "העתקת טקסט" and "העתקת תמונה", as דוח 1: the table (name, base, home, gap) through
  `reportImage(ImageLine[])`, the text after `src/logic/presence/reportText.ts`. The copy covers the rows the actor
  sees, nothing more.

### Layout on screen (P-11)

- **Desktop** (≥ the app's `lg` breakpoint): a 12-column grid. `stat` cards take 3 columns each and wrap in a row;
  `heat_map`, `presence_trend` and `plan_vs_actual` take 12; the others take 6, two side by side in board order.
- **Tablet:** `stat` 6, the rest 12. **Phone:** `stat` cards two per row (6 of 12); every other module full width,
  stacked in board order. The heat map scrolls inside its own frame horizontally (weeks), with the names column sticky
  on the start side; the page never scrolls sideways.
- **RTL:** the grid flows from the right. Time axes run right to left, like the board's timeline: the first day or
  week on the right. Range bars and horizontal bars grow from the start (right) edge. Numbers use `tabular-nums` and
  are isolated (`dir="ltr"` spans only around signed numbers, e.g. "−3").
- Each card: a title, the module's body, and where it applies a one-line note of what it counts ("לפי {n} ימים").
  Colours are theme tokens: the heat steps, the hard/soft marks and the plan/actual pair; light by default, and the
  dark theme reads the same tokens (D-181).
- **Accessibility:** every chart has a visually hidden table of its figures; a heat cell's accessible name holds the
  numbers ("{name}, שבוע {n}: {home} ימים בבית מתוך {days}"); colour is never the only carrier: heat steps also differ
  in pattern density, rule marks by solid/dashed and a count. Axe runs on every module.

## The personal board: "הסבב שלי" (P-10)

Fixed, not composable, the same for everyone; a soldier never configures it and nothing of it is stored.

- **Where:** the top of "שלי" (`MyLeavesModule`), above "my next days" (D-265). Not in the profile, which holds only
  settings (D-253). A commander sees their own, there, like any soldier; it never shows anyone else's days.
- **Span:** the rotation the soldier serves in today, else the next one they will serve in, else the last one they
  served in (a closed rotation shows final figures). In routine, with no rotation, the section is not drawn (D-076).
- **Cards** (all over the soldier's own served days in that rotation, `daysOf`, D-336):

| Card (proposal) | Main | Secondary | Completion |
|---|---|---|---|
| ימים בבסיס | base days so far | "מתוך {b} מתוכננים · {t} ימי סבב" | base days so far ÷ planned base days |
| ימים בבית | home days so far | "מתוך {h} מתוכננים" | home days so far ÷ planned home days |
| בקשות פתוחות | open requests | "{p}% מהבקשות אושרו" ("—" with no decided request) | none |
| היציאה הבאה | the next approved home day's date, "בעוד {n} ימים" | its type, and "עד {date}" | none |
| עד סוף הסבב | served days left after today | "יום אחרון: {date}" | elapsed served days ÷ all served days |

- **Definitions:** total served days `t` = |`daysOf`|. Planned home days `h` = served days covered by an approved
  `unavailable` leave over the whole rotation, future included. Planned base days `b` = `t` − `h`. "So far" counts
  served days up to and including today. A completion rate is a bar with its percent; when its denominator is 0 (no
  home days planned) the card shows the number without a bar.
- **Open end:** a rotation with no `end_date` has no total: the base and home cards show "so far" only, and "עד סוף
  הסבב" is not drawn.
- **Not started:** the base and home cards show 0 of the planned, "היציאה הבאה" shows the first leave, and "עד סוף
  הסבב" says "הסבב מתחיל ב-{date}".
- **Next leave:** none planned: "אין יציאה מתוכננת". The soldier at home today: "בבית עד {date}" instead.
- Pressing a card: the requests card scrolls to the open requests below; the next-leave card opens that leave. The
  others do nothing (they are figures, not controls, so they are not buttons).
- **Layout:** phone, two cards per row with "עד סוף הסבב" full width; desktop, one row of five. RTL as above.
- **No peer comparison:** the soldier's figures are never set against a unit median or another soldier, which would
  reveal what the soldier may not read (P-4).

## Data model

- **No table, no column** (D-019). One JSONB key: `soldier_preferences.preferences.dashboard` (P-6).

```diff
 "preferences" JSONB NOT NULL DEFAULT '{}',  -- validated by contracts SoldierPreferences:
                                             -- create_leaves_as_approved (D-121),
                                             -- appearance (D-181);
+                                            -- dashboard (D-347): the board's template or custom modules;
```

- The slice's first commit updates `schema.sql`'s comment, `DECISIONS.md` and `contracts` together (rule 5). A stored
  row without the key reads `null` (the default template).

## Queries and commands (P-9)

| Kind | Name | Input | Output | Notes |
|---|---|---|---|---|
| query (existing) | `leaves.list` | `LeaveQuery` | `Leave[]` | the span's leaves of the rows; the board already makes it |
| query (existing) | memberships, deployment members, units, rules, leave types | existing | existing | through `useRotationMembership`, `useRuleData` |
| query (existing) | inbox count / `usePendingRequests` | existing | existing | only with `leaves:approve` |
| query (existing) | report confirmations | existing | existing | only for `report_status` / `unconfirmed_units` |
| query (new mode) | `leave_events.list` | `LeaveEventSpanQuery { deployment_id, soldier_ids }` | `LeaveEvent[]` | the events of the rotation's leaves of those soldiers; same policy as the thread (an event is read when its leave is read). Loaded only while `plan_vs_actual` or `plan_drift` is on the board |
| command (existing) | `accounts.updateMyPreferences` | carries `dashboard` | existing | own row only |

- `leave_events.list` takes `LeaveThreadQuery | LeaveEventSpanQuery` (a union of strict objects), resolved in one
  read in each adapter, with the server's read policy applied to the leaves first. It is the same query the
  notifications spec's feed would generalize; whichever slice comes second reuses the first's seam.
- No server command, no function, no scheduled job, no cache table.

### `leaveAsOf(leave, events, instant)` (domain, pure)

- Events of the leave with `created_at` ≤ `instant`, in order. None (the leave did not exist yet): `null`.
- Status: the last event's `to_status`, else the `created` event's. Dates: the current dates, rolled back through each
  later `rescheduled` / `updated` event's `changes.before` of `start_date` / `end_date` (newest first).
- A leave with no `created` event at all (rows from before events were kept, or an import, D-171) is taken as it is
  now, so it adds no drift; the module's note says "{n} בקשות ללא היסטוריה".
- The plan instant is the start of the span's first day in the organization's time zone (D-214).

## Permissions (P-4)

- **The module** is shown to whoever holds `leaves:view` over at least one unit, through `useModuleAccess`
  (`src/logic/permissions/hooks.ts:68`); a soldier without it has no entry and the URL opens nothing (no bypass).
- **Rows** are the soldiers the policy lets the actor read in the chosen unit. Every aggregate, median, spread and
  count is over those rows only; a figure never counts a soldier the actor cannot read, so no module reveals hidden
  soldiers through an aggregate. A sub-unit with no readable row is not in the per-sub-unit modules.
- **Per module:** `outstanding` and `awaiting_me` need `leaves:approve`; rule figures need the rules the actor sees
  (as the heat row); `report_status` and `unconfirmed_units` need the confirmations read the day report uses; leave
  types follow their read; `plan_vs_actual` reads events only of leaves already read.
- **The layout** is the actor's own preference row; no permission resource, an active linked account required (as
  `updateMyPreferences`). A layout grants nothing: a stored module the actor may not read is not drawn.
- **The personal board** reads only the actor's own leaves and memberships (the `self` scope of the soldier role,
  D-003). If the actor's roles do not grant reading their own memberships, the section is not drawn.
- The same queries go through the same policy in both adapters; local mode passes because of a real grant (D-076).

## Free tier (P-8)

- Everything is computed on the client over queries the board already makes for the same span. The only new read is
  the events of the span's leaves, and only while a plan module is on the board: for a battalion of about 600
  soldiers with about ten leaves each and three events per leave, about 18,000 small rows, once per span, cached by the
  query client.
- The tally is pure and memoised: 600 soldiers × 186 days is about 110,000 availability checks, done in milliseconds;
  the plan adds one more tally. No worker, no server aggregate, no new function invocation, no paid service.

## Screens and flows

**Command board ("דשבורד", presence group of the drawer, and a "דשבורד" link in a rotation's details)**
1. Opens on the scope's default (URL, else the actor's unit and current rotation) and the stored layout, else the
   default template.
2. Head: unit picker, span picker, "כולל מתוכנן", template picker, "התאמה".
3. The board, in layout order. A module still loading shows its frame with the loading notice; a failed one shows the
   failure notice in its frame, and the others still draw.
4. Edit mode as in P-7.

**"שלי"**: the "הסבב שלי" section on top, then the existing next days and requests.

## Hebrew wording (proposals)

| Where | Text |
|---|---|
| Module | דשבורד |
| Head | יחידה · סבב · טווח · כולל מתוכנן |
| Templates | ניהול יציאות · תכנון ובקרה · דוח יומי · מותאם אישית |
| Edit | התאמה · סיום · הוספת רכיב · הזזה למעלה · הזזה למטה · הסרה · חזרה לתבנית |
| Leave custom | הלוח המותאם יימחק. להמשיך? |
| Empty board | הלוח ריק |
| Module names | מספר · מפת חום: הוגנות · נוכחות מול הנדרש · תכנון מול ביצוע · הוגנות בין תת-יחידות · נוכחות לפי תת-יחידה · התפלגות ימי בית · ימי בית לפי סוג · יוצאים וחוזרים · ממתין לטיפול · סטטוס דוח 1 |
| Metrics | נוכחים היום · בבית היום · משרתים בסבב · ממוצע ימים בבית · פער הוגנות · ימים מתחת למינימום · סטייה מהתכנון · ממתינות לי · יחידות שלא אישרו |
| Metric lines | {n}% מהמשרתים · {n} משרתים היום · חציון {median} · {n} חיילים חורגים · הבא: {date} · {n} שינויים · מתוך {n} |
| Heat map columns | שבוע {n} · ימים בבסיס · ימים בבית · פער מהחציון |
| Heat cell (accessible) | {name}, שבוע {n}: {home} ימים בבית מתוך {days} |
| Minimum line | מינימום {min} |
| Spread label | הכי מעט {min} · חציון {median} · הכי הרבה {max} |
| Plan vs actual | מתוכנן · בפועל · {n} נוספו · {n} בוטלו · {n} הוזזו · {n} בקשות ללא היסטוריה |
| Upcoming | יוצאים · חוזרים · אין יציאות וחזרות בשבוע הקרוב |
| Outstanding | בקשה מ{name} · {date}: חריגה מכלל · עוד {n} · אין משהו שממתין |
| Report status | אושר · לא אושר · השתנה מאז |
| Card note | לפי {n} ימים |
| Copy | העתקת טקסט · העתקת תמונה |
| Empty span | אין עדיין ימים לספור בסבב הזה |
| Personal section | הסבב שלי |
| Personal cards | ימים בבסיס · ימים בבית · בקשות פתוחות · היציאה הבאה · עד סוף הסבב |
| Personal lines | מתוך {n} מתוכננים · {n} ימי סבב · {p}% מהבקשות אושרו · בעוד {n} ימים · עד {date} · בבית עד {date} · אין יציאה מתוכננת · יום אחרון: {date} · הסבב מתחיל ב-{date} |

## Edge cases

- The rotation has not started: past-day modules show the empty span notice; `upcoming`, `outstanding` and "כולל
  מתוכנן" still work; `plan_vs_actual` is not drawn.
- A soldier who joined late or left early has outside days (hatched cells), is out of the median, the spread and the
  distribution, and is still in present-today and the heat map.
- An `available` leave type counts as a base day and is not in `home_by_type`.
- A routine range over `DATE_WINDOW.maxDays` is refused by the picker, as on the board.
- An attached soldier (`attached-memberships.md`, `missions.md`) is counted in the host by duty unit, through D-336.
- A one-week span: one heat column; the heat map stays the fairness table.
- A platoon (no sub-units): the per-sub-unit modules are not drawn; `plan_vs_actual` shows per soldier.
- A company commander picks a platoon: the default turns to `leaves` for that scope; a stored template or custom
  layout stays as stored.
- A stored custom layout made of modules none of which is drawable for this scope: "אין רכיבים להצגה ביחידה הזו" with
  "חזרה לתבנית".
- The preference save fails: the existing failure notice (D-187); the board shows the last saved layout after reload.
- Two devices edit the layout: `expected_version` and one retry with the fresh row (existing pattern); the last save
  wins.
- A leave whose events disagree with its row (a missing `rescheduled` event): the replay uses what the events say and
  the drift shows it; it is not hidden.
- Personal board: a soldier in two rotations in a year sees the current one only; a soldier who is in no rotation
  sees no section.

## Acceptance tests

Unit (domain):
- `daysTally`: home, base and outside days; an `available` effect is base; overlapping leaves count a day once;
  pending ignored; matches the board's `awayDays` on its existing tests.
- `spreadOf`: odd, even, empty. `weeksOf`: partial first and last weeks, Sunday-first.
- `leaveAsOf`: before creation (null); approved then cancelled; rescheduled twice; no `created` event.
- `defaultTemplate`: platoon → `leaves`; company with two platoons → `control`; company with one readable platoon →
  `leaves`.
- `layoutModules`: null → default; template; custom.
- `myRotationFigures`: base and home so far and planned, the rates, a zero denominator, an open end, not started,
  at home today, no next leave, requests (own vs set by a commander, routine type excluded, cancelled excluded from
  the rate).

Contracts:
- `SoldierPreferences` parses `{}` with `dashboard: null`; drops an unknown module and a repeated module on read;
  refuses them on write; refuses more than `DASHBOARD_MAX_MODULES`; schema-drift test unchanged (JSONB).
- `LeaveEventSpanQuery` is strict.

Logic:
- One fixture, every module's rows: totals agree across modules; heat steps fall on their boundaries; a module with
  nothing to show is omitted.
- Permission scoping: a platoon commander's figures equal the tally over their platoon alone; a hidden soldier
  changes no aggregate.
- Editing: add, remove, move, reset, picking the default template stores `null`; an unchanged edit writes nothing.

Data (shared contract suite, both adapters):
- `leave_events.list` with `LeaveEventSpanQuery` returns only events of leaves the actor reads; a denied soldier's
  events are absent.

e2e (desktop, mobile, RTL, axe):
- A company with two platoons and known leaves: the company commander opens on "תכנון ובקרה" with the expected big
  numbers, spread and plan vs actual; a platoon commander opens on "ניהול יציאות" with their platoon only.
- Customize: remove a module, move one up, add `home_by_type`, reload (kept), "חזרה לתבנית" (back).
- Heat-map copy text matches the table; the image renders.
- A soldier without `leaves:view` has no entry and the URL shows the no-access state.
- "שלי" shows "הסבב שלי" with the expected cards for a soldier and for a commander.
- Phone layout: no horizontal page scroll; the heat map scrolls inside its frame. Axe clean on every module and the
  personal section (the hidden tables are found).

## Proposed decisions

- **P-1** A fixed catalogue of eleven modules (the table above). Modules are code, not data; a new module is a new
  vocabulary entry with its derivation.
- **P-2** One meaning of base, home, outside, served and present days for every module and the personal board, from
  D-336's membership and the approved-only availability test.
- **P-3** The board's scope (unit, span, planned) lives in the URL; the unit picker offers only units the actor holds
  `leaves:view` over.
- **P-4** Every figure is over the rows the actor may read; aggregates never include hidden rows; the personal board
  never compares the soldier with others.
- **P-5** Three templates in config: "ניהול יציאות" (platoon, heat map first after the numbers), "תכנון ובקרה"
  (company: plan vs actual, fairness across platoons and presence against required before the heat map), "דוח יומי"
  (report owner). The default is derived from the scope's shape, so nobody configures a board per commander.
- **P-6** Only the layout choice is stored, per person, in `soldier_preferences.preferences.dashboard`, validated by
  contracts: `null` (default), a template, or a custom list of at most 20 unique modules. Unknown and repeated items
  are dropped on read and refused on write.
- **P-7** Editing is in place: move up, move down, remove, add, and drag on desktop; each change saves at once;
  "חזרה לתבנית" resets. Leaving a custom layout for a template asks first.
- **P-8** Fully derived on the client over existing queries; nothing stored, scheduled or run on the server beyond
  one read of events, loaded only for the plan modules (free tier).
- **P-9** Plan is the leaves as they stood at the span's start, rebuilt from `leave_events` (`leaveAsOf`); actual is
  the leaves now. `leave_events.list` gains `LeaveEventSpanQuery` under the thread's read policy.
- **P-10** "הסבב שלי" on top of "שלי": base days and home days so far against planned with completion rates, open
  requests with the approval rate, the next leave, and the days left; fixed, never stored.
- **P-11** Charts are CSS and inline SVG on theme tokens, with no chart library (no new dependency); a 12-column grid on
  desktop, stacked on the phone, time axes right to left; every chart has a text equivalent.

## Integration map

**Where it lives.**
- contracts: the vocabularies and `DashboardModule` / `DashboardLayout` in a new `src/contracts/settings/dashboard.ts`,
  joined into `SoldierPreferences` (`src/contracts/settings/index.ts:18`, defaulted, so stored rows stay valid);
  `PANEL_IDS.dashboard`; `LeaveEventSpanQuery` beside `LeaveThreadQuery` (`src/contracts/repositories/index.ts:124`)
  and the `leave_events` repository's query type (`:227`).
- config: `DASHBOARD_TEMPLATES` and `DASHBOARD` in a new `src/config/dashboard/`; `WORK_SECTIONS`
  (`src/config/panels/index.ts:78`) presence gains `dashboard`.
- domain: `daysTally`, `spreadOf`, `weeksOf` in `src/domain/availability/`; `leaveAsOf`, `defaultTemplate`,
  `layoutModules`, `myRotationFigures` in a new `src/domain/dashboard/`.
- data: the span mode of `leave_events.list` in the local adapter and the remote allow-list, plus the server read.
- logic: a new `src/logic/dashboard/` (`useDashboardScope`, `useDashboardLayout`, `useDashboard`); `useMyRotation`
  beside `useMyNextDays` (`src/logic/leaves/workflowHooks.ts:351`).
- ui: `src/ui/modules/presence/` for the board and its cards, beside דוח 1; the chart primitives (heat grid, bar
  series, range bar, histogram, progress bar) in `src/ui/primitives/` so a later report can reuse them; the personal
  section in `src/ui/modules/leaves/MyLeavesModule.tsx`. New UI components are allowed by D-333 as amended.

**Reuse.**
- Membership: `createRotationMembership` via `useRotationMembership` (`src/logic/deployments/hooks.ts:42`), D-336.
- The tally generalizes the board's inline `awayDays` (`src/logic/board/hooks.ts:81`), which then calls `daysTally`,
  so the dashboard and the board use one count.
- `createAvailabilityContext` (`src/domain/availability/days.ts`) is the only "is at home" test.
- Rule marks: `heatRow` (`src/logic/rules/evaluation.ts:111`) and `useRuleData` (`src/logic/rules/hooks.ts:121`).
- The soldier set: `unitStateOn` (`src/logic/roster/roster.ts:52`).
- Requests awaiting me: `usePendingRequests` (`src/logic/leaves/workflowHooks.ts:257`) and the inbox count.
- Report status: `useReportConfirmations` (`src/logic/presence/hooks.ts:196`), `DayReportDialog`.
- Own leaves: `useMyLeaves` / `useMyLeaveRows` and `myNextDays` (`src/logic/leaves/workflow.ts:291`) for the next leave.
- Preferences: `accounts.updateMyPreferences` and `useUpdateMyPreferences` (`src/logic/session/preferences.ts`).
- Template picker: `Segmented` (`src/ui/primitives/Segmented.tsx`); overlays and history: `Popover`, `ModalOverlay`
  (D-337).
- Copy: `reportImage(ImageLine[])` (`src/ui/modules/presence/reportImage.ts`), text after
  `src/logic/presence/reportText.ts`.
- Module access: `useModuleAccess` (`src/logic/permissions/hooks.ts:68`); entries through `ModuleDrawer`'s `GROUPS`
  (`src/ui/shell/ModuleDrawer.tsx:61`) and `useNavigationEntries` (`src/ui/shell/moduleEntries.ts`).

**Genuinely new, and why.**
- `daysTally`, `spreadOf`, `weeksOf`, `leaveAsOf`, `defaultTemplate`, `layoutModules`, `myRotationFigures`.
- The span mode of `leave_events.list`: today's query is per leave only, and one query per leave would not fit.
- The chart primitives and the eleven cards; the heat map's soldier rows need their own TanStack table, because the
  table engine's rows are leaves.
- `dayReport` caps at 7 days (`src/config/report/index.ts`, `maxSpanDays`), so it is not reused for the span.

**Entry points.** Commanders and unit managers: the presence group in the drawer, and "דשבורד" in a rotation's
details. Every soldier: "הסבב שלי" in "שלי". Nothing in the profile (D-253).

**Indicators.** The gap mark, the rule marks, "below minimum" ticks, and "changed since" in the report status. The
module entry has no count: the board is a picture, not a queue; requests keep their own count (D-255).

**Effects on other features.**
- Rules and the heat row: read only.
- דוח 1 (V30): shares the copy mechanism and reads confirmations.
- Filters (V33): the board's 'absent' sort calls `daysTally`; a test checks it sorts the same.
- Rotations (V26, V31) and the planner (D-270): read only; a planned round is an approved leave like any other.
- "סבב יציאות" (D-345, OI-295): requests exclude its types; `home_by_type` merges them into one bar. The dashboard ships
  after OI-295 (a 1.0 Must, D-344).
- Notifications: the span event query is the seam the notifications feed can reuse.
- Permissions (V10): policy-scoped rows and aggregates (P-4).
- Import/export (V12): the `dashboard` key follows the existing preferences treatment. PWA: none.
- Parity: pure reads, identical on both adapters; the span query is in the shared contract suite.

**Rules.** The tally and replay live in domain, the assembly in logic, templates and thresholds in config, vocabularies
and the stored shape in contracts, strings in i18n, colours as theme tokens (heat steps and marks included).

## Dependencies

- OI-295 ("סבב יציאות", a 1.0 Must) before the request figures, which exclude its types.
- None else. It reads attached and mission memberships correctly once they exist (D-336).

## Assumptions

D-170 defaults; the owner corrects them by reading:

1. **The catalogue** is the eleven modules above; nothing is configured per module beyond `stat`'s metric.
2. **The templates and the default by scope shape** (two or more sub-units → "תכנון ובקרה").
3. **A layout is per person, not per unit.**
4. **Plan** is the leaves at the span's start; a leave added later is drift, even if it was expected.
5. **A request** is a leave the soldier created for themself, routine leaves excluded; the approval rate leaves out
   cancelled requests.
6. **A course or medical absence of an `unavailable` type** counts as home, like any unavailable leave (D-032).
7. **Fairness** is the gap in days from the median of full-span soldiers, not a ratio.
8. **Future approved leaves** are not counted by default; "כולל מתוכנן" adds them.
9. **Weeks** are the heat map's columns.
10. **The personal board** shows the soldier's own figures only, never a comparison with the unit.
