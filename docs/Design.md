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
| `absence`, `absence-edge` | Every absence in the uniform color mode of the timeline: the fill text reads on, and its dashed edge (D-112) |
| `palette-<key>` | The 12 colors users choose (D-074). Each passes 3:1 on `surface`, so they are for shapes, not text |

A palette key reaches the screen through `PALETTE_SWATCHES` (`ui/theme/palette.ts`), whose map is total. A shape
painted in a user's color takes its `PALETTE_TONES`: a solid fill, a faint fill (10%), an edge and an icon color.
An icon key reaches the screen through `ICON_GLYPHS` (`ui/theme/icons.ts`), also total, with a name read aloud. A
user's color says nothing by itself, so a row also has its name, and the color field reads each swatch's
name aloud and marks the selected one with a check.

## Glass

Five surfaces, each with a solid fallback under `prefers-reduced-transparency`:

| Utility | Use |
|---------|-----|
| `glass-bar` | Floating navigation |
| `glass-card` | A sheet on the canvas (sign-in, onboarding, full-screen states) |
| `glass-menu` | Popovers and small dialogs |
| `glass-drawer` | The drawer and the bottom sheet: nearly opaque, because forms are read on it |
| `glass-action` | The primary action, dark glass |

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

- **Workspace (D-023, D-108):** a `surface` panel on the `canvas`, filled by the active engine. Glass bars float over
  it. From `md`, two bars at the top: on the inline start the organization's name (the page's `h1`), the unit selector
  and the view switcher; on the inline end the week, "today", the modules and the user menu. Below `md`, the week, the
  unit and the view at the top, and the name, the modules and the user at the bottom. Content starts under the top bar
  (`under-bars`, `under-bars-md`), ends above the bottom bar (`above-bottom-bar`), and scrolls under the glass. A
  structure that differs by screen uses `useIsDesktop`; anything else is CSS.
- **Timeline (D-108):** sizes come from `TIMELINE_LAYOUT` in `config`, because the geometry and the virtualizer need the
  same numbers: rows 36 (44 on mobile, where a name is a touch target), group rows 32, the days header 28, names 124,
  days at least 64 and sharing any extra width. The days header is a glass pill that sticks under the bars. The name
  column sticks to the inline start on `surface`, so days pass under it when the grid scrolls sideways. A group header
  row sits on `canvas`. Days a row is out of the selected unit are muted with `inner` and read aloud as ranges.
  Positions are inline offsets from the core, so RTL needs no mirroring.
- **Leaves on the timeline (D-111, D-112):** sizes come from `TIMELINE_LANES` in `config`: bars 20 high, inset 3 inside
  their days, a lane step of 24. A bar is its type's color: solid when approved, a 2 px dashed edge over a faint fill when
  pending, square on a side the window cuts. A marker is a 20 px round badge on `surface` with its icon, on each day,
  over any bar. Overlaps take lanes, and a row grows by a lane step for each lane beyond the first. In the uniform mode
  every bar is `absence`, with a dot of the type's color and its name inside, and badges are `marker`.
- **A mark is a control (D-119):** a bar is a button named by its type, its status and its days, and it opens the leave.
  Its hit area fills the gap to the next lane (24 px high in all), so lanes never take each other's presses. A marker of
  several days is one control: the first badge is in the tab order and read aloud, and the others open by pointer only.
- **The floating "+" (D-115):** a 44 px round `glass-action` at the bottom inline-end corner of the board, above the
  bottom bar on a phone. The grid ends with room for it.
- **The inbox button (D-120):** first among the module buttons, for who may approve someone. It carries the number of
  requests waiting as a small dark pill, read aloud with the button's name.
- **Module buttons (D-116):** icon and name from `md`; below it the icon alone in a 44 px `IconButton`, its name still
  read aloud.
- **A control with nothing to choose stays away (D-076):** the unit selector appears once a unit exists; "today" appears
  while the window does not hold today.
- **Outside the workspace:** one `glass-card` centered on the canvas (`CenteredSheet`), at most `sheet`
  420 wide.
- **Management modules (D-092):** `Drawer`, one surface in two forms. From `md` it is modal, at most `drawer`
  440 wide, on the inline end (the left), leaving the name column of the timeline in sight. Below `md` it is a
  bottom sheet up to 88% of the height, which also closes by dragging its grip down. Both close by Escape, the
  scrim and the close button, and enter with a short slide that `prefers-reduced-motion` turns off.
- **What is open lives in the URL:** `panel`, `entity` and, for a new unit, `parent` (`usePanel`). A panel shows
  its list, or the form `entity` names. Sections of a module are panels, so each has its own deep link.

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
| `UserMenu`, `IdentityList` | `ui/shell` | Who is signed in, sign-out, dev identity switcher |
| `ModuleDrawer` | `ui/shell` | The map of what opens in the drawer, with each group's sections |
| `Viewport`, `UnitSelector`, `ViewSwitcher`, `WindowNavigator` | `ui/shell` | The engine in the middle, and the controls of the bars |
| Engine registry, `TimelineEngine` | `ui/engines` | The views that exist; the timeline as core, view and adapter |
| `UnitsModule`, `UnitLevelsModule`, `SoldiersModule`, `CommandRanksModule` | `ui/modules` | The shape of the next modules |
| `LeaveTypesModule`, `LeaveTypeGroupsModule`, `LeavesModule`, `NewLeaveButton` | `ui/modules`, `ui/shell` | Leave types by group, the new-leave form and its "+" |
| `LeaveDetails`, `LeaveEditForm`, `LeaveThread`, `LeaveStepDialog`, `StatusChip`, `TypeMark` | `ui/modules/leaves` | One leave: its steps, its edit form, its thread |
| `PendingRequestsModule`, `ClosedLeavesModule`, `InboxButton` | `ui/modules/leaves`, `ui/shell` | The requests inbox and its button |

Errors are shown through `ui/errors/messages.ts`, whose maps from code to i18n are total: a new code does
not compile until it has a message.
