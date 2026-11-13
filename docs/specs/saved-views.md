# Spec — Saved views

Status: proposed, not scheduled. The slice gets its V-number, and P-n get D-numbers, when it starts.
Context: both. Approved by the owner on 2026-11-13 with a condition (D-170, recorded as decided): it sits in a
very central place but is a niche feature, so it must not burden or complicate simple everyday use. It stays
quiet by default (P-6): no new persistent control in the top strip or the chips row; it is reached only from
inside the existing view sheet; and nothing of it shows until a view has been saved, except one quiet action.

#### Vnn — Saved views
**Owner sees:** nothing new on the board. Inside the existing view sheet (D-311), one quiet action row,
"שמירת התצוגה הנוכחית", beside focus mode: the current unit, rules, sorts, board conditions, view, bar colors and
range kind get a name. Only once a view exists does the sheet gain a "התצוגות שלי" row of cards; one press brings
the board back to that state, on any device the soldier signs in on. One of them may be "תצוגת פתיחה", which a
bare app open uses instead of the default.
- **contracts:** `SavedView`, `SavedViewQuery`; `SoldierPreferences` gains `saved_views` and
  `start_view_id` (P-1). No table, no column.
- **config:** `SAVED_VIEWS` (`max` 12, `nameMax` 40); the list of search params a saved view keeps (P-2).
- **domain:** none (pure parsing is logic's view state).
- **data:** none new: `accounts.updateMyPreferences` writes the list. One added validation: names unique per
  soldier (issue `duplicate_item`, existing).
- **logic:** `captureView(searchParams) → SavedViewQuery`; `applyView(query, context) → { params, dropped }`;
  `useSavedViews()` (list, save, rename, reorder, delete, set start view), optimistic with rollback;
  "is the board showing a saved view" (`matchingView`, derived).
- **ui + i18n:** in the view sheet only: the save action row, the cards row (once a view exists), the save
  dialog, the manage list (rename, reorder, delete, start view). No control in the top strip, the tab bar or the
  chips row (P-6).
- **logic + ui (home):** the start view applies on a bare `/` open of the board, inside `useHome` /
  `HomeLanding` (D-265 home still decides board or שלי first). `app` is unchanged.
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

**Save** — in the view sheet, an action row "שמירת התצוגה הנוכחית" in the same style as focus mode, the
sheet's last controls (shown when the board differs from every saved view, i.e. `matchingView` is NULL; nothing
in "סינון ומיון" changes). Dialog: "שם התצוגה" (prefilled with a suggestion from the unit and
the first rule, e.g. "מחלקה 2 · רק מי שחסר"), checkbox "לפתוח את האפליקציה בתצוגה הזאת", "שמירה". At the max:
the action shows the hint "אפשר לשמור עד 12 תצוגות" and opens the manage list instead.

**Open** — once at least one view is saved, the view sheet (D-311) gets a first row "התצוגות שלי" (with no
saved view the row does not exist, D-076): one card per saved view (name, the view
icon, a line like "שבוע · 3 תנאים"); the start view has a small "פתיחה" mark. Press: `applyView` → the board state is
replaced in the current history entry (D-332: filter, sort and view changes replace; only overlays push) → the
sheet closes, which pops its own overlay entry (`useOverlayEntry`), so back then leaves the board as it would
after any filter change. If parts were dropped:
toast "חלק מהתנאים בתצוגה כבר לא קיימים" with "עדכון התצוגה" (re-saves the cleaned query).

**Current** — when the board's state equals a saved view (`matchingView`), that view's card is marked as
selected inside the sheet, and only there: no chip, no title and no badge on the board (P-6). After a change
that leaves a view, the sheet offers "שמירת השינויים" beside the save action (overwrite the view that matched
before the change).

**Manage** — from the cards row, "ניהול התצוגות": a list with rename (inline), move up/down, delete (confirm),
and "תצוגת פתיחה" (radio, with "ללא" first). Deleting the start view clears it.

**Start view** — on a bare open of `/` that lands on the board (D-265), with no view-state params, the app
replaces the URL with the start view's params (replace, not push). A link with params always wins.

## Hebrew wording

| Where | Text |
|---|---|
| Save action | שמירת התצוגה הנוכחית |
| Overwrite | שמירת השינויים |
| Dialog title | תצוגה חדשה |
| Name field | שם התצוגה |
| Start checkbox | לפתוח את האפליקציה בתצוגה הזאת |
| Sheet row | התצוגות שלי |
| Card meta | {range} · {count} תנאים (one: תנאי אחד) |
| Start mark | פתיחה |
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
  changes everything, opens "בוקר" from the view sheet: the board, chips and URL match; the history length
  did not grow (D-332).
- Reload at `/`: the board opens on "בוקר". A link with `?view=calendar` opens the calendar instead.
- Rename, reorder and delete in the manage list; deleting the start view, then `/` opens the default.
- A soldier landing on שלי sees no saved-view control anywhere.
- Quiet by default (P-6): with no saved view, the board, the top strip and the chips row are identical to
  today (snapshot of the top strip), and the view sheet adds only the save row; the cards row appears after
  the first save, inside the sheet only.
- Mobile sheet, RTL, axe on the sheet row, the dialog and the manage list.

## Proposed decisions

- **P-1** Saved views are personal and live in `soldier_preferences.preferences` (`saved_views`,
  `start_view_id`), so they follow the soldier across devices; no table. Shared unit views are a later
  feature with its own table and permission.
- **P-2** A view stores raw search-param strings for view, filter, sorts, table sort, board conditions, colors
  and the range kind; never a date, a rotation id, a panel or a draft. It is relative to the day it opens.
- **P-3** Applying a view replaces the board's history entry, like any filter or sort change (D-332); the start
  view replaces a bare `/` of the board only, and any link with params wins.
- **P-4** A part of a view that no longer parses is dropped and reported, never a failure; the soldier may
  re-save the cleaned view.
- **P-5** At most 12 views, names unique per soldier, at most 40 characters (config).
- **P-6** Quiet by default (owner, 2026-11-13): the feature lives only inside the view sheet. It adds no
  persistent control to the top strip, the tab bar or the chips row; before the first save it is one action row;
  the cards row and the current-view mark exist only once a view is saved, and only in the sheet.

## Integration map

**Where it lives.** Personal preferences, not a module. Contracts in `src/contracts/settings/index.ts`
(`SoldierPreferences`); the param list in `src/config/url/index.ts` next to `SEARCH_PARAMS`; capture, apply and
match in `src/logic/view-state/` (a new `savedViews.ts` beside `search.ts`, `filter.ts`, `sort-rules.ts`); the
save action row, the cards row and the manage list in `src/ui/shell/ViewSheet.tsx` (the save row beside the focus
mode action, same `ACTION` style); `RuleBuilder` and `FilterBar` are unchanged (P-6).

**Reuse.**
- URL state: `WorkspaceSearch` and `useChangeSearch` (`src/logic/view-state/search.ts`) apply a view exactly like
  a link; `readRules`/`writeRules` (`filter.ts`) and `isDefaultSort` (`sort-rules.ts`) are the only parsers, so
  P-4's "dropped" is what they already reject.
- Persistence: `useMyPreferences`/`useUpdateMyPreferences` (`src/logic/session/preferences.ts`) and the
  `updateMyPreferences` command (`src/data/local/accounts.ts:251`); version check and `stale_version` exist.
- Devices: `AVAILABLE_VIEWS`/`DEFAULT_VIEW_BY_DEVICE` (`src/config/views/index.ts`) decide the fallback view.

**Genuinely new.** `captureView`/`applyView`/`matchingView` (pure, logic) and the save row, cards and manage UI in the view
sheet. No `Drawer` change, no table, no data command.

**Entry points.** Commander and unit manager: the view sheet (BoardTab in `src/ui/shell/TabBar.tsx`) and "סינון
ומיון". Soldier with only שלי: none (D-076, D-265). Start view: `useHome` (`src/logic/home/hooks.ts`) and
`HomeLanding` (`src/ui/shell/HomeLanding.tsx`), not `app`.

**Indicators.** Only the "פתיחה" mark and the selected card, both inside the sheet. Nothing on the board (P-6).

**Effects.**
- History: P-3 follows D-332 (replace); the sheet's back is `useOverlayEntry` (`history.ts`).
- Rules/heat row, דוח 1, rotations V26/V31: untouched; a view with range "rotation" resolves through the same
  default range code as a bare link.
- Focus mode (`src/ui/shell/focusMode.ts`) stays a device session key, outside views.
- Permissions V10: no new resource; reads stay policy-scoped.
- Import/export V12: preferences are not exported today; unchanged.
- PWA/offline: the write needs the server (OI-116 state).
- Local/remote parity: the same `accounts.ts` core on both (D-008); test both adapters' `stale_version` retry.
- Test: the round trip per view, D-332 history length, the device fallback, the dropped-rule toast.

**Rules.** Logic owns parsing (no UI-to-UI talk; ViewSheet calls logic hooks); limits in
config; strings in i18n; the server's contract parse is the validation.

## Dependencies

None.

## Assumptions

- Views are personal; shared unit views are not wanted yet.
- The save action sits in the view sheet, not in "סינון ומיון", so the whole feature is one place (P-6).
- A view is relative to the day it opens (never a fixed date range).
- Twelve is enough; the start view applies only to a bare `/` open.
