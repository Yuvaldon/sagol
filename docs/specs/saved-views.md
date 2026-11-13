# Spec — Saved views

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both. Rank 3 of the Later items (see `README.md`).

#### Vnn — Saved views
**Owner sees:** in "סינון ומיון", "שמירה כתצוגה": the current unit, rules, sorts, board conditions, view, bar
colors and range kind get a name. The saved views are cards at the top of the view sheet (D-311); one press
brings the board back to that state, on any device the soldier signs in on. One of them may be "תצוגת פתיחה",
which a bare app open uses instead of the default.
- **contracts:** `SavedView`, `SavedViewQuery`; `SoldierPreferences` gains `saved_views` and
  `start_view_id` (P-1). No table, no column.
- **config:** `SAVED_VIEWS` (`max` 12, `nameMax` 40); the list of search params a saved view keeps (P-2).
- **domain:** none (pure parsing is logic's view state).
- **data:** none new: `accounts.updateMyPreferences` writes the list. One added validation: names unique per
  soldier (issue `duplicate_item`, existing).
- **logic:** `captureView(searchParams) → SavedViewQuery`; `applyView(query, context) → { params, dropped }`;
  `useSavedViews()` (list, save, rename, reorder, delete, set start view), optimistic with rollback;
  "is the board showing a saved view" (`matchingView`, derived).
- **ui + i18n:** cards row in the view sheet; save dialog; manage list (rename, reorder, delete, start view);
  the matching view's name in the board's tab tooltip and in the filter chips row.
- **app:** the start view applies on a bare `/` open of the board (D-265 home still decides board or שלי first).
- **Open items:** none.
- **Decisions:** D-008, D-017, D-019, D-025, D-036, D-038, D-044, D-045, D-046, D-068, D-074, D-075, D-076;
  D-023, D-041, D-103, D-132, D-133, D-197, D-211, D-213, D-265, D-311, D-312, D-313, D-326, D-332.

## User stories

- Company commander: "Every morning I look at 'platoon 2, only who is missing, this week, by unit then rank'.
  I want that in one press, not six."
- Platoon commander: "On my phone and on the office computer I want the same views."
- Sergeant: "I keep a 'drivers' view: tag נהג, list view, today. And a 'next rotation' view: the whole rotation
  range, calendar."
- Commander: "When I open the app, I want my morning view, not the default."
- Soldier with only שלי: nothing changes; the feature is not shown (no board, no views).

## What a view holds (P-2)

| Kept | Search param | Notes |
|---|---|---|
| view | `view` | dropped if the device does not offer it (D-290): falls back to the default view |
| unit + rules | `filter` | the whole expression (D-312, D-326); the unit is part of it |
| sorts | `sorts` | ordered (D-313) |
| table sort | `sort`, `order` | only when `view` is the table |
| board conditions | `leaves`, `missing` | D-132, D-133 |
| bar colors | `colors` | D-112 |
| range kind | `range` | day, week, month or rotation, **without** the anchor |

Not kept: `from`, `to`, `rotation`, `day`, `until`, `panel`, `entity`, `parent`, `draft`. A view is relative
to the day it is opened: "week" is this week; "rotation" is the rotation the board would open on (the mode
rotation of D-257, else the default range). A view never opens a panel.

## Data model (proposed diff, not applied)

No SQL change. Comment in `schema.sql`:

```diff
 "preferences" JSONB NOT NULL DEFAULT '{}',  -- validated by contracts SoldierPreferences:
                                             -- create_leaves_as_approved (D-121),
                                             -- appearance (D-181);
+                                            -- saved_views, start_view_id (P-1);
```

Contracts (`settings`):

```ts
SavedViewId = z.uuid().brand('SavedViewId')
SavedViewQuery = z.record(z.enum(SAVED_VIEW_PARAMS), z.string().max(4000))   // raw param strings, parsed on apply
SavedView = z.object({ id: SavedViewId, name: label(SAVED_VIEWS.nameMax), query: SavedViewQuery })
SoldierPreferences += {
  saved_views: z.array(SavedView).max(SAVED_VIEWS.max).default([]),
  start_view_id: SavedViewId.nullable().default(null),
}
```

- The query stores the URL strings, not parsed objects, so a saved view and a shared link are the same thing
  and the URL parsers stay the only parser (D-023). On read, an unknown param name is dropped by the contract.
- `start_view_id` pointing to a deleted view reads as NULL (refine on parse, never a failure).
- Size: 12 × ~4 kB at most; the row stays far below any limit.

## Permissions

- Saved views are the soldier's own preferences: no permission resource, like `updateMyPreferences` today.
- A view holds no data and grants nothing. Applying it goes through the same URL state as a link, so every
  read is still scoped by the policy: a view with a unit the soldier can no longer see is handled exactly like a link
  to that unit, and the dropped unit is reported as in P-4.
- The feature is shown only to who lands on or may open the board (D-265's "manages someone else"). A soldier
  without a board never sees the controls (D-076).

## Server commands

None new. `accounts.updateMyPreferences({ expected_version, preferences })` carries the whole preferences
object. Logic always writes from the freshly read row plus the one change, and on `stale_version` re-reads and
re-applies the change once (the other device's edit survives). Validation on the server is the contract parse:
max count, name length, unique names (`duplicate_item`, path `saved_views[i].name`), param values of at most
4000 characters.

## Screens and flows

**Save** — "סינון ומיון" (D-312), footer action "שמירה כתצוגה" (shown when the board differs from every
saved view, i.e. `matchingView` is NULL). Dialog: "שם התצוגה" (prefilled with a suggestion from the unit and
the first rule, e.g. "מחלקה 2 · רק מי שחסר"), checkbox "לפתוח את האפליקציה בתצוגה הזאת", "שמירה". At the max:
the action shows the hint "אפשר לשמור עד 12 תצוגות" and opens the manage list instead.

**Open** — the view sheet (D-311) gets a first row "התצוגות שלי": one card per saved view (name, the view
icon, a line like "שבוע · 3 תנאים"); the start view has a small "פתיחה" mark. Press: `applyView` → one
history entry (push, D-332, so back returns to the previous board state) → sheet closes. If parts were dropped:
toast "חלק מהתנאים בתצוגה כבר לא קיימים" with "עדכון התצוגה" (re-saves the cleaned query).

**Current** — when the board's state equals a saved view (`matchingView`), its name shows at the start of the
chips row ("תצוגה: בוקר") and in the board tab's label for assistive tech. Any change to filter or sort makes it
fall away; "שמירת השינויים" then appears next to "שמירה כתצוגה" (overwrite the matching-before-change view).

**Manage** — from the cards row, "ניהול התצוגות": a list with rename (inline), move up/down, delete (confirm),
and "תצוגת פתיחה" (radio, with "ללא" first). Deleting the start view clears it.

**Start view** — on a bare open of `/` that lands on the board (D-265), with no view-state params, the app
replaces the URL with the start view's params (replace, not push). A link with params always wins.

## Hebrew wording

| Where | Text |
|---|---|
| Save action | שמירה כתצוגה |
| Overwrite | שמירת השינויים |
| Dialog title | תצוגה חדשה |
| Name field | שם התצוגה |
| Start checkbox | לפתוח את האפליקציה בתצוגה הזאת |
| Sheet row | התצוגות שלי |
| Card meta | {range} · {count} תנאים (one: תנאי אחד) |
| Start mark | פתיחה |
| Current chip | תצוגה: {name} |
| Manage | ניהול התצוגות |
| Start radio | תצוגת פתיחה · ללא |
| Rename / Delete | שינוי שם · מחיקה |
| Delete confirm | למחוק את התצוגה "{name}"? |
| Max hint | אפשר לשמור עד {max} תצוגות |
| Dropped toast | חלק מהתנאים בתצוגה כבר לא קיימים |
| Toast action | עדכון התצוגה |
| Duplicate name | כבר יש תצוגה בשם הזה |
| Saved toast | התצוגה נשמרה |

## Edge cases

- A rule names a tag, property, option or unit since archived or deleted: `applyView` drops that rule (the
  parsers already reject unknown ids) and reports it; the rest applies.
- The table view saved on desktop, opened on a phone that does not offer it (D-290): the default view, plus the
  rest; no toast (it is the device, not the view).
- Range "rotation" with no rotation (routine): the default range, as a bare link would.
- Two devices save at once: the second write gets `stale_version`, re-reads and appends; both views exist. Same
  name on both: the second is refused with "כבר יש תצוגה בשם הזה" and the dialog stays open.
- An unknown param in stored JSON (a later version wrote it, or an older one is read): dropped on read.
- Offline (OI-116): the preferences write needs the server; the save action shows the existing offline state.
- The soldier loses their board permission: the views stay stored, the controls disappear; regaining it shows
  them again (nothing derived is stored).
- Focus mode (D-301) and the device store (D-197) are not part of a view.

## Acceptance tests

Unit:
- `captureView` keeps exactly the P-2 params and drops `from`, `rotation`, `panel` and the rest.
- `applyView`: round trip with `captureView` for each view, range kind and sort; archived tag rule dropped and
  reported; device without the table view; rotation range in routine.
- `matchingView`: equal after apply; not equal after any filter, sort or condition change; insensitive to
  param order and to `from`.
- Contract: max 12, name length, unique names, unknown param dropped, dangling `start_view_id` reads NULL.
- `useSavedViews`: optimistic save, rollback on failure, one retry on `stale_version` keeping the other edit.

e2e:
- Commander builds unit + rule + two sorts + "only who is missing", saves "בוקר" with the start checkbox,
  changes everything, opens "בוקר" from the view sheet: the board, chips and URL match; back restores the
  previous state.
- Reload at `/`: the board opens on "בוקר". A link with `?view=calendar` opens the calendar instead.
- Rename, reorder and delete in the manage list; deleting the start view, then `/` opens the default.
- A soldier landing on שלי sees no saved-view control anywhere.
- Mobile sheet, RTL, axe on the sheet row, the dialog and the manage list.

## Proposed decisions

- **P-1** Saved views are personal and live in `soldier_preferences.preferences` (`saved_views`,
  `start_view_id`), so they follow the soldier across devices; no table. Shared unit views are a later
  feature with its own table and permission.
- **P-2** A view stores raw search-param strings for view, filter, sorts, table sort, board conditions, colors
  and the range kind; never a date, a rotation id, a panel or a draft. It is relative to the day it opens.
- **P-3** Applying a view is one pushed history entry; the start view replaces a bare `/` of the board only, and
  any link with params wins.
- **P-4** A part of a view that no longer parses is dropped and reported, never a failure; the soldier may
  re-save the cleaned view.
- **P-5** At most 12 views, names unique per soldier, at most 40 characters (config).
