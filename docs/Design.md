# Sagol — Design language

Derived from what is built (D-024), from the Stone 3 direction (D-077). It binds all later UI work.
**Settled in V1,** with the workspace frame, the drawer and sheet, the form pattern and the palette. Later
slices extend it, and a change to what is here needs a decision. Values live in `src/ui/theme/tailwind.css`,
and this file says how to use them.

## Rules

- **Only tokens.** Tailwind's default palette, spacing, type, radius and shadow scales are reset. A
  value that is missing becomes a token. It never becomes an arbitrary class (`npm run check:raw-values`).
- **Only logical direction.** `ms-`, `pe-`, `start-`, `end-`, `text-start`. The layout is RTL.
- **Technical values read left to right.** Emails, time zones, variable names, personal numbers, phones and the
  segments of a date take `dir="ltr"`, and they stay on the inline start of their field (`text-end` inside `ltr`).
- **Every string comes from `@i18n`.** A component prop that takes text takes an `I18nKey`, and its name
  ends in `Key` (`titleKey`, `labelKey`). Names from the data (a unit's name) arrive as text.
- **No dead controls (D-076).** A control appears only when its action works end to end and the actor may
  use it (`useCan`, D-091). A row with no permitted action shows no menu at all.
- **Status is carried by form as well as color** (solid, dashed, badge), so color is never the only
  signal (D-111).

## Color (Light)

| Token | Use |
|-------|-----|
| `canvas` | The page behind everything |
| `surface` | The viewport and inputs |
| `line` | Hairlines and input borders |
| `text`, `text-muted` | Body and secondary text. Both pass 4.5:1 on `canvas` and `surface` |
| `inner` | The soft fill of a quiet control, and of a row being dropped into |
| `action-solid`, `on-action`, `focus` | Solid action fallback, text on action, focus ring |
| `status-approved`, `status-pending`, `status-rejected` | Status. `status-rejected` is also field errors and refusals |
| `status-pending-text` | Pending as text. `status-pending` is below 4.5:1 and is for borders only (OI-033) |
| `marker` | The drop line of a drag; on the timeline from V4 |
| `today`, `today-band` | Today on the timeline: the dark pill around its number in the days header, and the faint band of its column |
| `marker-ink` | Timeline markers, from V4 |
| `scrim` | Behind a drawer or a dialog |
| `on-fill` | A caption on a solid fill (a bar's name); dark in both sets, since fills stay bright |
| `absence`, `absence-edge` | Every absence in the uniform color mode of the timeline: the fill text reads on, and its dashed edge (D-112) |
| `palette-<key>` | The 12 colors users choose (D-074). Each passes 3:1 on `surface`, so they are for shapes, not text |

A palette key reaches the screen through `PALETTE_SWATCHES` (`ui/theme/palette.ts`), whose map is total. A shape
painted in a user's color takes its `PALETTE_TONES`: a solid fill, a faint fill (10%), an edge and an icon color.
An icon key reaches the screen through `ICON_GLYPHS` (`ui/theme/icons.ts`), also total, with a name read aloud. A
user's color says nothing by itself, so a row also has its name, and the color field reads each swatch's
name aloud and marks the selected one with a check.

## Color (Dark)

The same tokens, a second value each, under `[data-appearance='dark']` on the root element with
`color-scheme: dark` (D-181). The soldier chooses light (the default), dark or the device's in the user menu, under
"מראה"; the choice is kept in their preferences, and the device's follows `prefers-color-scheme` live. The screens
before the soldier is known (sign-in, onboarding) stay light. In the dark set:

- `canvas` and `surface` are warm near-blacks; `text` and `text-muted` stay at 6.7:1 or more on both.
- `action-solid` and `today` turn light, with `on-action` dark on them.
- The palette keeps its twelve hues, lifted to 5:1 on `surface`; `on-fill` stays dark on them.
- The glass surfaces are dark glass, and the primary action is light glass.
- axe checks the board, its bars and a drawer in the dark set (`e2e/appearance.spec.ts`).

## Glass

Five surfaces, each with a solid fallback under `prefers-reduced-transparency`:

| Utility | Use |
|---------|-----|
| `glass-bar` | Floating navigation |
| `glass-card` | A sheet on the canvas (sign-in, onboarding, full-screen states) |
| `glass-menu` | Popovers and small dialogs |
| `glass-drawer` | The drawer and the bottom sheet: nearly opaque, because forms are read on it |
| `glass-action` | The primary action, dark glass (light glass in the dark set) |

Use one primary action per surface. Glass makes a containing block, so anything `fixed` that follows the
pointer inside it, such as a drag overlay, renders in a portal.

## Type

Heebo, self-hosted (D-077). `text-title` 24 bold for a screen's one heading, `text-body` 15,
`text-name` 13 for hints, short messages and row names, `text-control` 12.5 for controls, `text-label` 11.5
for field labels and errors, `text-micro` 11 for a row's second line. Inputs are `text-input` 16 on mobile,
because a smaller input makes phones zoom the page, and `text-control` from `md`.

## Size and shape

- **Spacing:** `2xs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `2xl` 32.
- **Controls:** `control` 30 on desktop, `touch` 44 on mobile (`min-h-touch md:min-h-control`, OI-033).
  The primary action is `bar` 40 on desktop. Tests measure the controls on mobile.
- **Radius:** `bar` 6, `control` 10, `panel` 16, `pill` 20, `sheet` 24.

## Layout

- **Workspace (D-023, D-108, D-189, D-252):** a `surface` panel on the `canvas`, filled by the active engine. Two glass
  strips float over it and hug their content, centered, on every screen and orientation (V25): the context strip at the
  top (the scope label, the range, "סינון ומיון", the avatar) and the destination strip at the
  bottom (לוח, שלי, בקשות, דוח 1, ניהול, then the role's quick action). On a phone the top strip fits without
  scrolling (D-273): the unit picker is its icon, and a single unit is not shown. The view is picked from the "לוח" tab
  (D-311). The organization's name is the page's `h1`, read
  aloud only. Content starts under the top strip (`under-bars`, `under-bars-md`, `under-bars-filtered`), ends above the
  bottom one (`above-bottom-bar`), and scrolls under the glass. A structure that differs by screen uses `useIsDesktop`;
  anything else is CSS.
- **Landscape and wide phones (D-190, D-252):** the same two strips; no bar label wraps and the page never scrolls
  sideways. The wide phone's folded row is gone.
- **Safe area (D-191):** `viewport-fit=cover`; the canvas paints every edge, and the workspace's content, drawers and
  the navigation panel sit inside the insets (`--safe-top`, `--safe-bottom`, `--safe-inline`; `inset-safe`,
  `frame-safe`, `px-safe`, `top-safe`). The inline inset is the larger side on both sides.
- **Icons and tooltips (D-189):** every `IconButton`, and every control shown as an icon alone (the destinations on
  desktop, "סינון ומיון" on a phone, the avatar), has its name as its accessible name and as a
  `NameTooltip`: a dark pill, `label` type, after `TOOLTIP.delayMs`. No hint prose sits beside a control.
- **Timeline (D-108, D-192):** sizes come from `TIMELINE_LAYOUT` in `config`, because the geometry and the virtualizer need the
  same numbers: rows 36 (44 on mobile, where a name is a touch target), group rows 32, the days header 28, names 124,
  days at least 64 and sharing any extra width. The days header is a flat `surface` strip that sticks under the bars.
  The name column and the corner stick to the inline start on the same opaque `surface`, so days pass under them with no
  fade or seam when the grid scrolls sideways. A group header
  row sits on `canvas`. Days a row is out of the selected unit are muted with `inner` and read aloud as ranges.
  Positions are inline offsets from the core, so RTL needs no mirroring.
- **Leaves on the timeline (D-111, D-112):** sizes come from `TIMELINE_LANES` in `config`: bars 20 high, inset 3 inside
  their days, a lane step of 24. Absence is a hole (D-290): an approved bar is hatched from its type's color over a faint
  fill with its edge, a pending one a 2 px dashed edge over the surface, square on a side the window cuts; the caption is
  the body text. A round (a leave in a batch) is a band of the row's full height under the request bars, outside the
  lanes; a soldier's overlapping rounds split that height into stacked bands, so each is seen (D-317). No leave type is green or lime, so green never means away. A marker is a 20 px round badge on `surface` with its icon, on each day,
  over any bar. Overlaps take lanes, and a row grows by a lane step for each lane beyond the first. In the uniform mode
  every bar is `absence`, with a dot of the type's color and its name inside, and badges are `marker`.
- **The other views (D-174):** each fills the same frame under the bars, a focusable region named for the view. The
  list is the board's rows: group headings, then a soldier's name, rank and leave chips with their dates. The table has
  a row per leave with sortable headers that stick under the bars. The calendar shows the window in whole weeks, seven
  columns from `md` and one day per line below it; a day's heading holds its weekday, its number (today in the dark
  pill) and how many are out, then a chip per leave with the soldier's name. A chip is a `pill` of `text-label`, a dot of
  the leave's color, solid edge when approved and dashed in the type's edge color when pending.
  A day that breaks a rule shows a count beside its heading, and the list shows the window's broken days above its
  rows; each opens the rules of its day in the heat row's tones (D-290). With no view in the link, desktop opens on the
  timeline and a phone on the list.
- **Lanes on a phone (D-144, OI-067):** `TIMELINE_LANES_TOUCH` makes bars 28 high with a lane step of 44, so a bar's hit
  area is 44 high and a badge's 44 wide; a row of one lane stays 44.
- **A mark is a control (D-119):** a bar is a button named by its type, its status and its days, and it opens the leave.
  Its hit area fills the gap to the next lane (24 px high from `md`, 44 on a phone), so lanes never take each other's presses. A marker of
  several days is one control: the first badge is in the tab order and read aloud, and the others open by pointer only.
- **Dragging on the board (D-143, D-144):** a mark that moves keeps its form; a bar's inner ends (`TIMELINE_DRAG.handlePx`)
  show a resize cursor. While dragging, the stored mark fades and a ghost in its form sits at the new days with an edge
  that says the worst rule it breaks: `marker` for none, a dashed `status-pending` for a soft rule, `status-rejected` for a
  hard one. Days marked for a new leave are a dashed `marker` box on `inner`. A `glass-menu` card floats above the bottom
  bar (bottom on desktop), in a live region: what, the soldier, the days and their count, "returns to pending" and
  `RuleBrief`. A refused drop shows a `FailureNotice` in the same place with "סגירה". On touch a finger holds
  `TIMELINE_DRAG.holdMs` first, and a finger that moves still scrolls. Every drag has a way without one: the edit form
  and the "+".
- **The quick action (D-252, D-266, D-296):** a filled round button at the destination strip's inline end, by mode:
  "בקשה חדשה" for who may request leave for themselves while a rotation is current or upcoming; "פתיחת סבב" in routine
  for who may create a rotation ("הגדרת מבנה היחידות" while the unit has no units); none otherwise. It replaced the
  floating "+". The routine band above the board only states the mode, in a neutral tone.
- **ניהול יחידה (D-173, D-254):** "ניהול", the last destination, opens a `glass-drawer` panel from the inline start (the
  right), at most `sheet` wide, as tall as its rows up to the screen and scrolling past it (D-278), on every screen. It
  holds daily work only (from V32, D-285): the setup's progress as a callout while unfinished, then its groups, each a muted
  heading over its rows: אנשים, נוכחות; and at its foot one quiet row, "הגדרות היחידה", that opens setup. A row is the module's icon, name, one
  plain line and its waiting count; pressing it closes the panel and opens the module, whose deep link is unchanged. No
  pins. A row the viewer may not open is absent; with nothing to show, the panel and its destination are absent. The
  destination carries the sum of the panel's waiting counts.
- **The scope label (D-104, D-173):** a compact `inner` pill with a unit icon, the scope's name cut by width, and a
  chevron, opening the unit picker. With the whole organization chosen and a single root unit in sight, it reads that
  root's name. A viewer who sees a single unit reads its name, with no picker and no chevron.
- **The inbox destination (D-120, D-255):** "בקשות", for who may approve someone. It carries the number of requests
  waiting as a small dark pill, read aloud with its name.
- **Destinations (D-116, D-189, D-252):** an icon with a tooltip from `md`; below it the icon over its short name, 44 px
  at least.
- **The view sheet (D-311):** the "לוח" tab shows the current view's icon. From another destination it returns to the
  board; on the board it opens a `Drawer` titled "תצוגה": a card per view the device offers (two columns, an icon over
  the name, the current one with an `action-solid` edge), then "צבעים", a segmented "לפי סוג" / "צבע אחיד". Pressing a
  card, the current one too, closes the sheet; the colors stay open to compare. The top strip holds no view control.
- **"סינון ומיון" (D-312, D-313):** one control in the top strip, an icon with its name from `md` and the icon alone
  below. It opens the rule builder, a `Drawer` of two sections. "סינון": a row per rule, the property, its operator and
  its values (a button that opens a list of them), with "הסרת סינון"; "+ הוספת סינון"; "וגם" / "או" once there are two
  soldier rules; "רק מי שחסר" as a suggestion while off. The leave status, the leave type and "רק מי שחסר" hold one row
  each. A rule still without a value lives only in the open builder. "מיון": a row per sort, the key and the direction,
  with "העברה למעלה", "העברה למטה" and "הסרת מיון"; "+ הוספת מיון" while a key is left. Today's report is a
  destination, "דוח 1" (D-252); the bar holds no presence count.
- **The filter row (D-131, D-173):** a `search` landmark under the top strip, there only while a rule is set: from
  `md` under the bar with the scope (`top-filter-row-md`), below `md` under the top strip (`top-filter-row`), scrolling
  sideways. It holds the chips and "ניקוי הכול", which clears every rule and keeps the unit. Each is a `glass-bar` pill,
  `control` high from `md` and `touch` below; only the pills take presses. Soldier rules joined by "או" say so between
  their chips. The board starts under the bars (`under-bars`), and under the row while it shows
  (`data-filter-row="shown"` on the workspace swaps in `under-bars-filtered`).
- **A chip (D-314):** the property muted, its operator when not plain "any of" or "is", then every value bold, cut by
  width, as one button that opens its rule in the builder; beside it a bare "x" with no fill (`chip-close` from `md`,
  `touch` below) named "הסרת סינון" and the property. A filter the bar does not read is one chip, "סינון מותאם", which
  can only be removed; the leave chips stay beside it.
- **"Only who is missing" mutes the days a row is present,** like days out of the unit, and reads them aloud as "נוכח".
- **A control with nothing to choose stays away (D-076):** the unit selector appears once a unit exists; "today" appears
  while the window does not hold today.
- **Outside the workspace:** one `glass-card` centered on the canvas (`CenteredSheet`), at most `sheet`
  420 wide.
- **Management modules (D-092):** `Drawer`, one surface in two forms. From `md` it is modal, at most `drawer`
  440 wide, on the inline end (the left), as tall as its content up to the screen (D-278), leaving the name column of the timeline in sight. Below `md` it is a
  bottom sheet up to 88% of the height, which also closes by dragging its grip down. Both close by Escape, the
  scrim and the close button, and enter with a short slide that `prefers-reduced-motion` turns off.
- **What is open lives in the URL:** `panel`, `entity` and, for a new unit, `parent` (`usePanel`). A panel shows
  its list, or the form `entity` names. Sections of a module are panels, so each has its own deep link.

## Account linking (V9, D-150, D-151)

- **Onboarding of an identity with no account** (`ui/shell/LinkRequest.tsx`): under the "no access yet" sheet, a form with
  first name, last name and an optional personal number, or, with a pending request, a notice with the name sent and a
  "cancel request" button. Neither says whether anything matched.
- **The account-links button** in the bar, as the inbox button: an icon with a tooltip on desktop, a tab on a phone, with
  the count of pending requests; shown only to who may review.
- **`AccountLinksModule`** (`ui/modules/account-links`): a `VirtualList` of requests (name, email, when); a request shows
  its fields, its candidates (why each matches, a "link" button) and "new soldier" and "reject". Link and reject confirm in
  a `SmallDialog`; the new soldier is an `EntityForm` (rank, unit, date placed).
- A linked soldier with no access sees the board's notice that the account is linked and has no access yet.

## Self-service (V11, D-167, D-168)

- **"My requests"** (`ui/modules/leaves/MyLeavesModule.tsx`): the first module button for a linked soldier who may view
  their own leaves. A primary "new request" button on top (when they may create), then "open" as a list and "history" as
  a `VirtualList`. A row is the type's mark and name, the dates and days, and the status chip; it opens the leave's
  details. With no leave at all, an `EmptyNotice` holds the button.
- **The onboarding notice** (`ui/shell/OnboardingScreen.tsx`): with no open request and a rejected last one, a
  `role="status"` box above the form says the request was not approved and that a new one can be sent.

## Import and export (V12, D-171)

- **Entry:** the account menu's "import and export" item, for who may import or export; it opens the `data_transfer`
  drawer. Not a module button, so the bar does not grow (OI-110).
- **Import** (`ui/modules/transfer/TransferModule.tsx`): a `FileTrigger` for a `.csv` or `.json` file. The file is read
  and run as a dry run at once. An unusable file shows its reason in a `role="alert"` box; a refused one lists each
  refused item (its number, the message and the field it names); a ready one shows the count and a primary "import".
  After the import, a `role="status"` line gives the count saved.
- **Export:** a button that downloads `sagol-export-<day>.json`.

## Roles and access (V10, D-165, D-166)

- **Destinations** (`ui/shell/TabBar.tsx`, `moduleEntries.ts`): the board, "שלי", the inbox and דוח 1 by permission, then
  "ניהול" (D-252); the other modules sit in "ניהול יחידה" (D-254).
- **`RolesModule`** (`ui/modules/access`): the roles list (name, color, count of pairs, "baseline" on the baseline role) and a form with
  name, description, color and a permission grid, a `CheckList` per resource of D-040's valid pairs; the baseline role is
  a select above the list. **`RankBindingsModule`**: a role select, then that role's bindings (rank and scope in words)
  and a form with the rank (fixed once saved) and `ScopeFields`.
- **`ScopeFields`**: the anchor select and only the fields that anchor needs (unit, soldier, level, steps, descendants),
  plus the rank constraint.
- **`GrantsModule`**: the grants list (name, state pill, role · scope · days), "show ended grants" switch, revoke from
  the row's `ActionMenu` with a `SmallDialog`; the form has grantee, role, `ScopeFields`, first and last day (both
  optional, with hints) and a reason.
- A soldier who may not view the organization and reads no soldier still sees the "no access yet" notice (D-160).

## Deployments, collective leave and seniority (V15, D-179)

- **`DeploymentsModule`** (`ui/modules/deployments`): the deployments list (name, "active" chip, unit · days · members),
  an `ActionMenu` with "who is in the deployment" and archive (`SmallDialog`); the form has name, unit and two dates
  (an open end allowed). Without a live unit the empty notice says a unit comes first.
- **`DeploymentMembersForm`**: a `CheckList` of soldiers, then a row per member with two optional dates inside the
  deployment's days.
- **The new-leave drawer is the sheet (D-275):** the soldier, then a bordered group per request ("בקשה 1", "בקשה 2", ...)
  with its type, from and to, reason, and a "חוזרת" switch that opens "כל כמה ימים" and "חוזרת עד תאריך"; an X removes a
  row while there is more than one, and "בקשה נוספת" adds one. Below the rows: פרטים נוספים, "approve now", and one rules
  warning over every leave the sheet would create.
- **The install card (D-274):** once after sign-in, a glass card above the bottom bar, clear of the top bar, "אפשר להתקין את סגול במכשיר
  הזה" with "התקנה" and "לא עכשיו"; never on the sign-in screen or in the installed app, and gone on that device once
  answered.
- **The new-leave drawer** has a "collective leave" switch when there is more than one soldier to choose; the
  `LeaveBatchForm` has a name, a `CheckList` of soldiers, the type and the days. **`LeaveDuplicateForm`** opens from a
  leave's drawer: soldiers, days, and "approve now" only for who approves all of them.
- **`LeaveRoundPlanner`** ("סבבי יציאות", V31, D-316) is the drawer's third way when there is an open rotation in
  scope: name, rotation, the plan's days, the rhythm (days in, days home), groups of the rotation's soldiers each with
  its first day home, the type and reason; each group lists its rounds before "יצירת היציאות" sends one collective leave.
- **`SenioritySection`** on the soldier's page: the overrides (current, permanent, revoked as history), a new one in a
  dialog, revoke from the row.

## Organization setup (V16, D-180)

- **`SetupModule`** (`ui/modules/setup`): a drawer with an intro, "X of Y steps done" (a status line), and an
  ordered list of the steps the actor may do. Each row has a number (a check once done), the step's title and
  explanation, "done" or "not yet" in words, and an "open" button to the step's own module.
- It opens first in "ניהול יחידה" and from the empty board, as its one action (V25). From V32 it is the first section
  of "הגדרות היחידה", with its progress as a callout in "ניהול יחידה" (D-285).
- **Template sheet** (V27, D-262): a fresh unit, the root alone, first sees pick, adjust, done; "סיום" runs the
  template's commands and closes the drawer on the board in routine. A stop part way says where, and hands over to
  "הגדרות היחידה", where the checklist is (D-297).
- **Quick entry and bulk approval** (V27, D-282, D-283): "הוספה מהירה" in the soldiers list is a grid with a paste box,
  one unit from today, saved row by row; "אישור הנבחרות" in the join requests links only a single match by personal number.

## Installed app (V18, D-182 … D-185)

- **Icon**: the owner's bison emblem in the brand gradient (`brand-light` → `brand` → `brand-deep`) on a `surface`
  rounded square; the maskable and Apple icons pad it on `surface`. Name "סגול", standalone, right to left; the bar color is `canvas`, and follows the dark set at runtime.
- **Update toast**: a glass pill at the top, below the safe area: "גרסה חדשה זמינה" and a primary "רענון". It
  waits for the soldier; it never reloads on its own.
- **Preference failure** (D-187): a pin, the appearance or "approve now" that does not save shows a
  glass pill at the top in `status-rejected` with a close icon; another device's change reads "ההעדפות שונו במכשיר אחר",
  and the menu or panel shows the stored choice.
- **Install**: "התקנת האפליקציה" in the user menu, above sign-out, only when the browser offers it; on an iPhone,
  a dialog explains Share → "הוספה למסך הבית". Nothing shows once installed.
- **Offline**: a centered sheet "אין חיבור לרשת" with "ניסיון חוזר"; the app opens by itself when the network
  returns.

## Range, sort and a calm screen (V19, D-211 … D-215)

- **Range picker**: the window label in the bar is a menu button. It lists יום / שבוע / חודש, then "סבב שלם" with the
  scope's running and coming rotations and their dates; with none, the item is absent (D-218). The arrows'
  names follow the kind ("שבוע הבא", "חודש הבא", "סבב הבא"). The timeline narrows its days for a long range and drops
  the weekday name below 44 px. On a phone "היום" is an icon with its name in a tooltip.
- **Sort (D-313)**: rows in "סינון ומיון": by name, rank, seniority, unit, days absent or a sortable soldier property;
  ascending or descending; the first row leads and the next break its ties. The table's leave headers keep their own.
- **"Only who is missing"** is a suggestion in the builder and a chip while on (D-213, D-312).
- **Calm**: no explanatory hints (presence and seniority keep theirs); empty states are a title and an action; icon
  buttons have a tooltip with their name (D-215). The interface says סבב for a deployment (D-212).

## Day report (V22, D-193 … D-197)

- **Entry**: a day's header in the timeline and the calendar is a button, and "דוח 1" among the daily destinations opens today. A day
  outside the scope's rotations is plain text.
- **Dialog**: centered glass, at most the drawer's width. The date between the arrows, "היום", "כמה ימים" (then "עד
  יום" and "יום אחד"), one muted line on what is counted, the "סיבות" switch when there is something to show, then
  "העתקה" and "שיתוף תמונה" or "הורדת תמונה". Five count tiles (total, present, absent, leaving, returning), then one
  bordered section per unit, collapsed by default, with its counts and the absent, leaving and returning names; a
  reason line under a name while the switch is on. A span puts each day under its own date.
- **Toast**: one line in the dialog's status region, "הדוח הועתק" or what failed, gone after a moment.
- **Image**: always the light tokens, the text copy's lines, one tall PNG for a span.
- **Confirmations (V30, D-293)**: under each unit section's heading, one line with its status ("אומת", "טרם אומת" or
  "השתנה מאז האימות", muted, approved or pending tones) and, for whoever may confirm it now, "אימות הדוח" or "אימות
  מחדש". Status and the tally are read on the whole unit, filter or not; while the view filter hides some of a
  section's soldiers, the button gives way to a muted line that confirming needs the full list. Above the count tiles,
  the report owner (or, with none named, whoever may confirm) reads "N אומתו מתוך M"
  and, when some changed, "השתנו מאז: K". The copy stays one consolidated message. The rotation form takes an optional
  "אחראי דוח 1" from the active soldiers.

## The rotation-centric workspace (V19, D-216 … D-220)

- The workspace opens on the rotation running today, else the next; its window is the whole rotation. No control or
  label names the rotation: the dates say it, and the range menu's "סבב שלם" is a single item or, with more than one
  rotation, a short list by start.
- With no rotation in scope the viewport shows "אין סבב פעיל": "פתיחת סבב" for whoever may create one, otherwise one
  line saying the commander opens it; before any unit exists, "הגדרת מבנה היחידות" for whoever may found the tree. The dates, view switcher, filters, new-request button, inbox and "my requests"
  are gone; the permanent modules stay.
- The request forms pick the rotation that holds the soldier on those dates. Creating a rotation opens its members
  editor, which starts with the unit's soldiers.

## Simplification: information architecture (V24, D-250 … D-264)

The target that V25, V26 and V27 build. Where an earlier section of this file disagrees, this one wins once its slice
lands, and that slice rewrites the earlier lines.

Built in V25: the words, the two strips, the profile, "ניהול יחידה", the requests hub, "שלי" and the home, and one path
per action; `e2e/journeys.spec.ts` walks journeys (c), (d) and (e). The routine notice and "פתיחת סבב" wait for V26.

### Words (D-250, D-251)

Everyday words, the only domain words outside "ניהול יחידה": **יחידה, חייל, סבב, בקשה, היעדרות, דוח 1**. Modes of
the screen are **מצב**: שגרה, סבב, מיקוד. Every module inside "ניהול יחידה" has one plain line under its name.

| Today on screen | What it is | Decision | Where it shows after V25 |
|-----------------|------------|----------|--------------------------|
| ארגון | the tenant (`organizations`) | hide: the root unit's name, or "היחידה" | nowhere |
| כל הארגון (scope, rule target) | the whole tenant | rename: the root unit's name; a rule's target "כל היחידה" | scope picker, rules |
| הקמת הארגון | the setup | rename: הקמת היחידה | from V32: הגדרות היחידה, while unfinished; its progress in ניהול יחידה (D-285) |
| יחידה | `units` | keep | everywhere |
| דרג / רמת יחידה | `unit_levels` | rename: סוג יחידה (פלוגה, מחלקה, כיתה) | מבנה היחידה |
| דרגה | `command_ranks` | rename: דרג פיקודי (מ"פ, מ"מ, מ"כ, לוחם) | from V32: הגדרות היחידה › מבנה, הרשאות, the soldier's card |
| חייל | `soldiers` | keep | everywhere |
| תפקיד / תפקידים | `roles` | rename: רמת הרשאה / רמות הרשאה | הרשאות |
| שיוך דרגה לתפקיד | `rank_role_bindings` | rename: הרשאות לפי דרג פיקודי | הרשאות |
| הרשאה (a grant) | `access_grants` | rename: הרשאה אישית | הרשאות |
| חיבורים / חיבור חשבון | `account_link_requests` | rename: בקשות הצטרפות / בקשת הצטרפות | הרשאות |
| חשבון / זהות / גישה | the sign-in identity | merge: חשבון | profile, sign-in |
| חופשה / חופשות | `leaves` | merge into היעדרות | board, requests |
| יציאות (permission labels) | `leaves` | merge into היעדרויות | הרשאות |
| בקשת חופשה חדשה | the new-leave form | rename: בקשה חדשה | requests hub |
| בקשה | a leave asked for | keep, only that meaning | requests hub |
| היעדרות / סוג היעדרות | `leaves`, `leave_types` | keep | board, requests, סוגי היעדרות |
| קבוצה (of absence types) | `leave_type_groups` | keep, only there | סוגי היעדרות |
| חופשה קבוצתית | `leave_batches` | rename: בקשה לכמה חיילים | the new request's switch |
| קבוצה / קיבוץ (board rows, rule grouping) | grouping | hide: the unit's name heads its rows; a rule says "לפי" | board, rules |
| כללים | `availability_rules` | rename: כללי נוכחות | נוכחות |
| סבב / סבבים | `deployments` | keep (D-212) | top strip, סבבים |
| תגית / תגיות | `tags` | keep | soldier's card, filter, תגיות |
| קטגוריה | `tag_categories` | keep, advanced only (D-285) | from V32: הגדרות היחידה › מתקדם; a tag's form |
| מאפיינים | `property_definitions` | rename: פרטים נוספים | from V32: "שדות נוספים" in הגדרות היחידה (the definitions), "פרטים נוספים" on the soldier's card (the values) (D-285) |
| בכירות / ותק | effective seniority | merge: ותק | sort, the soldier's card |
| שיבוץ | `unit_memberships` | keep: שיבוץ ליחידה | the soldier's card |
| שיוך (tagging) | `soldier_tags` | rename: תיוג | the soldier's card |
| סטטוס / מצב (of a leave) | the leave's state | merge: סטטוס | requests, the leave's drawer |
| חסרים היום | the presence count | merge into דוח 1 | bottom strip |
| העדפות | the approve-now default | move to the requests hub | requests hub |

### Navigation (D-252 … D-256)

- **Top strip (context):** unit in scope · time (the rotation's name or "שגרה", the range, its arrows, "היום" while
  away from today) · view · filter · sort · avatar. A floating pill that hugs its content, centered at the top.
- **Bottom strip (destinations):** לוח · שלי (who has a soldier record) · בקשות (count awaiting me, who approves) ·
  דוח 1 · ניהול (sum of waiting counts, commanders only), then the role's one primary quick action, a filled round
  button at the strip's inline end: "בקשה חדשה" for who may request while a rotation is current or upcoming, "פתיחת
  סבב" in routine for who may create one, otherwise none (D-266). A floating pill that hugs its content, centered at the
  bottom. The same two pills on a phone, a phone on its side, a tablet and a desktop.
- **The rule (D-256):** one entry per destination, plus one primary quick action per role.
- **Profile (avatar):** name · appearance (light or dark) · install · identity switch (local) ·
  sign-out.
- **ניהול יחידה (work, from V32, D-285):** the setup's progress (while unfinished) · אנשים: חיילים, בקשות הצטרפות, הרשאות
  אישיות · נוכחות: סבבים, כללי נוכחות · then "הגדרות היחידה". No pins. Setup is laid out in "Work and unit setup"
  below.
- **Home (D-265):** who approves or manages someone lands on the board at their widest scope; everyone else on
  "שלי". One press apart; the last choice is remembered on the device; a link that names a panel or view wins.
- **שלי:** my next days, in or out · my requests, open and history, with their status. A new request starts from the
  strip's quick action.
- **בקשות (the inbox, who approves):** the approve-now switch in its header (who may approve their own) · ממתינות
  לאישורי · closed.
- **Gone:** the separate floating "+" (its action is now in the strip), the "הבקשות שלי" tab, pins, the presence count in the bar, the empty board's second
  button, "סבב חדש" in the range menu, the full-width phone bars and the folded wide-phone row.
- **Focus mode (V23):** both strips and the chips row hide; one restore button stays in a corner that does not cover
  the name column.

### Journeys (D-263)

**Roles (the owner's matrix, D-265).** Plain words; the system stays permission-driven.

| Role | Cares about | Home | Quick action |
|------|-------------|------|--------------|
| Soldier, squad leader | Their own days and requests; opens the app to add or follow a request, or when asked | שלי | "בקשה חדשה" while a rotation is current or upcoming; none in routine |
| Platoon commander, sergeant | The unit's requests, their own included; may delegate | לוח (their unit) | "בקשה חדשה" in a rotation; "פתיחת סבב" in routine if they may create one |
| Company commander | The plan: wide view and control; rarely approves (HQ's requests) | לוח (the company) | "פתיחת סבב" in routine; "בקשה חדשה" in a rotation |
| מפל"ג (company HQ) | Dedicated roles under the company commander; the report owner (D-269) | by permission: לוח or שלי | as above, by permission |

Requests come from the soldiers; a commander entering one for a soldier uses the form's requester or a drag on the
board, never the quick action (D-266). Next slices on these journeys: several requests at once (V28, D-267), the
board's visual language (V29, D-268), דוח 1 as a confirm-and-send workflow (V30, D-269), the leave-round planner
(V31, D-270).

**(a) First sign-in to a running unit.**
1. Sign in. With no organization yet, the claim sheet asks for the unit's name and your name; the time zone is the
   device's, changeable there.
2. "הקמת היחידה" opens: pick "פלוגה" (or "ריקה").
3. Adjust: how many platoons and squads and their names, which absence types and tags to keep; each prefilled.
4. "סיום": the template runs through the commands; the board opens in routine mode with the roster's empty units.
5. Add soldiers in חיילים, or import them (ייבוא וייצוא), then "פתיחת סבב", the strip's quick action in routine.

**(b) A rotation, from call-up to close.**
1. In routine, "פתיחת סבב" (the strip's quick action) or ניהול → סבבים → new (a list starts from the previous
   rotation's list; rotation tags are copied per soldier on the card, D-222, D-317): name, dates (an open end allowed), unit (the root by default), who: "כל היחידה" (default) or
   "רשימה" (for example command staff first).
2. Saving checks there is no overlapping rotation and says so before the command. The mode becomes the rotation's
   (upcoming, then running): the top strip names it and the range opens on it.
3. Life in the rotation: rotation tags on the soldiers' cards ("כמו בסבב הקודם" copies the last rotation's), requests
   and approvals in the hub, דוח 1 every morning.
4. A "רשימה" rotation grows: add soldiers to the list, or turn it to "כל היחידה".
5. After the last day the rotation is ended but stays open, and stays the mode while no other holds today or is
   upcoming; the commander settles open requests, then its creator (or who may manage rotations) presses "סגירת סבב".
   The rotation turns read-only and its tags and leaves stay as its history; "פתיחה מחדש" reopens it, for an
   extension.

**(c) A soldier requests an absence.**
1. The soldier lands on "שלי" (D-265); closed, it leaves the strip, whose quick action is "בקשה חדשה". The soldier is the requester (a commander may pick another).
2. Type (by group), from and to (inside the rotation by default), the reason when the type needs one, and any פרטים
   נוספים; the rules' warnings show as the dates change. "בקשה נוספת" adds a row of its own type and days, and "חוזרת"
   repeats a row every so many days (D-275).
3. Send. The request shows in "שלי" as pending, and on the board as pending (a dashed edge, D-290).

**(d) A commander approves.**
1. The commander lands on the board; the בקשות destination carries the count awaiting approval; open it.
2. "ממתינות לאישורי": each request with the soldier, the type, the days and the rules it would break.
3. Approve or reject; a soft rule asks for an acknowledgement, a hard one refuses (D-145). Details open the leave's
   drawer (D-119).
4. The switch "לאשר מיד בקשות שאני יוצר" is in the hub's header for the commander's own requests.

**(e) The daily report.**
1. דוח 1 in the bottom strip opens today's report for the scope; a day's heading on any view opens that day.
2. Counts first (present, absent, leaving, returning), then by unit in tree order.
3. "סיבות" adds the reasons the viewer may read; "העתקה" or "שמירה כתמונה" sends it on.

### Rotation as a mode (D-257 … D-260)

| Fact | Stored | Derived |
|------|--------|---------|
| The rotation's days | `start_date`, `end_date` | |
| No overlap per organization | exclusion constraint (V26) | |
| Upcoming, running, ended | | today against the dates |
| Closed (explicit, reversible) | `closed_at`, `closed_by` (V26) | |
| The mode of the screen | | of the rotations not closed: the one holding today, else the nearest upcoming, else the latest ended, else שגרה (D-222) |
| A feature's context | each card says: rotation, routine or both | |
| Who is in it | member rows, only for a list | no rows: the unit's soldiers for its days |
| A tag's lifetime (persistent or this rotation) | `soldier_tags.deployment_id` (V26), per assignment | |
| The lifetime pre-selected when assigning | `tag_categories.default_lifetime` (V26) | |
| Rotation tags from the previous rotation | | "כמו בסבב הקודם" on the soldier's card, per soldier (D-222) |

### Templates (D-261, D-262)

"פלוגה" in `config`, names in `i18n`: the company (root) with מפל"ג and three platoons of three squads; unit types
פלוגה, מחלקה, כיתה; command levels מ"פ, סמ"פ, מ"מ, סמל, מ"כ, לוחם, each bound to a permission level; persistent tag
categories "הכשרות" (נהג, חובש, קשר, נגביסט, מטול) with colors, and a category "תפקיד בסבב" whose tags default to this rotation; absence types
in groups (בית: יציאה הביתה, יציאה מיוחדת; בריאות: מחלה, גימלים; אחר: קורס, אירוע משפחתי); rule defaults sized to a
company. V27 fixes the exact lists and colors in config.

## Work and unit setup (V32, D-284, D-285)

Daily work and one-time configuration live apart. A concept's definition sits in setup; its use sits on the object at
work. Every section and row shows only what the viewer may open (the module's `isAllowed`); a place with nothing allowed
is absent. The owner sees everything because the owner role holds every permission (D-079).

| Place | Section | Rows |
|-------|---------|------|
| ניהול יחידה (work) | callout | the setup's progress, "X מתוך Y", and the next step, while unfinished |
| | אנשים | חיילים · בקשות הצטרפות · הרשאות אישיות |
| | נוכחות | סבבים · כללי נוכחות |
| | foot | הגדרות היחידה (one quiet row) |
| הגדרות היחידה (setup) | הקמת היחידה | the checklist (D-180), while unfinished; the next step marked |
| | מבנה | מבנה היחידה (with סוגי יחידה) · דרגים פיקודיים |
| | הרשאות | רמות הרשאה (with הרשאות לפי דרג פיקודי) |
| | קטלוגים | סוגי היעדרות (with their groups) · תגיות · שדות נוספים |
| | נתונים | ייבוא וייצוא |
| | מתקדם | קטגוריות תגיות |

- **Setup's surface:** the same `glass-drawer` panel as "ניהול יחידה" on every screen, its rows replaced by setup's,
  with a back arrow in its header; the deep link of each module is unchanged.
- **Names:** the definitions of extra details are "שדות נוספים" in setup; their values on a card stay "פרטים נוספים".
- **Moved out of tabs:** command levels leave the soldiers module for "מבנה"; tag categories leave the tags module for
  "מתקדם". Unit types stay a tab of the structure, permission bindings a tab of the permission levels, absence groups a
  tab of the absence types: each is part of the same definition.
- **On the person (work):** the soldier's card holds their tags, their extra details and their access: the permission
  levels granted to them, a grant and a revoke for who may manage access (the same commands as "הרשאות אישיות").
- **In place, not a dead end:** a select whose list is empty, or lacks what is needed, ends with "+ חדש" for who may
  create it (a unit type, a command level, a tag, an absence type, a tag category): the module's own form in a
  popover, and the new item is chosen on save. A permission level opens its form and returns. For who may not create it, the empty
  field says "עוד לא הוגדר" and who sets it up.
- **A tag without categories:** the tag's form chooses the first live category and lets it change; with none, the
  category field offers the in-place creation with "כללי" filled in, saved before the tag.
- **Templates (D-262):** every template, the empty one too, starts the unit with tag categories; the empty one with
  "צבאי" and "אזרחי" (V27).

## Patterns of a module

- **List:** rows with a bottom hairline. A row has an optional handle, an optional color dot, the name as a
  button that opens its form, a muted second line, and an `ActionMenu` on the inline end. A tree indents by
  `lg` per depth, and the depth is read aloud.
- **Moving rows (D-092):** every drag has a way without a pointer in the row's menu ("up", "down", "move to").
  The handle is the only part that starts a drag and takes `touch-none`, so the list still scrolls by finger.
  While dragging, a `marker` line shows "before" or "after", and an `inner` fill shows "into".
- **Form:** `EntityForm` holds a title, the fields, the refusal and the actions, with the primary action last.
  Fields validate on submit with the schema, through `validatorResult`. What the adapter answers lands on its
  field through `formStateOf`, or above the actions if no field fits. An edit form holds the row as it was when
  opened and saves with that version. A `stale_version` answer offers to continue from the new version.
- **A refused action with no form:** `FailureNotice` at the top of the list, announced as an alert, cleared by the
  next action. The list itself does not change.
- **A long list:** `VirtualList`, which scrolls with the drawer's body and tells a screen reader each row's place in the
  whole list. Search goes above it, with the new-item button beside the search, because the end of the list is far away.
- **A page of sections:** when a row has parts with their own permission and version, it opens a page with a "back to
  list" button and one section per part (`SoldierPage`). A section appears for who may read it, and is a form for who may
  also write it. A form holds what it opened, so a change from another tab never replaces what is being typed.
- **A dialog with fields:** `SmallDialog` with fields inside. It shows the adapter's answer on the fields, and keeps
  anything else in a `FailureNotice` above the actions.
- **A question:** `SmallDialog`. An action that cannot be undone uses `alertdialog`, says so in its body, and names
  the action on the button.
- **Empty and loading:** `EmptyNotice` says what comes next and holds the first action, if the actor may take it. Its
  heading is `h3` in a drawer and `h2` in the viewport, so headings never skip a level.
- **A list in groups:** each group is a `section` with an `h3`, and its list is labelled by that heading
  (`LeaveTypesModule`). Up and down in the row menu order a row inside its group.
- **A page of one row with steps (D-119):** `LeaveDetails`. A header with the row's sign, name and a `StatusChip`; a
  `dl` of what it is; one `role="group"` of the steps the actor may take now, the primary one first; then its thread.
  A step with no question acts at once and shows before the command answers. A step that closes something asks in a
  `SmallDialog` with an optional note. A refusal shows in a `FailureNotice` above the steps, over the row as stored.
- **A list of choices:** `CheckList` (many) or `RadioList` (one, with "ללא"), each row a box that carries a check, the
  name, an optional dot of its color and a quiet note ("בארכיון"). A soldier's tags and the filter chips use them.
- **Tags on a soldier's page (D-130):** a section with the tags held, each a pill on `inner` with its color's dot, under
  its category; "עריכת תגיות" opens a `SmallDialog` with a list per category.
- **Present and absent lists (D-134):** the day as a heading between "יום קודם" and "יום הבא", "היום" while another day
  shows, a hint, then "חסרים" and "נוכחים", each an `h3` with its count and a list: the name and rank, a quiet line of why
  (the types, "ממתין לאישור", markers), and a dot of the absence's color.
- **A thread:** an `ol`, oldest first, of what happened and what was written. A line has a bold title, its day and time
  in the organization's time zone (`formatInstant`), quiet lines of what changed (`before ← after`), and who did it.
  A comment's title is its author. Only the author's own comments have an `ActionMenu`. The box for a new line sits
  under the thread, with a `TextAreaField`.
- **Status as a chip:** `StatusChip` carries status by form as the bars do: solid for approved, a dashed edge for
  pending, a plain edge for rejected, a quiet one for cancelled.
- **A warning before sending:** a form says what sending will cost in a dashed `status-pending` box above its actions
  (an approved leave that will wait for approval again).
- **A list of requests (D-120):** `VirtualList` rows: the row's sign, a name over a quiet line of details as one button
  that opens it, and beside it either its quick steps or its `StatusChip`.
- **A choice in a menu:** a `MenuSection` with a heading and checkable items, each with a small box that holds a check
  (the user's "approve now" default, D-121).
- **Rule answers (D-142):** a form warns while filled in a box above its actions: dashed `status-pending` for a soft
  rule, a `status-rejected` edge for a hard one. The command's answer opens one `alertdialog` with the broken rules:
  "שמירה בכל זאת" for soft rules, only "סגירה" for a hard one.
- **Broken rules (D-138):** `RuleViolations` lists each rule with an enforcement chip (`קשיח` solid `status-rejected`,
  `רך` dashed `status-pending`), a quiet line of its unit and group, and per day the bound, how many are available and
  who is missing. A name the actor may not read is "לא ידוע".
- **The heat row (D-141):** under the days header, inside its sticky frame, a row the height of a timeline row with the
  label "כללים" and one cell per day: empty, a dashed `status-pending` cell, or a solid `status-rejected` one, with the
  count. A cell is a button named by its day, its count and the worst rule. It always sits there, sticky above the soldiers
  (D-310). It is absent when no rule
  concerns the scope.
- **The user menu** is an avatar at the top strip's inline end on every screen; the soldier's name is its tooltip and is
  read aloud with "תפריט משתמש" (D-189).
- **The phone's tab bar** never widens the page: its tabs share the width, and scroll sideways in their own row only when
  they outgrow it (D-155, D-189).
- **A unit the actor does not see:** `unitStateLabel` says "ללא יחידה", "יחידה אחרת" or "לא ידוע" (D-106), the same in
  every list.

## Components so far

| Component | Where | Notes |
|-----------|-------|-------|
| `Button`, `IconButton` | `ui/primitives` | `primary` or `quiet`. An icon button still has a name |
| `TextField`, `TextAreaField`, `SearchSelectField`, `ComboField`, `SelectField`, `ColorField`, `IconField`, `SwitchField`, `DateField` | `ui/primitives` | Label, value, one error. They know nothing about forms. `ComboField` picks a named row by typing |
| `CenteredSheet` | `ui/patterns` | Full-screen state with a title and an optional hint |
| `Drawer`, `SmallDialog`, `ActionMenu` | `ui/patterns` | Floating surfaces, in the order they stack |
| `EntityForm`, `FailureNotice`, `EmptyNotice`, `LoadingNotice` | `ui/patterns` | The frame and the states of a module |
| `VirtualList` | `ui/patterns` | A long list inside a drawer |
| `formatDate`, `formatDateRange`, `formatInstant` | `ui/patterns` | A stored day, two as one range (`8–14 בנוב׳`), or a moment in a time zone, from the presets in `config` |
| `useIsDesktop`, `unitStateLabel` | `ui/patterns` | The breakpoint as a value; the label of a unit the actor does not see |
| `validatorResult`, `fieldError`, `formStateOf` | `ui/patterns` | Field issues (D-068) in TanStack Form |
| `UserMenu`, `IdentityList` | `ui/shell` | Who is signed in, sign-out, dev identity switcher, import and export |
| `ModuleDrawer` | `ui/shell` | The map of what opens in the drawer, with each group's sections |
| `Viewport`, `UnitSelector`, `ViewSheet`, `WindowNavigator` | `ui/shell` | The engine in the middle, the controls of the bars, and the view sheet (D-311) |
| Engine registry, `TimelineEngine`, `ListEngine`, `TableEngine`, `CalendarEngine` | `ui/engines` | The views that exist; the timeline as core, view and adapter, the others as adapters |
| `BoardEngine`, `EngineScroller`, `LeaveChip` | `ui/board` | What every engine shares: the frame and its states, the scroller region, a leave as a chip |
| `UnitsModule`, `UnitLevelsModule`, `SoldiersModule`, `CommandRanksModule` | `ui/modules` | The shape of the next modules |
| `LeaveTypesModule`, `LeaveTypeGroupsModule`, `LeavesModule`, `LeaveSheetForm`, `NewLeaveButton` | `ui/modules`, `ui/shell` | Leave types by group, the request sheet (D-275) and its "+" |
| `LeaveDetails`, `LeaveEditForm`, `LeaveThread`, `LeaveStepDialog`, `StatusChip`, `TypeMark` | `ui/modules/leaves` | One leave: its steps, its edit form, its thread |
| `PendingRequestsModule`, `ClosedLeavesModule` | `ui/modules/leaves` | The requests inbox |
| `MyLeavesModule` | `ui/modules/leaves` | The actor's own requests, open and history (D-167) |
| `TabBar`, `moduleEntries` | `ui/shell` | The bottom strip's destinations and the entries they open (D-252) |
| `NavigationPanel` | `ui/shell` | "ניהול יחידה": the set-up modules by section (D-173, V25) |
| `RolesModule`, `RankBindingsModule`, `GrantsModule`, `ScopeFields` | `ui/modules/access` | Roles, their rank bindings, personal grants, and the scope picker |
| `CheckList`, `RadioList` | `ui/primitives` | Short lists of named choices, many or one |
| `TagsModule`, `TagCategoriesModule`, `SoldierTagsSection` | `ui/modules/tags`, `ui/modules/soldiers` | Tags by category, the categories, and a soldier's tags |
| `PropertiesModule` | `ui/modules/properties` | Property definitions by entity, their options and order (D-176) |
| `DeploymentsModule`, `DeploymentForm`, `DeploymentMembersForm` | `ui/modules/deployments` | Deployments and who serves in them (D-179) |
| `LeaveBatchForm`, `LeaveDuplicateForm`, `SenioritySection` | `ui/modules/leaves`, `ui/modules/soldiers` | A collective leave, copies of a leave, and personal seniority (D-179) |
| `PropertyFields` | `ui/patterns/properties` | One field per live property of an entity, ending the soldier, unit and leave forms (D-176) |
| `FilterBar`, `FilterButton` | `ui/shell` | The filter row (a chip per rule, "or" between, clear all), and "סינון ומיון" in the bar (D-312) |
| `RuleBuilder` | `ui/shell` | Filter rules and sort rows of the board (D-312, D-313) |
| `MenuChoice`, `menuStyles` | `ui/shell` | A menu item with a check while selected, and the bar menus' classes |
| `DayReportDialog` | `ui/modules/presence` | The day report: counts, units, names, reasons, a span, the text copy and the image (D-193 … D-196) |
| `RulesModule`, `RuleForm` | `ui/modules/rules` | Rules, conflicts and a day's broken rules |
| `RuleViolations`, `RuleBrief`, `RuleGateDialog`, `RuleWarnings` | `ui/patterns/rules` | Broken rules in full and in brief; the acknowledgment dialog and the live warning (`useRuleGate` in `ruleAnswer.ts`), shared by modules and the timeline (D-143) |
| `DragOverlay`, `useBoardDrag`, `useDrag` | `ui/engines/timeline` | A drag on the board: its card, its refusal and its gate (adapter), and the pointer (view) |

Errors are shown through `ui/errors/messages.ts`, whose maps from code to i18n are total: a new code does
not compile until it has a message.
