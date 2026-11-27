# Sagol — Design language

Two languages live here while R5 runs (D-453, D-464). **"The new interface" below is the target** and binds all new
UI work. The sections after it were derived from what was built (D-024) in the Stone 3 direction (D-077) and
describe the screens not yet rebuilt. Values live in `src/ui/theme/tailwind.css`, and this file says how to use
them. The rules bind both.

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

## The new interface (R5, D-453 … D-464)

The owner's concept, adopted in D-453. **Its source is `design/handoff/`:** `03-board-spec.md`, then
`02-design-decisions.md`, then `01-handoff-package.md`, then the images; text wins over an image. This section says
how the package lands in the product: token names, what each screen replaces, what the package leaves to us (states,
desktop, tap paths), and every decision of our own. It does not repeat the package. **The sections after this one
describe the interface being replaced.** Each stays true for a screen until that screen's batch lands (D-464), and
is then removed or rewritten here.

### Principles (short; the package holds the full text)

- **Four places.** "היום" (what needs me now), "לוח" (the force over time), "ניהול" (the unit's tools), "אני"
  (my own details, rotation and requests). Tabs follow permissions, never a role name (D-455).
- **Color is meaning.** Night blue is the one action color. Amber is "below the threshold" or "waiting". Green and
  red are only a closed status. A leave type has no color; its icon and name carry it (D-454).
- **One fact, one indicator, and every indicator is a door.** A number, a cell or a badge opens the thing it counts.
- **Open block and card.** A screen's main fact sits open on the background (a figure at 48); everything else is a
  white card. Compact first; a block expands in place.
- **A floating layer.** Top corners hold glass circles and a capsule; a 70 px blur band lets content scroll under
  them; the tab bar floats at the bottom and collapses on scroll down.
- **Minimal copy.** No explanation text where the layout says it. Present tense ("חוזר היום", "יוצא היום").
- **Three layers per feature:** seen at a glance, one tap (a drawer), full page. Nothing is built deeper.

### Tokens

Values live in `src/ui/theme/tailwind.css`; the package's token is on the left. A name that exists today keeps its
name and takes the new value, so untouched screens move with the theme.

| Package | Token | Light |
|---|---|---|
| `color-primary` | `action-solid` | `#2B3A55` |
| on primary | `on-action` | `#FFFFFF` |
| `color-primary-soft` / on it | `action-soft` / `on-action-soft` | `#E3E8F0` / `#1E2A40` |
| `color-bg` | `canvas` | `#F2F1EE` |
| `color-surface` | `surface` | `#FFFFFF` |
| `color-surface-subtle` | `surface-subtle` | `#F7F6F3` |
| `color-fill-muted` | `inner` | `#ECEAE5` |
| `ink`, `ink-2`, `ink-3` | `text`, `text-muted`, `text-faint` | `#1B1A1F`, `#5C5A63`, `#8E8A97` |
| past days | `past` | `#9A97A0` |
| divider, divider strong | `divider`, `divider-strong` | `#F0EEEA`, `#E4E2DD` |
| border | `line` | `#D9D6CF` |
| toggle off, dashed outline | `toggle-off`, `line-dashed` | `#C9C6BF`, `#D3D0C9` |
| pending | `status-pending-bg`, `-text`, `-line` | `#F8EDD5`, `#7A4F0B`, `#D39A2C` |
| threshold cell | `status-pending-cell` | `#FBF4E4` |
| ok | `status-ok-bg`, `-text` | `#E1F0EA`, `#1E6B52` |
| rejected | `status-rejected-bg`, `-text` | `#F7E3E0`, `#9B2C24` |
| error text | `status-error` | `#8E2C22` |
| on base | `time-base` | `#3A3743` |
| leave round | `time-round` | `rgba(139,136,146,.28)` |
| approved request | `time-approved` | `#C9C5BC` |
| pending request | `time-pending` (fill), `status-pending-line` (border) | `#F6E4C2` |
| label on a bar | `time-label` | `#3A3940` |

- **Dark (D-181 stays).** The package is light only. The dark set is derived by the same roles: `canvas` `#121214`,
  `surface` `#1C1C20`, `surface-subtle` `#222227`, `inner` `#2A2A30`; `text` `#EDEDF0`, `text-muted` `#A9A7B0`,
  `text-faint` `#7F7C88`, `past` `#77747F`; `line` `#3A3A41`, `divider` `#26262B`, `divider-strong` `#303036`;
  night blue lifted to `#9FB4DC` under `on-action` `#131A28`, `action-soft` `#263147` under `#D5DEF0`; pending
  `#3A2E14` / `#F0C670` (line `#D39A2C`, cell `#2A2313`), ok `#15332A` / `#7FD0B0`, rejected `#3D1D1A` / `#F0958B`;
  time: base `#CFCCD8`, approved `#5A5861`, pending `#5A4520`, label `#EDEDF0`.
- **Names in transit (D-464).** `status-approved`, `status-pending`, `status-rejected`, `marker`, `today`,
  `absence`, `palette-*`, the `text-name` to `text-micro` steps, the `bar`, `panel`, `pill` and `sheet` radii, the
  `rim`, `float` and `action` shadows and the `glass-bar`, `-card`, `-menu`, `-action` utilities serve only the
  screens not yet rebuilt. Each is removed with the last screen that uses it.
- **Type.** Heebo, self-hosted (unchanged). `text-display` 48 (the open block's figure), `text-title` 28,
  `text-heading` 17, `text-body` 15, `text-small` 13, `text-caption` 12 (chips, badges, captions: the mockups' 14,
  12 and 11 map to 15, 13 or 12). `text-input` stays 16, so iOS does not zoom a focused field. Weights 400, 500,
  600, 700.
- **Radius.** `card` 20 (cards, a drawer's top corners), `control` 16, `chip` 12, `small` 4 (bars and cells of time
  components), `full` (glass circles, capsules, the tab bar, badges).
- **Spacing.** 2, 4, 6, 8, 10, 12, 16; side margin 16; card padding 16; a row is 44 high, which is also the minimum
  hit area (`touch`).
- **Shadow.** `shadow-glass`, `shadow-bar`, `shadow-drawer`, `shadow-menu`, `shadow-primary`, with the package's
  values.
- **Glass.** `glass-clear` (floating circles, capsules, the tab bar), `glass-drawer` (over a dim layer),
  `glass-regular` (menus, trays). With "reduce transparency", or where `backdrop-filter` is missing, each becomes
  the opaque `surface` or `canvas`.
- **Motion.** `duration-tap` 120 ms, `duration-ui` 200 ms, `duration-drawer` 280 ms, `ease-standard`
  `cubic-bezier(.2,.8,.2,1)`. With "reduce motion" a slide becomes a crossfade and nothing springs. Loading shows
  skeletons in the content's shape, never a spinner.

### Shared components

| Component | What it is | Used by |
|---|---|---|
| Tab bar | A floating glass bar of icons, no labels (house, timeline, clipboard-check, person; 26). The active tab is a glass capsule behind a night-blue icon. Collapses on scroll down, returns on scroll up. Tapping the active tab returns to the top and to today | every main screen |
| Action circle | A separate night-blue glass circle at the bar's end, on "היום" only: a leave request for me | היום |
| Corner circle, capsule | Glass circle (bell, back, close) and a capsule of two or three icons (search, options, add). 44, shrinking to 36 with the header on scroll. A night-blue dot on the options icon when a value is not the default | every screen |
| "Where am I" capsule | Centered at the top once the title scrolls away; tapping it returns to the top | long pages |
| Options menu | One floating glass menu of rows with the current value ("מיון · ותק ›"); choices open inside it with a back arrow. Replaces chip rows for sort, group, filter, range and saved views | לוח, חיילים, pages with a list |
| Drawer | Glass over a dim layer, with stops (edge, middle, full), a handle, ✕; dragging changes the stop and "כרטיס מלא" reaches full without a drag. A side panel on a desktop | all shared drawers |
| Tray | Replaces the tab bar while something is selected ("N נבחרו" and its actions) | day selection, multi-select |
| Fraction | `{n}/{total}`: the numerator big and bold, the denominator small and gray; both amber below the threshold | commander block, calendar, drawers |
| Person row | 44 high: name, a small line (role, tags), seven dots (filled on base, hollow away; today first and larger) | חיילים, drawers |
| 14-day strip | Bars with day numbers, today first; days are picked on it | היום (soldier), person card, "הסבב שלי" |
| Month | A month grid with request bars, amber cells below the threshold, a selected outline; arrows beside the month's name | לוח, "הסבב שלי", the soldier's expanded block |
| Badge | 26 high, `full` radius: "ממתינה" (pending), "אושרה" (ok), "נדחתה" (rejected) | requests everywhere |
| Toast | One line at the bottom with "ביטול" where the action can be undone (D-461) | after an action |
| Card | White, `card` radius, 16 padding, a `text-heading` title, the whole card or its title row a door | היום, אני |

### Screens: what each image shows and what it replaces

"Current" = the image is the target as drawn. "Shared parts outdated" = the screen's own content is the target, but
the tab bar, the commander block, "X מתוך Y", past tense, the amber dot, chip groups, the person card's
"יציאה עבורו" button and the soldier's calendar follow the text (the list is in `01` §4).

| Image (`design/handoff/screens/`) | Screen | Replaces today | Image status |
|---|---|---|---|
| `היום – טלפון – לוחם`, `– מורחב`, `– בחירת ימים` | היום, without a force | `HomeLanding`, "הסבב שלי" on "שלי" (D-360) | shared parts outdated |
| (text only: `02` "Today — open block", `design-language/07`) | היום, with a force | `HomeLanding`, the dashboard's status cards (D-362) | text |
| `לוח – טלפון – לוח שנה`, `– מגירה באמצע` | לוח · לוח שנה | the calendar engine, the day report's entry (D-339) | current |
| `לוח – טלפון – ציר זמן` | לוח · ציר זמן | the timeline and list engines on a phone | current |
| `לוח – טלפון – תנועות` | לוח · תנועות | (new: who leaves and returns, by day) | current |
| `ניהול – טלפון – מ״פ`, `– מ״מ` | ניהול | "ניהול יחידה" and "עבודה" (D-254, D-285), `NavigationPanel` | shared parts outdated |
| `חיילים – טלפון – מ״פ`, `– מ״מ`, `– בחירה מרובה` | ניהול → חיילים | the soldiers module's list | shared parts outdated |
| `חיילים – טלפון – כרטיס אדם` | Person card (drawer) | the soldier page | shared parts outdated |
| `הוספת חיילים – טלפון – רגיל` | הוספת חיילים | quick entry and import (D-171) | current but for the frame |
| `הצטרפות – טלפון – *` (five) | ניהול → בקשות הצטרפות and its drawers | `AccountLinksModule` (OI-382) | shared parts outdated |
| `כללי נוכחות – טלפון – *` (five) | ניהול → כללי נוכחות, rule details, form, archive | the rules module | shared parts outdated; the form is revisited at the end (OI-385) |
| `אני – טלפון – רגיל`, `– לוחם`, `– מורחב`, `– עריכת פרטים` | אני | "שלי", the profile | shared parts outdated |
| `אני – טלפון – הסבב שלי` | אני → הסבב שלי | "הסבב שלי" (D-360) | shared parts outdated |
| `אני – טלפון – כל הבקשות` | אני → כל הבקשות | the requests hub's "mine" (D-255) | shared parts outdated |
| `אני – טלפון – העדפות` | אני → העדפות | the profile's appearance, notifications, account | shared parts outdated |
| `יציאה חדשה – טלפון – רגיל` | New leave (drawer) | the leave form | shared parts outdated |
| `כרטיס יציאה – טלפון – בקשה ממתינה` | Leave card (drawer) | the leave drawer | shared parts outdated |
| `דוח 1 – טלפון – מגירה` | דוח 1 (drawer) | `DayReportDialog` | shared parts outdated |
| `מגירת יחידה – טלפון – מ״פ` | Unit drawer | (new: who is and is not on base on a day) | shared parts outdated |
| (text only) | Notifications drawer, pending-requests page | "עדכונים" (D-351), "awaiting me" (D-255) | text |

`design-language/01` … `06` are the language, the block template, the toolbox, gestures, the three layers and the
placement map; `07` is current and wins over them for the tab bar, numbers and time components.

### Navigation

- One route, state in the URL, as today (D-023). A main screen is the `tab` param (`today`, `board`, `manage`,
  `me`); an inner page is `page`; a drawer keeps `panel` and `entity` (D-104), so a link opens the same thing and
  "back" closes the top layer first.
- **Who sees what (D-455).** "היום" and "אני": everyone. "לוח": who reads leaves of soldiers other than themself.
  "ניהול": who is permitted at least one of its rows. The action circle: who may request a leave for themself. A
  row, a card or an icon the actor cannot use is absent (D-076).
- **ניהול's rows.** The designed tools first (חיילים, בקשות הצטרפות, כללי נוכחות), then, after a gap, the tools
  that exist and are not yet designed, each opening its current screen inside the new frame (D-456): the unit tree,
  leave-round planning and collective leave, deployments and rotations, the dashboard, and "הגדרות" (roles, leave
  types, tags, properties, command ranks, unit levels, organization).
- **Creation is in context.** No global "+". Days picked on a strip, a month or a timeline row open a tray, and the
  tray opens "יציאה חדשה". A soldier and a rule are added from the add icon in their page's capsule.

### Built so far (R5·1 and most of R5·2; D-465 … D-471)

- **Shell.** `WorkspaceScreen` shows one destination by `tab`, the floating `TabBar`, and the drawers over both. A
  page (`PageFrame`) is one centered column on the canvas, at most `drawer` wide, that scrolls under the bar; once
  scrolled its top blurs out in a 70 px band (`blur-band`). The bar slides away after 12 px of scrolling down and
  returns after 12 px up, in `duration-drawer`, with no motion under "reduce motion"; keyboard focus brings it back.
  The corner glass circle (a bell) is on "היום", "ניהול" and "אני".
- **היום, a soldier.** The date line, "בבסיס" or "בבית" at display size, and a line of what comes next ("היציאה
  הבאה: יום חמישי · 19.11") that is the button opening the 14-day strip into the month, in place. In the month a
  day is a 44 px button for who may request a leave: one tap starts a range, a second ends it, a tap on the only
  day clears it. The tray "בקשת יציאה · 3 ימים" then replaces the tab bar and opens the new-leave form with the
  days filled.
- **היום, a commander.** The unit's name and the date, the fraction of who is on base today, "דוח 1" for who reads
  the unit's soldiers while a rotation runs, and seven day columns, today first in night blue, amber where a rule
  is broken. A column opens the unit's drawer on its day: who is away, then who is on base.
- **Cards**, in D-459's order, each absent when empty: "בקשות לאישור" (three rows with ✗ ✓, a count, a door),
  "בקשות הצטרפות", "הבקשה שלי" (type, dates, badge), "דוח 1" (a door, for who has no unit block, D-472), "איתך
  היום" (for who holds `presence:view` and has no unit block: the count beside the title, the names of who of their
  unit is on base today as wrapped name pills, no door, D-478), "הסטטוס שלי" (for who sees the unit's block). In routine a
  notice comes first (D-469).
- **The pending-requests page** (`page=requests`): back, the title, the "approve now" default, every waiting
  request, a door to the closed ones. A toast follows a step.
- **ניהול.** The title, the organization's name, thin rows with a value and a chevron (D-468); "הגדרות" is a page
  of sections on white cards.
- **אני.** The name and the email, then cards: appearance (a segmented choice), notifications (switches), account.
- **לוח.** The engines as they were, under one glass strip: the unit, the range, the view picker (the icon of the
  view in sight) and "סינון ומיון". Focus mode still leaves one button.
- **Components** are in `src/ui/kit`: `Glass` (circle, capsule), `Card`, `Badge`, `Fraction`, `PersonRow`,
  `DayStrip`, `Month`, `Toast`, `Tray`, `StopDrawer`. The drawer with stops opens at half height and grows to
  full; its handle is a button (D-458); from `md` it is a panel on the inline end.
- **"דוח 1"** opens in the drawer with stops, at full height: the day between its arrows, the counts, a white card
  per unit that opens to its names, "שליחה" per unit, the text copy and the image. Once sent, the button of "היום"
  reads "✓ 07:40" (D-475).
- **"יציאה חדשה"** opens in the drawer at full height: the soldier, then per request a row of type chips, how many
  days, the two dates with "בחירת הימים בלוח" (the month, two taps for a range), the reason, "חוזרת", and "לאשר
  מיד" for who may. **The leave card** opens at half height, named by the leave's type: a white card with the days
  large, type and days, the badge; then the actions, two in a row with equal weight; then the history (D-476).
- **The strip** draws the leave round quiet (`time-round`), another absence filled (`time-approved`) and a request
  that waits amber; the month does not draw the leave round.
- **Desktop** uses the same shell until R5·6.

### A tap path for every gesture (D-458)

| Gesture | Tap path |
|---|---|
| Swipe a request row (✓ ✗) | Tap the row: the request opens with the same actions |
| Long-press a row (multi-select) | "בחירה" in the page's options menu |
| Long-press a button (saved views) | The same choices in the options menu |
| Swipe between days or months | Arrows beside the date or the month's name |
| Pinch on the timeline | "טווח" in the options menu, which also holds a custom range |
| Long-press a day (range) | "בחירת טווח" in the day's tray, then a second day |
| Drag a drawer | "כרטיס מלא"; ✕ or a tap outside closes |
| Drag in the unit tree | "⋯" → "העברה" (pick a parent), "הזזה למעלה", "הזזה למטה" |
| Drag a bar on the timeline | Phone: none; a bar opens its leave card, where dates are edited. Desktop: drag stays (D-143), with the same card |

### States the package leaves to us

- **Loading:** skeletons shaped as the content (a 48 figure block, card outlines, 44 rows). The frame (tab bar,
  corners) is there from the first paint.
- **Empty:** a card with nothing to show is absent; "הסטטוס שלי" always shows (D-459). A list page with no rows
  shows one `text-muted` line and, where the actor may add, the add action. A filter that hides everything says so
  and offers "ניקוי".
- **Error:** a failed read shows a card in place with "ניסיון נוסף"; a failed action keeps the form or drawer open
  with the reason beside the control, in `status-error`. Offline changes queue as today (D-184) and say so in a toast.
- **Signed out, not linked, no organization:** the current sign-in, join and setup flows, in the new tokens and
  type, each as one centered column with one primary action.

### Desktop (D-460)

The phone is the design; the desktop is derived. From the `desktop` breakpoint: the tab bar is a side rail on the
inline start (icons with labels, the action as its first item); a drawer is a side panel on the inline end, not a
centered dialog; "היום" and "אני" are one centered column (the feed's width, not stretched); "ניהול" is its list
beside the open page; lists of people are tables where a row has more than three facts; the unit tree is a
hierarchy diagram. "לוח" is the exception: a wide timeline with the calendar and movements beside it in the panel,
and dragging a bar stays.

### Accessibility and RTL

RTL throughout, logical properties only; technical values `ltr`. Text contrast 4.5:1 on its surface in both sets
(amber text is `status-pending-text`, never the border color). Every icon-only control has a label from `@i18n`.
Hit areas 44. Focus is visible (`focus`), drawers trap focus and return it. Color is never the only signal: a
status has a word, a bar below the threshold has its number. Every gesture has a tap path (above). "Reduce motion"
and "reduce transparency" are honored. The e2e suite's axe pass covers each rebuilt screen on phone and desktop.

### Own decisions and deviations (for the owner's review)

Each is ours (D-170), not the package's. A row is added whenever a batch decides something the package did not.

| # | What | Why | Decision |
|---|---|---|---|
| 1 | The undesigned tools (leave-round planning, temporary units, rotations, routine switch, settings, the dashboard) stay as their current screens under "ניהול" | Removing them would lose capabilities units use; the package marked this open | D-456 |
| 2 | "איתך היום" shows to who holds the presence-only permission `presence:view` and has no "לוח": names of who of their own unit (and the units under it) is on base today, answered by the server; the card opens nothing (superseded the earlier "no new permission", D-457) | The owner decided a plain soldier sees who is with them without reading leaves; the unit drawer the package names reads leaves | D-478 |
| 3 | Tap paths for the gestures marked "Open" follow the package's recommendations; a phone timeline bar is not dragged | A drag on a scrolling phone timeline fights the scroll | D-458 |
| 4 | היום's cards: fixed order, an empty card is absent (but "הסטטוס שלי"), no maximum; "בקשות לאישור" opens a pending-requests page | The package left order, empty and maximum open | D-459 |
| 5 | Desktop layout as above | The package gives rules, not screens | D-460 |
| 6 | A 12 px caption step; one value per radius (20, 16, 12, 4) | The package gives ranges and asks for a proposal | D-454 |
| 7 | A dark set, derived | The package is light only; the appearance choice exists (D-181) | D-454 |
| 8 | Leave-type colors and the "uniform color" mode leave the time components | "Color is meaning": a type is an icon and a name | D-454 |
| 9 | A soldier with no permission to edit a soldier has no pencil on "אני" | Nobody edits their own record today; granting it is a permissions choice, not UI | D-463 |
| 10 | Archive sits behind "⋯", confirms by name, and offers "ביטול" in a toast; a rule's priority is a number under "עוד", with no "move to top" | OI-297; no reorder command exists | D-461 |
| 11 | Saving a view equal to an existing one is refused and names it | OI-381 | D-462 |
| 12 | "Only missing" is removed; a phone's default board view is the calendar; the day report's cut-over hour stays one config value | `03` §5; OI-380 | D-463 |
| 13 | An address that names something of the board opens "לוח"; any other address without a destination opens "היום"; nothing is remembered per device | Links made before the tabs must still open their board | D-465 |
| 14 | "לוח" and the commander's block also show to who holds leaves over a unit and sees nobody else yet | A new owner is alone in the organization | D-466 |
| 15 | The requests drawer stays, as the row "בקשות" of "ניהול", for the closed requests; the toast's "ביטול" shows only to who may take the step back | The card is absent when nothing waits; reopening a rejected request is its own permission | D-467 |
| 16 | "הגדרות" is a page behind the last row of "ניהול"; a row of the index is named by its tool alone, and its value describes it | The two places of D-285 stay two; a short name is found by a reader | D-468 |
| 17 | In routine, "היום" opens with a notice that names the mode, with "פתיחת סבב" for who may | The package has no routine state; the quick action of the old strip is gone | D-469 |
| 18 | "אני" holds what the user menu held; the corner circle opens the "שלי" drawer | Its own batch (R5·5) replaces both | D-470 |
| 19 | The options menu, "דוח 1" in the new drawer, new leave and the leave card in the new drawer, "סבב יציאות · תכנון" and "איתך היום" are not in this batch | Each is an open item with its batch | D-471 |
| 20 | "דוח 1" is a card on "היום" for who reads the unit's soldiers and has no unit block | It was a destination of the old strip for all of them | D-472 |
| 21 | The toast waits while it is hovered, focused or asking, and starts over at a key press; a page takes the keyboard on its heading and gives it back to its opener; the month is a keyboard grid | The package draws no keyboard or time behaviour | D-473 |
| 22 | What waits for approval is listed once, on the page of requests; the row "בקשות" of "ניהול" opens it | Two lists of the same thing drift | D-474 |
| 23 | "דוח 1" keeps every part it had, in the new drawer; its words are "שליחה" and "נשלח"; the button reads "✓ HH:MM" once every section the actor sees is sent | The package draws one named list; the product has a section per unit, a span and an image to share | D-475 |
| 24 | New leave keeps the request sheet (rows, repeat, collective, planning) behind the package's face: type chips, days on a month beside the typed dates | The package draws one request; units send several at once | D-476 |
| 25 | The form's month builds its own range and follows the typed dates; a link to the old pending tab opens the page of requests; "sent" waits for units out of view for who answers for the whole report | Found in review | D-477 |
| 26 | "איתך היום" shows a count and names, never a door; it shows whether or not its holder is on base today | The package's "big number" alone answers no "who"; a door to the unit drawer would open leaves its holder may not read | D-478 |

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

- **Replaced by the new shell (D-465): see "Built so far" above.** What follows describes the board's frame, which
  "לוח" keeps: its bottom strip is now the tab bar, and the avatar moved to "אני".
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
  columns at every width (D-339); from `md` a day's heading holds its weekday, its number (today in the dark pill) and
  how many are out, then a chip per leave with the soldier's name. Below `md` a day is one tap target: its weekday
  letter, its number, today's pill, how many are out and its breach tone, no chips; a tap opens its day report. The
  table's caption says what a row is. A chip is a `pill` of `text-label`, a dot of
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
  for who may create a rotation; none otherwise (the root unit always exists, D-315, so there is no action to found the
  tree). It replaced the
  floating "+". The routine band above the board only states the mode, in a neutral tone, and that leave requests and דוח 1 open with a rotation (D-339).
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
- **Saved views (D-387):** inside the view sheet only. Beside focus mode, "שמירת התצוגה הנוכחית" while the board
  matches no saved view (at 12, a hint and the manage list); it opens a small dialog, the name (suggested "view ·
  range") and "לפתוח את האפליקציה בתצוגה הזאת". Once one exists, the first row "התצוגות שלי": two-column cards (icon, name,
  "פתיחה" on the start view, the range kind and the condition count), the current one selected; then "ניהול התצוגות",
  which replaces the sheet's body: per row, up, down, rename in place and delete (confirmed), then the start view as a
  radio list with "ללא" first. Nothing else on the board changes. Once a change leaves the view the board was put in,
  "שמירת השינויים" with that view's name sits beside the save and writes the board over it (D-442).
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
- **Notifications** (D-356, D-357): the profile's "התראות" group shows only where the browser can push and the
  build has the public key: a switch for this device, then a check per kind (my requests, waiting for me); a blocked
  permission says so, and an iPhone outside the installed app is asked to install it first. The phone
  notification names the app, says what happened and the days, and opens the leave or the inbox.
- **Offline**: a centered sheet "אין חיבור לרשת" with "ניסיון חוזר"; the app opens by itself when the network
  returns.

## Range, sort and a calm screen (V19, D-211 … D-215)

- **Range picker**: the window label in the bar is a menu button. It lists יום / שבוע / שבועיים / ארבעה שבועות / חודש (D-383), then "סבב שלם" with the
  scope's running and coming rotations and their dates, the latest first; with none, the item is absent (D-218). Last,
  "טווח אחר" opens a small dialog with "מתאריך" and "עד תאריך", at most 186 days (D-339). The arrows'
  names follow the kind ("שבוע הבא", "חודש הבא", "סבב הבא"). The timeline narrows its days for a long range and drops
  the weekday name below 44 px. On a phone "היום" is an icon with its name in a tooltip.
- **Sort (D-313)**: rows in "סינון ומיון": by name, rank, seniority, unit, days absent or a sortable soldier property;
  ascending or descending; the first row leads and the next break its ties. The table's leave headers keep their own.
- **"Only who is missing"** is a suggestion in the builder and a chip while on (D-213, D-312).
- **Property conditions (D-380, D-382)**: every soldier, unit and leave property is a field of the builder; a unit
  property's name ends in "(של היחידה)". Operators follow the type: text "מכיל", "הוא", "אינו"; numbers add the
  orderings; dates "לפני", "עד", "אחרי", "החל מ"; lists and references any of or none of; all add empty and not empty.
  Text and numbers are typed and written on leaving the field or Enter; a date in a date field. Leave property rows
  come after the leave status and type rows, joined by "וגם", and each is a chip.
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
  and, when some changed, "השתנו מאז: K"; when the rotation covers units outside the reader's view,
  "יחידות מחוץ לתצוגה שלך: K", a count only (D-303). The copy stays one consolidated message. The rotation form takes an optional
  "אחראי דוח 1" from the active soldiers.

## The rotation-centric workspace (V19, D-216 … D-220)

- The workspace opens on the rotation running today, else the next; its window is the whole rotation. No control or
  label names the rotation: the dates say it, and the range menu's "סבב שלם" is a single item or, with more than one
  rotation, a short list by start.
- With no rotation in scope the viewport shows "אין סבב פעיל": "פתיחת סבב" for whoever may create one, otherwise one
  line saying the commander opens it. The dates, view switcher, filters, new-request button, inbox and "my requests"
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
| יציאת סבב | a leave of a type in the built-in "סבב יציאות" group (OI-295) | new (D-345, D-347): the soldiers' ordinary rotation leave, no reason; "הוספת סבב" on the types screen adds "סבב יציאה N" with no form | board, דוח 1, סוגי היעדרות |
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

Replaced by the tab bar and "ניהול" (D-455, D-465, D-468). Kept here for the words and the reasons.

- **Top strip (context):** unit in scope · time (the rotation's name or "שגרה", the range, its arrows, "היום" while
  away from today) · view · filter · sort · avatar. A floating pill that hugs its content, centered at the top.
- **Bottom strip (destinations):** לוח · שלי (who has a soldier record) · בקשות (count awaiting me, who approves) ·
  דוח 1 · ניהול (sum of waiting counts, commanders only), then the role's one primary quick action, a filled round
  button at the strip's inline end: "בקשה חדשה" for who may request while a rotation is current or upcoming, "פתיחת
  סבב" in routine for who may create one, otherwise none (D-266). A floating pill that hugs its content, centered at the
  bottom. The same two pills on a phone, a phone on its side, a tablet and a desktop.
- **The rule (D-256):** one entry per destination, plus one primary quick action per role.
- **Profile (avatar):** name · appearance (light or dark) · install · "התראות" (D-356) · identity switch (local) ·
  sign-out.
- **ניהול יחידה (work, from V32, D-285):** the setup's progress (while unfinished) · אנשים: חיילים, בקשות הצטרפות, הרשאות
  אישיות · נוכחות: דשבורד (who reads a unit, D-349), סבבים, כללי נוכחות · then "הגדרות היחידה". No pins. Setup is laid out in "Work and unit setup"
  below.
- **Home (D-265):** who approves or manages someone lands on the board at their widest scope; everyone else on
  "שלי". One press apart; the last choice is remembered on the device; a link that names a panel or view wins.
- **שלי:** "הסבב שלי" (D-350, D-362), five cards on the actor's current or next rotation · my next days, in or out · my
  requests, open and history, with their status. A new request starts from the strip's quick action.
- **דשבורד (D-349, D-362):** the unit (when more than one), the span and "כולל מתוכנן"; the template (ניהול יציאות,
  תכנון ובקרה, דוח יומי) or the actor's own list; in edit mode add, remove, move up or down, and "חזרה לתבנית". Cards are big
  numbers and CSS charts on theme tokens, each with a hidden table; the heat map copies as text and as an image.
- **עדכונים (D-356):** on שלי, what happened to my requests since I last looked, newest first; the count shows on
  "שלי" until the list is opened.
- **בקשות (the inbox, who approves):** the approve-now switch in its header (who may approve their own) · ממתינות
  לאישורי · closed.
- **Gone:** the separate floating "+" (its action is now in the strip), the "הבקשות שלי" tab, pins, the presence count in the bar, the empty board's second
  button, "סבב חדש" in the range menu, the full-width phone bars and the folded wide-phone row.
- **Focus mode (V23, D-301):** "מצב מיקוד" in the view sheet, or Alt+Shift+F, hides both strips and the chips row; one
  round restore button, "יציאה ממצב מיקוד", stays at the bottom corner on the inline end, clear of the name column. The
  same key, Escape or the button restore them, and focus moves with the change. It lasts the browser session.

### Journeys (D-263)

**Roles (the owner's matrix, D-265).** Plain words; the system stays permission-driven.

| Role | Cares about | Home | Quick action |
|------|-------------|------|--------------|
| Soldier, squad leader | Their own days and requests; opens the app to add or follow a request, or when asked | שלי | "בקשה חדשה" while a rotation is current or upcoming; none in routine |
| Platoon commander, sergeant | The default operators (D-343): the unit's requests, their own included; coordinate and control; may delegate; the sergeant, then an acting deputy, stands in | לוח (their unit) | "בקשה חדשה" in a rotation; "פתיחת סבב" in routine if they may create one |
| Company commander | The plan: sees everything, plans and controls, steps in to coordinate (D-343); rarely approves (HQ's requests) | לוח (the company) | "פתיחת סבב" in routine; "בקשה חדשה" in a rotation |
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
- **A tree as a chart (D-318 … D-320):** a `Segmented` "רשימה" / "תרשים" above the units tree. The chart is a
  scrolling canvas (`h-chart`, `bg-canvas`) with zoom buttons above it; nodes are `chart-node` wide cards joined by
  hairline connectors, each with the list row's dot, name button and `ActionMenu`. The drawer is full width while it
  shows (`useWideDrawer`).
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
- **Archived rows (D-371):** at the end of a list, a closed `Disclosure` "בארכיון" with a count pill, drawn only when
  there are archived rows the actor may restore. Its rows are muted, each with a small "החזרה מהארכיון" `IconButton`;
  a `SmallDialog` names the row and asks once. A refusal says why inside the dialog (an archived or missing reference,
  a taken name or number, a second root). The archive actions themselves stay as they are (OI-297).
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
| `useWideDrawer` | `ui/patterns` | Widens the drawer around its caller to the whole screen from `md` (D-318) |
| `Segmented` | `ui/primitives` | A few ways to show one thing, one always pressed (D-318) |
| `UnitActionsScope`, `UnitChart` | `ui/modules/units` | The units' actions and dialogs, shared by the list and the chart; the chart (D-319, D-320) |
| `EntityForm`, `FailureNotice`, `EmptyNotice`, `LoadingNotice` | `ui/patterns` | The frame and the states of a module |
| `ArchivedSection` | `ui/patterns` | A module's archived rows and their restore (D-371) |
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
