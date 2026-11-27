# New interface (roadmap R4 + R5): working notes

The owner's handoff package for the new interface is in this folder, as received. These notes hold what was learned
before any code was written, so the work continues from here. Delete this file when R5 is done: by then its content
lives in `docs/Design.md`, `docs/DECISIONS.md` and `docs/OPEN_ITEMS.md`.

## The request

Plan and document the new interface comprehensively (by the project's rules), build all of it, and get it to the
staging deploy so the owner can test. Some component images are older than others; the text wins.

## Status

- Done: the docs batch. The guide is "The new interface" in `docs/Design.md` (tokens, components, the image table,
  navigation, tap paths, states, desktop, accessibility, the list of own decisions). Decisions D-453 … D-464.
  Roadmap rows R5·1 … R5·6. Open items re-targeted; OI-384 and OI-385 opened.
- Done: R5·1, the shell, and most of R5·2, "היום" (D-465 … D-471). The tab bar by permission, "היום" with both
  open blocks and its request cards and page, "ניהול" and "אני" as pages, the shared components in `src/ui/kit`.
- Next: the rest of R5·2 (OI-387, OI-388, OI-390, OI-392), then R5·3, the board, with the options menu (OI-386).
  One roadmap row per pull request (D-464).
- For the owner: OI-393 ("איתך היום" has nobody to show to as decided), with OI-384.
- Code facts checked: rule archive and restore exist, no reorder; nobody edits their own soldier record; presence
  and the day report take any date; the leave form's live rule warning needs organization-wide reads (D-162);
  `missing` is used in `config/url`, `contracts/settings`, `logic/view-state`, `logic/board`, `ui/board`,
  `ui/shell` (FilterBar, RuleBuilder, builderOpen) and the dictionary.

## How the package is read

- Authority: `03-board-spec.md`, then `02-design-decisions.md`, then `01-handoff-package.md`, then the images.
- Fully current images: the four `screens/לוח – טלפון – *` and `design-language/07`. In every other image these
  shared parts are outdated:
  - Tab bar: no "+" in the middle. Commanders: Today, Board, Manage, Me. Others: Today, Me. Icons house, timeline,
    clipboard-check, person, size 26, no labels. Active tab: a glass capsule behind a night-blue icon, not a dot.
    A separate night-blue glass action circle, on Today only, at the bar's left end, opens a leave request for me.
  - Commander block: compact only (unit name, fraction at 48, seven day columns with today first and emphasized and
    amber below the threshold, the "דוח 1" button). No presence bar, forecast or expanded chart.
  - "X מתוך Y" is the fraction `{n}/{total}`: numerator big and bold, denominator small and gray, both amber below
    the threshold. "חזר/יצא היום" is "חוזר היום/יוצא היום". An amber dot is an amber number or an amber cell.
  - Sort, group and filter chips are one floating options menu: rows with the current value ("מיון · ותק ›"),
    choices open inside the same menu with a back arrow; a night-blue dot on the capsule's icon and a bold value
    when not default.
  - The person card's "יציאה עבורו" button is gone: days are picked in its 14-day strip, then a tray.
  - The soldier's expanded calendar is the Board's month component.
- Expected process (01): a design guide in the project and a table of image to the screen it replaces; build in
  batches (foundation and navigation shell first, then one main screen at a time), each batch to staging; keep a
  list of every own decision and every deviation from a mockup, for the owner's review.
- Derive ourselves: empty, loading and error states; sign-in and onboarding; desktop (tab bar to side rail, drawer
  to side panel, Manage as list plus content, rows to a table, Board as a wide timeline plus side panel, Today and
  Me as a centered column). Phone only except the Board. Hour-level leave stays frozen. What is not in v1 does not
  appear. Differences are by permission, never by role name.
- Open questions of 01 §7, to decide and record (D-170): what stays out of v1 and whether the undesigned Manage rows
  (leave-round planning, temporary units, rotation details, switch to routine, settings) keep their MVP screens;
  "איתך היום" for soldiers; timeline drag on a phone; whether rule archiving exists; the "possible code changes" of
  02 are not for v1; which fields a soldier edits alone; the unit drawer on a future day.
- Code changes 03 asks for: remove "only missing" (`missing`), the phone's default view becomes `calendar`
  (`DEFAULT_VIEW_BY_DEVICE` in `src/config/views`), verify the rules warning for a platoon-scoped commander.

## What the outdated images still tell (beyond the text)

- Me: the name as the page title, bell top-left; unit row with pencil and chevron; tag chips; "מספר אישי" and
  "טלפון" with copy icons; cards "הסבב שלי" (status line and 14-day strip) and "הבקשות שלי" (rows with status
  badges, "כל הבקשות ‹"); row "העדפות ‹". Expanded: "פרטים" and "שדות נוספים" as label and value rows on the
  background. Edit: pencil becomes ✕ and a filled night-blue ✓; tags get "×" and a dashed "+"; editable fields turn
  into white inputs, the rest stay text.
- My rotation page: three big numbers (days on base, days home, approved requests), a month with page dots, week
  rows of continuous segments, a legend ("בבסיס / סבב יציאות / בקשה / ממתינה").
- Preferences: "מראה" segmented (בהיר / כהה / לפי המכשיר); "התראות" card; "חשבון" card (signed-in address, install);
  "התנתקות" as a centered text button. Approvers also get "עבודה".
- All requests: segmented "פתוחות" / "היסטוריה"; card rows of type, dates and length, status badge.
- Manage: title and unit, rows with value and chevron ("חיילים 16", "בקשות הצטרפות" with an amber count, "כללי
  נוכחות · 2 פעילים", ...), then "הגדרות" after a gap.
- Soldiers: back, title, glass capsule (search, options, add); one white card of rows: name, small role and tags,
  seven dots (filled on base, hollow away, today first and larger). Multi-select: circle checkboxes, a tray instead
  of the tab bar ("N נבחרו", "יציאה", "תגיות", "העברה").
- Add soldiers: full screen, no tab bar; "ליחידה X ⌄"; "הדבקת רשימה", "ייבוא מקובץ"; rows of first name, last name,
  personal number, email; a full-width bottom button.
- Join: capsule "✓ אישור N"; sections "מוכנות לאישור" and "דורשות בדיקה" (amber chips "פרט שונה", "כמה מועמדים");
  for a company commander a dashed "מחלקה ⌄" chip per row. Drawers: new soldier ("יצירה וקישור", "עוד"), "זה הוא?"
  with the differing detail in an amber block ("כן, לקשר" / "לא"), "מי מהם?" with radio rows ("לקשר" / "אף אחד").
- Availability rules: sections by unit; rows of name, the rule as a sentence, a toggle; "לא חל" chip; an inherited
  rule has no toggle. Drawers: details (sentence as chips, pencil and "⋯"), edit and new (sentence as editable
  chips, dashed "+ ..." chips, "לא לאפשר חריגה", "עוד ⌄"), archive.
- Drawers: new leave ("יציאה חדשה", type chips, "סיבה", "שליחה"), leave card (status badge, "עריכה", "ביטול
  הבקשה"), report 1 ("בבסיס · N", "לא בבסיס · N"), unit drawer (same two lists).

## The current code, where the new interface lands

- One workspace route (`src/app/router`), all view state in URL search params (`src/config/url`): `view`, `day`,
  `range/from/to`, `sorts`, `group`, `filter`, `panel`, `entity`, `missing`, ...
- Shell: `src/ui/shell/WorkspaceScreen.tsx` (top context strip, bottom destination strip, `Viewport`,
  `ModuleDrawer`), `TabBar.tsx`, `moduleEntries.ts` (entries by access), `HomeLanding.tsx`, `NavigationPanel.tsx`.
  Modules open as panels (`PANEL_IDS` in `src/config/panels`) inside `ModuleDrawer`.
- Engines: `src/ui/engines/{calendar,list,timeline,table}` behind `registry`; `VIEW_IDS` in `src/config/views`.
- Theme: `src/ui/theme/tailwind.css` holds only semantic tokens (Stone 3, D-077) with a dark set (D-181). New
  values and new tokens go there; a dark set for the new palette has to be derived.
- `logic` already exposes most of what the screens need (`useMyRotation`, `useMyLeaves`, `usePendingRequests`,
  `usePresence`, `useDayReport`, `useAvailabilityRulesWithArchived`, `usePendingLinkRequests`, `useBoard`, ...).
- The e2e suite (about 36 specs) drives the current shell; each replaced screen needs its specs updated.

## Getting to staging

`vercel.json` builds only `staging` and `production`. `.github/workflows/staging.yml` runs after CI succeeds on a
push to `main` and moves `staging` to main's tree. So a batch reaches staging by a pull request merged into main
on green CI. `e2e` and `db` jobs are skipped on draft pull requests (D-289): mark it ready before merging.
Production is manual and the owner's only (D-340).

## Roadmap and open items

- Rows R4 "Design rounds" and R5 "Building the design" in `docs/ROADMAP.md`. D-333 is the UI freeze this ends.
- Open items targeted here: OI-297, OI-381 (R4); OI-310, OI-311, OI-380, OI-382 (R5).

## Tokens of the new language (from 01 and 02)

Primary `#2B3A55`, primary-soft `#E3E8F0`, on-primary-soft `#1E2A40`; background `#F2F1EE`, surface `#FFFFFF`,
surface-subtle `#F7F6F3`, fill-muted `#ECEAE5`; ink `#1B1A1F`, ink-2 `#5C5A63`, ink-3 `#8E8A97`, past `#9A97A0`;
divider `#F0EEEA`, divider-strong `#E4E2DD`, border `#D9D6CF`, toggle-off `#C9C6BF`. Pending `#F8EDD5` / `#7A4F0B`
/ border `#D39A2C` (threshold cell `#FBF4E4`); ok `#E1F0EA` / `#1E6B52`; rejected `#F7E3E0` / `#9B2C24`; error
`#8E2C22`. Time: on base `#3A3743`, leave round `rgba(139,136,146,.28)`, approved request `#C9C5BC`, pending fill
`#F6E4C2`. Type: Heebo 48/28/17/15/13 (12 for captions), weights 400 to 700. Radius: card 20 to 22, control 16 to
18, chip 12 to 14, glass full. Spacing 2, 4, 6, 8, 10, 12, 16; side margin 16; row 44. Motion: tap 120 ms, ui
200 ms, drawer 280 ms, `cubic-bezier(.2,.8,.2,1)`; reduced motion crossfades; skeletons, not spinners. Glass and
shadow values are in 01.

## Plan

1. Docs commit: the design guide in `docs/Design.md` (tokens, components, navigation, screens, motion,
   accessibility, desktop), the image-to-screen table, decisions from D-453 (the concept, the end of D-333, each
   open question), the list of own decisions and deviations, roadmap and open items.
2. Foundation: tokens, glass primitives, the tab bar and shell, drawer with stops, fraction, 14-day strip and month
   components, toast with undo, options menu.
3. Then one screen per batch: Today, Board (calendar, timeline, movements), Manage and its pages, Me, the shared
   drawers; desktop adaptations. One layer per commit; `npm run check`, `npm run build`, `npm run e2e` green.
