# Sagol — Board Spec

The latest decisions (26.11). This file adds to `02-design-decisions.md`. Where an item is marked **Supersedes**, it wins over `02` and over older mockups.

**Visual source:**
- `screens/לוח – טלפון – *.png`: one interactive Board screen, opened on each view.
- `design-language/07 רכיבים משותפים · ניווט, מספרים וזמן.png` (Shared components · navigation, numbers and time): bottom navigation, number format, the commander block, and the three time components.

Mockup data is sample data: Platoon 2, 16 soldiers, today is Thursday 26.11, threshold 50%. One leave-round leave was moved in the field: יובל מור, from 26–28 to 23–25.

---

## 1. New system-wide principles

1. **No "+" in the tab bar.** **Supersedes** "'+' = create" and the tab-bar structure in `02`.
   - **Commanders:** Today, Board, Manage, Me.
   - **Soldier and squad commander:** Today, Me.
   - **On Today only, for all users:** a separate glass circle on the same line as the bar, at its left end. It opens "בקשת יציאה" (Leave request) for myself directly. Other screens have no circle, and the bar is full width.
2. **Create from context.** All other creation happens on the object itself: select days, then a tray appears.
   - **Personal calendar:** tap days.
   - **Board calendar:** long-press a day starts a selection. Tray: "יציאה לחיילים · N ימים" (Leave for soldiers · N days).
   - **Timeline:** tap days in a person's row. Tray: "יציאה עבור X · N ימים" (Leave for X · N days).
   - **Person card:** the 14-day strip.
   - **Availability rule and new soldier:** the add icon in the capsule of the matching Manage page.
3. **Active tab:** a subtle glass capsule behind the icon, and the icon in night blue. **Supersedes** the dot under the icon.
4. **The tab bar collapses on scroll.** Scrolling down hides it; scrolling up, or reaching the top, brings it back. 280ms. Anything floating above it (tray, toast) moves down with it.
5. **Two page-header types:**
   - **A list that starts at the top** (Soldiers, Timeline): the title sits on the background. On scroll it shrinks into the center capsule, and the corner buttons shrink.
   - **A view that scrolls in both directions** (Movements): a fixed header. The title is the month of what's at the top, and the blur band is always on.
6. **Drawers drag freely** up and down, in every drawer, as far as the content justifies.
7. **Tapping empty space closes any open menu or action:** fan, floating menu, options, and empty search.
8. **Numbers as a fraction:** `{n}/{total}`. The numerator is large and bold, the denominator small and gray. Below threshold, both are amber. **Supersedes** "X מתוך Y" (X of Y) everywhere.
9. **Threshold: one indicator per place.**
   - **Month cell:** soft amber background.
   - **Number:** amber.
   - **No amber dot anymore,** anywhere.
   - **No threshold marking on the timeline.**
   - **At the moment of decision** (a selection tray, or a request revealed by swipe) an impact line appears: `יום {day} · {n}/{total}` (Day {day} · {n}/{total}). It appears only when the action would push a day below the threshold.
10. **Only three time components.** Every time display is built from one of them:
    - **Person bar:** continuous bars with a hairline between days.
      - On base: dark `#3A3743`.
      - Leave round: translucent gray `rgba(139,136,146,.28)`.
      - Approved request: `#C9C5BC`, with an icon per type and no text.
      - Pending request: amber `#F6E4C2` with a `#D39A2C` border.
    - **Day strip:**
      - Today: night-blue circle.
      - Selected day: outline.
      - Past days: fixed gray `#9A97A0`, not opacity.
    - **Month cell** (One UI 9.5 style, no border per cell):
      - Requests: a bar with icon and first name, up to 3 bars, then "+N".
      - Below threshold: amber background.
      - Selected day: night-blue outline.
      - **The leave round is not shown in the month.** It is the normal state; someone is always home.
11. **Present-tense wording:** "יוצא היום" (Leaving today), "חוזר היום" (Returning today). **Supersedes** "יצא היום" / "חזר היום" in the unit drawer.
12. **View options: one mechanism** for every list and view. **Supersedes** the chip groups on the Soldiers screen.
    - **A floating menu with rows,** each showing the current value: "מיון · ותק ›" (Sort · Seniority), "קיבוץ · ללא ›" (Group · None), "סינון · ללא ›" (Filter · None).
    - **Tapping a row opens its choices inside the same menu,** with a back arrow.
    - **When anything differs from the default,** the capsule icon gets a night-blue dot, and the value in its row is bold.
13. **Platoon and company commander open block: compact only.** **Supersedes** their expanded state, and the forecast line and presence bar in compact state.
    - **Content:** unit name, the fraction (48), and 7 small columns for the coming days. The first column is today, emphasized; a day below threshold is amber. Then "דוח 1".
    - **The fraction** opens the unit drawer. For the company commander it has a tab per unit.
    - **A column** opens the Board on that day, at the middle stop.
    - **The expanded state** remains only for soldier and squad commander (personal calendar).
14. **"Who's with me" at the center on the "now" screens:** Today, unit drawer and Report 1. On the Board, a planning tool, what's missing is the point.
15. **No "leave-round groups" in the UI.** A leave round is the starting point of each soldier's leaves, and each leave moves on its own. The UI shows people and leaves.
    - **Groups exist only in the leave-round planning flow.**
    - **Everywhere else,** when leave-round leaves are grouped into one row, the grouping is computed by day: "whose round leave starts today", "who is home today", or "who returns today". Never by group.
    - **Grouped row:** "סבב יציאות" (Leave round) and the number of people; expands to names. **With one person only,** show a normal row: name, and "סבב יציאות" as the type.
    - **The distinction between leave round and request stays:** a request is an exception and stands out; the leave round is quiet.

## 2. Board: the frame

- **Header:**
  - **The title is always the month name,** in every view (in Calendar: the month shown). "לוח" (Board) never appears as a title.
  - **On the left, a glass capsule with two tools:** view switcher (fan) and options. **No search on the Board.** To see one soldier, filter by soldier.
  - **"היום" (Today):** a small capsule that appears only when you've moved away from today. In Movements it appears when today is off screen.
- **Fan:** behavior as already decided (`02`). Long-press opens saved views.
- **Options:** sort, group and filter per principle 12. At the bottom, after a divider: "מיקוד" (Focus).
- **Focus:** hides the tab bar and the header. A small capsule remains in the center with the month or range; tapping it exits focus. Rotating the phone to landscape enters focus automatically. Stored locally on the device only.
- **One selected day,** shared by all views. It carries over when switching view.
- **The range is set by the view.** No general range picker.

## 3. The views

### Calendar — where the gaps are
- **The month grid fills the full height** above the drawer. Weekday names at 13, bold.
- **In a cell:** requests only, and an amber background when the day is below threshold. The leave round is not shown.
- **Tap a day:** selects it. A second tap on the same day opens the drawer to the middle stop.
  - **A day from another month** (in the margins) moves the Board to that month; the title changes.
- **Long-press a day:** starts a range selection. Tapping another day sets the range; tapping the same day again cancels. Tray: "יציאה לחיילים · N ימים".
- **Horizontal swipe:** move between months. Not implemented in the mockup.
- **Selected-day drawer, three stops:**
  - **Edge:** handle, the selected day ("26 · חמישי · היום" — 26 · Thursday · today, in November), and the fraction "9/16 ›", which opens the unit drawer.
  - **Middle:** the month shrinks to 40px rows, no text in bars, and the drawer opens below it.
  - **Full:** the drawer almost to the header.
  - **Moving between stops:** drag up and down on the month, on the drawer header, or on the list when it's at its top. Tapping the handle advances one stop.
  - **Drawer content:** every leave that applies to the selected day.
    - **Leave round, per principle 15:** a row for who leaves today (with "יוצאים היום"), a row for who is home, and a row for who returns today (with "חוזרים היום").
    - A request is a row with name and type. "יוצא היום" or "חוזר היום" only when that is the case.
    - A pending request has an amber outline. Swipe reveals ✓ and ✗, plus an impact line if needed.

### Timeline — who won't be here
- **A row per person,** for the week of the selected day. The day strip is fixed under the title; rows scroll under it.
- **The leave round** is part of each person's row, so a moved leave appears in its new place.
- **Tap a day header:** selects it and opens the unit drawer for that day.
- **Tap days in a person's row:** selection, then a tray with an impact line.
- **A person's name** opens the person card; **a bar** opens the leave card.
- **Pinch:** changes range between week, month and rotation. Also from the floating menu, which also holds the custom range. Not implemented in the mockup.
- **Sort:** seniority (default), name, or days away (`absent`). Sorting by days away replaces what used to be the "People" view.
- **Group:**
  - None (default for one unit), unit (default for several units), command rank, or a tag category.
  - Grouping by tags only for a single-select category.
  - Each group has a header with a count.
- **No summary row and no threshold marking.**

### Movements — what's changing
- **Continuous scroll in both directions,** snapping to a day. Always opens on today.
- **Day header** (on the background): "ה׳ 26.11". Today has a "היום" tag. Tapping the header opens the unit drawer.
- **A card per day, two parts:** "יוצאים" (Leaving), then "חוזרים" (Returning) — a quiet subheading without a count.
  - **In a row:** name and type only, no dates.
  - **Leave round:** one row per direction on that day, per principle 15. A soldier who moved their round leave appears on the new day, alone.
- **A run of empty days:** one dashed line, "אין תנועה · 21–22.11" (No movement · 21–22.11). Today always appears, even when empty.
- **Pending request:** swipe reveals ✓ and ✗, then a toast with "ביטול" (Undo).

## 4. Mapping to code (per the Board code summary)

| In the UI | In code |
|---|---|
| Calendar | `view=calendar` |
| Timeline | `view=timeline` |
| Movements | `view=list` (row = day) |
| Table | `view=table`: desktop only |
| Selected day | `day` |
| Range per view | `range`, `from`, `to`. In the UI: month; week, month or rotation; and custom range |
| Sort | `sorts`: existing keys |
| Filter | `filter`: existing structure. The editor recognizes two shapes only, which is enough for now |
| Group | **New:** a parameter that doesn't exist yet |
| Threshold impact | The rules' response on a leave action |
| Threshold marking in the month | The heat row |

- **A pending request does not reduce the count.** Availability is computed only from approved leaves. Do not change this.
- **Phone default view:** Calendar. The code currently opens on `list`.
- **Layers:** a leave with `batch_id` is leave round; everything else is a request. `batch_id` is used **only** for type and color. Never group by it in the UI (principle 15).

## 5. Required code changes

1. **Group as a view option:** a URL parameter, also stored in saved views. Values: none, unit, command rank, single-select tag category. Default by number of units.
2. **Remove "only missing"** (`missing`). It has no place in the UI.
3. **Phone default view:** `calendar`.
4. **Verify:** that the rules warning is available to a platoon commander whose permissions cover only the platoon. Without it the impact line won't appear for them. (Already an open question in `02`.)

## 6. Strings (for the strings file)

| Key | Copy |
|---|---|
| fraction | `{n}/{total}` |
| threshold_impact | `יום {day} · {n}/{total}` |
| leaving_today / returning_today | יוצא היום / חוזר היום (plural: יוצאים היום / חוזרים היום) |
| movements_out / movements_back | יוצאים / חוזרים |
| rotation | סבב יציאות |
| no_movement | אין תנועה · {range} |
| day_no_leaves | אין יציאות ביום הזה |
| tray_leave_soldiers | יציאה לחיילים · {n} ימים (one day: יום אחד) |
| tray_leave_for | יציאה עבור {name} · {n} ימים |
| pending | ממתינה |
| toast_approved / toast_rejected | אושרה · {name} / נדחתה · {name} |
| options_sort / group / filter / focus | מיון / קיבוץ / סינון / מיקוד |
| empty_value | ללא |

## 7. Impact on existing screens

The mockups of these screens were drawn before this spec. Build them with these changes:
- **Today:** tab bar without "+", plus the action circle. Platoon and company commander block per principle 13 (source: `design-language/07`).
- **Soldier's block:** no request button. The expanded calendar moves to the uniform month component, with the personal status as a bar.
- **Unit drawer:** "יוצא היום" and "חוזר היום" in the present tense, and a fraction in the header.
- **Manage → Soldiers:** view options per principle 12, instead of the chips.
- **Person card:** the 14-day strip in continuous bars. Selecting days in it opens "יציאה עבורו" (Leave for him) instead of a button.
- **All screens:** the tab bar collapses on scroll, and tapping empty space closes.
- **Anywhere showing a leave-round "group":** per principle 15. Exception: leave-round planning.

## 8. Open

- **Desktop:** a wide timeline as the main view, and a side panel. Not designed yet.
- **The content of each filter condition in the editor** (field, operator by type, value). The mechanism is agreed; the layout isn't.
- **Saved views:** the list opened by long-press on the fan. Not designed yet.
- **Swipe between months and weeks, and pinch:** agreed, not implemented in the mockup.
