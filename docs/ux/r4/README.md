# Sagol R4: interface redesign (proposal)

Status: proposal. Nothing here is accepted until the owner approves it. No `src/` change (UI freeze, D-333).
Mockup: see the PR description for the link. The mockup's `#rationale` tab is the Hebrew version of this page.

## Problem

Each screen said too much: badges, counters, status icons, colored chips and helper text nobody asked for.
That held in the current UI and in the PR #91 concept. Capabilities were never the problem. Noise was.

## Approach

1. Inventory every capability, per role.
2. Principles and IA.
3. Three directions, each with an independent critique that counted indicators on the commander home:
   A "Today" scored 9, B "Board" about 45 and C "Inbox" 6.
4. The design system.
5. Every main screen, on phone and desktop, with real Hebrew content.
6. An independent overload review of the built mockup, then cuts.

Chosen: **A "Today"**, plus three ideas from C and three from B.
- From C:
  - swipe to approve, with undo;
  - the soldier headline "בבית בעוד N ימים";
  - the "same days" row in the request sheet.
- From B:
  - a rule breach shown as one sentence;
  - a dashed bar for a pending leave, with a day-totals row on the board only;
  - a personal month calendar for the soldier.

## Five hard rules

1. No helper text that was not asked for: a title, a value, an action. An explanation appears only when something breaks a rule.
2. No double indicator. A state shows once, in one place.
3. No badge without an action. A count appears only on something you can tap and resolve, and disappears at zero.
4. What you may not do does not exist (D-076): it is not disabled and not greyed out.
5. One big number per screen. Everything else is regular text.

## Navigation per role

| Role | Destinations | Home |
|---|---|---|
| Soldier | none (single screen) | next leave, my requests, month calendar, "new request" |
| Platoon commander | Today · Board | present count, pending, out, report 1 |
| Company commander / sergeant | Today · Board · Manage | as above, plus one row per unit |
| Admin | Today · Board · Manage (all settings) | as above |
| New user | none | Google sign-in, then join or set up a unit |

- A commander's own requests live under Profile → "My requests".
- On a phone the nav is a glass bar at the bottom. On a desktop it is a rail on the right (RTL).

## Where each capability went

| Before | R4 |
|---|---|
| Dashboard: fairness modules, charts, KPIs | Manage → Round: one "days home" bar per unit or soldier |
| Separate report-1 page: tables, numbers, a status per unit | One button at the end of Today. The report is a plain list of names (present, home, coming in, going out) and is copied in exactly that shape |
| Separate request queue with a counter | The first rows of Today. With no requests there is no section |
| Four board views as visible tabs | Board → one view button (timeline by default) |
| Permanent filter panel | Filter sheet. Active filters show as removable chips |
| Rule gate: banner, icon, color, counter | One sentence: "2 medics would remain in the company. 3 are required." |
| Approve button in every card | Swipe to approve with undo, or the request sheet |
| Internal notes, history | Folded at the bottom of the request sheet |
| Copy to more soldiers, edit | The ⋯ menu in the request sheet |
| Batch request, recurrence | Multi-select "for"; "more options" → repeat |
| Round planner | Manage → Round → plan |
| Join requests | Manage, only while some are waiting |
| Permissions: roles and personal grants | Manage → Permissions (two segments) |
| Structure, types, tags, fields, import | Manage → Settings |
| Appearance, notifications, install, approve instantly, switch account, sign out | Profile (avatar) |

## Design system

- **Color:**
  - a warm paper ground, not white;
  - near-black ink;
  - one action color: deep violet, the product's name;
  - amber only for a rule breach, red only for destructive actions.
- **Character:** a people-management tool, not a "military app". No olive, camo, insignia-like badges or tactical color language.
- **Absence color:** one leave color on the board and the soldier calendar, plus a separate color only for sickness. The type itself is text in the sheet. No colored dots in chips or rows.
- **Type:** IBM Plex Sans Hebrew, with tabular numerals.
- **Icons:** a 1.75 stroke, only in navigation and icon buttons, and every icon has a label.
- **Glass:** kept, but only for surfaces that float over content: the nav bar, sheets, menus and the toast. Cards and rows are opaque so text always reads. There is an opaque fallback without `backdrop-filter`.
- **Theme:** light by default, with dark supported.

## Removed

- Dashboard charts and fairness modules. One bar remains, in Round.
- Colored status badges on rows. "Pending" is one amber word.
- Type icons next to names. A type is text.
- Row descriptions in Manage.
- Old rejected or cancelled requests on the soldier home. They live in History.
- Per-type colors, the check mark on unit rows, and the unit name on every "out" row.

## Overload counts (indicators plus unrequested text lines)

| Screen | Before | R4 |
|---|---|---|
| Company commander home | ~45 | 9 |
| Request approval sheet | ~18 | 3 |
| Soldier home | 7 | 2 |
| Board, two weeks | ~60 | ~30 (bars plus totals row) |

## Proposed decisions (not yet in DECISIONS.md)

- **D-460:** Home for commanders is "Today": the present count, pending requests, who is out, who returns, and report 1. The dashboard is retired; its fairness view moves to Manage → Round.
- **D-461:** Five overload rules (above) are binding on every screen; a review counts indicators per screen before merge.
- **D-462:** Navigation is by role:
  - a soldier gets one screen and no nav;
  - a platoon commander gets Today · Board;
  - managers get Today · Board · Manage.
  - The profile holds personal settings and the commander's own requests.
- **D-463:** Approval by swipe, with a 5-second undo toast. A hard rule breach never approves by swipe; it opens the sheet.
- **D-464:** A rule breach is one sentence under the "same days" line, in amber for a soft breach and red for a hard one, with no banner or icon. It shows only in the request sheet and on the board's totals row.
- **D-465:** Palette, type and icons (a people-management tool, not a military app):
  - a warm paper ground with one violet action color;
  - IBM Plex Sans Hebrew;
  - 1.75-stroke icons only in navigation and icon buttons;
  - one leave color plus one sickness color; no per-type colors.
  - This replaces the previous palette and icon family.
- **D-466:** Glass only on floating surfaces (nav, sheets, menus, toast), with an opaque fallback. Content surfaces are opaque.
- **D-467:** Board has one view control (timeline, calendar, list, table). Filters live in a sheet; active filters show as chips. Pending leaves are dashed bars.
- **D-468:** Report 1 is one action at the end of Today. The report is a list of names grouped as present, home, coming in and going out, with one total, and is copied as the same text. On a multi-day leave the departure day counts as present. A change after confirming asks for reconfirmation.
- **D-469:** Desktop is the same IA with a right-hand rail and two columns. It is not a separate product.

## Proposed open items (not yet in OPEN_ITEMS.md)

- **OI-400:** Theme tokens for the R4 palette in `theme`, light and dark, with contrast checks. Target: the slice after the UI freeze lifts.
- **OI-401:** Today screen (D-460, D-468) replaces the dashboard and the separate report page.
- **OI-402:** Swipe to approve with undo (D-463), including keyboard and screen-reader equivalents.
- **OI-403:** Request sheet: facts, the reason, the "same days" row, the one-sentence rule, and folded history and notes.
- **OI-404:** Role-based navigation and a profile hub (D-462); move personal settings out of Manage.
- **OI-405:** Board: one view control, a filter sheet with chips, dashed pending bars and a totals row (D-467).
- **OI-406:** Soldier home: the headline, requests, the month calendar and new-request sheet.
- **OI-407:** Manage regrouped:
  - soldiers, round and rules at the top;
  - join requests only when present;
  - permissions;
  - settings.
- **OI-408:** e2e and axe coverage for the new flows on phone and desktop, RTL, both themes.
- **OI-409:** Run the overload count (D-461) as a review step in the `/audit` skill.

## Out of scope

- Hour-level leaves (frozen).
- Routine mode (no active deployment).
- All mockup data is fictional.
