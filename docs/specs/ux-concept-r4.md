# UX concept for the design rounds (R4)

A proposal for the owner's review, for ROADMAP row R4 ("Design rounds", M7). Nothing here is decided and nothing
is built. D-333's UI freeze stays in force until the owner approves a concept. R5 then builds the approved parts.
Every "Proposed D-42x" below becomes a real decision only when the owner approves it. The OI-36x below are proposed
open items. Neither is in `DECISIONS.md` or `OPEN_ITEMS.md`.

The owner's brief: make the app the most convenient, intuitive and professional it can be, and keep our design
language: the palette, the icons, the glass, the floating surfaces and the economy of screen space. Keep it
professional and consistent.

**The thesis in one line:** answer first, act second. Every screen opens on the answer its user came for: who is
here today, what waits for me, when I'm going home. The controls come after the answer, small and in the same places.
The language stays as it is: two floating glass pills, the drawer and the sheet, the tokens, Lucide. The proposal adds
no new surface, color or font. It changes order, density and hierarchy.

A phone mockup of the key screens (Hebrew, RTL, the real tokens and icons) is published as a private artifact. The PR
links it.

## 1. Users and their top journeys

The roles are the owner's (D-265, D-343). The system stays permission-driven.

| Role | Opens Sagol to | Frequency | Top journeys |
|---|---|---|---|
| Platoon commander (מ"מ), sergeant | Approve their platoon's requests; control presence; send דוח 1 | Several times a day | **J1** approve the pending; **J2** "who is missing today, and are we above the rule"; **J3** confirm and send דוח 1; **J4** enter a request for a soldier |
| Company commander (מ"פ) | Plan the rotation; check fairness and rule health across platoons | Daily, longer sessions | **J2** at company scope; **J5** plan the coming weeks (timeline, range, filters); **J6** fairness and trends (the dashboard) |
| Soldier, squad leader | Ask for leave; see when they go home | A few times a rotation | **J7** request a leave; **J8** "when am I home next, what's my status" |
| מפל"ג, report owner | דוח 1 every morning | Daily | **J3** |
| Whoever sets up the unit | Setup, roster, rotations, definitions | Rarely | **J9** roster and archive (OI-297); **J10** open a rotation |

J1, J2 and J3 are the product's heartbeat: a platoon commander does them every morning in under a minute, on a phone,
often standing. J5 and J6 are a company commander's desktop sessions. J7 and J8 are rare but come from the most people.
Each must work without learning.

## 2. Current friction, with evidence

The evidence comes from the app as built on `main`. A fresh organization was set up from the company template, with
12 soldiers, one rotation (1–30 Nov) and nine leaves. The screens were captured at 1280×800 (desktop) and on the e2e
mobile device, on 11 Nov 2026.

| # | Where (screen, step) | Friction | Journey hit |
|---|---|---|---|
| F1 | Board, phone, default list view | One row per soldier, about 100 px each. Most rows read "אין בקשות בטווח". On 12 soldiers the phone shows about 6 rows, mostly empty, and the answer ("who is away") is spread across scrolls. | J2 |
| F2 | Board, phone, timeline (picked in the view sheet) | The names column takes about 30% of the width, so days 1–8 show. It opens on the range start, not today (11th), so no bar is in view. The "כללים" row is empty, and rows are about 100 px. | J2, J5 |
| F3 | Board, desktop, month timeline | The bars carry no caption and no icon: the type is color only (cyan חופשה, red גימלים, orange תור רפואי). There is no legend. Pending is a dashed edge and approved is hatched, readable only once learned. There is no daily count and no rule line on the month. The whole bottom half is empty below 13 rows. | J2, J5 |
| F4 | Board, "לוח" tab | The view picker (ציר זמן, לוח שנה, רשימה, טבלה) opens only by tapping the "לוח" tab again while it is active (D-311). Nothing shows that the tab is also a menu. | J5 |
| F5 | Top pill, range label → menu | Seven text items in one list: יום, שבוע, שבועיים, ארבעה שבועות, חודש, "סבב שלם 1–30 בנוב׳", טווח אחר. There is no calendar, so the dates are only in the label. "טווח אחר" opens a separate dialog. | J5 |
| F6 | "סינון ומיון" drawer | A query builder ("+ הוספת סינון", "+ רק מי שחסר", "לפי ותק בסדר יורד", "+ הוספת מיון"). The most common filter, "who is missing", is one shortcut among builder rows. | J2, J5 |
| F7 | דוח 1, phone | The controls come before the answer: the date and arrows, "כמה ימים", an explanatory sentence, the "סיבות" switch, "העתקה" / "הורדת תמונה", "סבבים: סבב נובמבר", "אומתו 0 מתוך 1". Only then the five count tiles, then the unit card with the same five numbers again. Design.md (e) says "counts first"; the built order is not. | J2, J3 |
| F8 | Dashboard (ניהול › נוכחות › דשבורד) | J6's screen sits three levels deep in a management panel, next to "סבבים" and "כללי נוכחות". Its figures (presence, rule health) are J2's answer, yet the board doesn't show them. | J2, J6 |
| F9 | "בקשות" (inbox) | Each row has big "אישור" and "דחייה" buttons, with no sign of what approving does to presence that day. There is no way to approve the five ordinary requests at once. Rule warnings appear only after pressing. | J1 |
| F10 | "בקשה חדשה" form, as a commander | The soldier picker offers soldiers who are not in the rotation on the chosen days. The error ("החייל אינו משובץ בסבב בימים האלה") appears only after "שליחה", on the soldier field (three of nine attempts failed this way). The type labels are long ("יציאות · חופשה"), and the rotation pseudo-type "סבב יציאות · סבב יציאה" sits among the types. An admin action ("+ סוג חדש") sits inside a request form. "חוזרת", "+ בקשה נוספת", "לאשר מיד", "בקשה לכמה חיילים" and "סבבי יציאות" all show at once. | J4, J7 |
| F11 | Leave drawer (a bar's press) | Six action pills in a row (דחייה, פתיחה מחדש, עריכה, העתקה לחיילים נוספים, ביטול הבקשה, and the thread) with equal weight. The destructive "ביטול הבקשה" sits next to "עריכה". | J1, J5 |
| F12 | חיילים list, a row's "…" | "העברה לארכיון" is the menu's only item, one tap from the row (OI-297). | J9 |
| F13 | "שלי", desktop | The "היציאה הבאה" tile overflows its card ("אין יציאה מתוכננת" breaks out of the tile, cut on the side). "הימים הקרובים" lists seven rows that each say "בפנים", 47 px each, to say "you are on base all week". | J8 |
| F14 | Board in routine (no rotation) | A prose band ("שגרה: אין סבב פעיל" plus a sentence), then an empty grid that fills the screen. The next step, "פתיחת סבב", is only the dark round button with no label. | J10 |

**What already works and must stay:** the two floating pills and their stable places (D-252); the hatched hole and
the dashed pending, which carry status by form (D-111, D-290); the drawer for details and the bottom sheet on a phone;
home by permission (D-265); the scope chip; quick entry of soldiers; the quiet saved views (D-387); the today marker.

## 3. Information architecture and navigation

The two pills stay, and no destination is added. The bottom strip keeps four destinations plus the quick action.

```
Top pill (context):   [avatar] [סינון] [‹ range ›] [scope ▾]         unchanged places
Bottom pill (go):     [לוח ▾] [שלי] [בקשות •3] [מצב] [ניהול]  (+)    "דוח 1" becomes "מצב"
```

| Destination | Today | Proposed |
|---|---|---|
| לוח | the board in the chosen view; the view sheet opens on a re-tap | the board, **with a "today" strip on top** (presence now, the rule's state, pending count) for a manager; the tab shows a small "▾" when it is active, so its menu is visible |
| שלי | personal summary tiles and seven "בפנים" rows | **"my next leave" first**, then a 14-day strip, then my requests |
| בקשות | pending and closed, buttons per row | the same hub, **with the presence impact per request** and a bulk approve of what breaks no rule |
| דוח 1 → **מצב** | the day report dialog | one destination with two segments: **"היום"** (today's report, answer first, confirm and send) and **"סבב"** (the dashboard). The dashboard leaves ניהול. |
| ניהול | the nav panel (people, presence, unit settings) | the same panel, without the dashboard |

**Why "מצב" and not a fifth tab.** דוח 1 and the dashboard answer the same question at two time scales: today, and
this rotation. Two tabs would split one question and crowd a phone's pill. One tab with a segmented control keeps the
pill's width, and the name says what it holds. דוח 1 keeps its name inside, as the "היום" segment's title and the
image's title, so its meaning as a military term stays.

**Depth rule.** A daily journey (J1–J3, J7, J8) is at most one press from home to the answer and two to the action.
Today J2 takes three on a phone (open דוח 1, scroll past the controls, read). J6 takes four (ניהול, then נוכחות,
then דשבורד, then scroll).

## 4. Per-screen proposals

### 4.1 Board ("לוח"): the "today" strip (Proposed D-420)

A thin glass card under the top pill, for whoever manages someone else (D-265's rule), on every view:

```
┌───────────────────────────────────────────────┐
│ היום · ד׳ 11 בנוב׳    נוכחים 9/13 · 69%  ✓ 60% │
│ ▸ חסרים 4: נועה כ׳, איתי ב׳, שירה א׳, מאיה פ׳  │
│ ⓘ מחלקה 1: 50% — על הסף             3 ממתינות › │
└───────────────────────────────────────────────┘
```

- **Line one: the number.** Present out of total and the share, then the strictest rule's state ("✓ 60%" in the
  approved tone, "⚠ 58% < 60%" in the rejected tone, with the icon carrying the state, not the color alone).
- **Line two: who.** The absent names, ellipsized, with a press that opens the day's report (מצב › היום).
- **Line three only when there is something:** a unit at or below its rule, and the pending count that leads to בקשות.
- It collapses to line one on scroll. It hides in routine and for a viewer who manages no one.
- It is derived from what the report already computes (`domain` presence), so nothing is stored.

### 4.2 Board: compact rows, labeled bars, a presence row, a legend (Proposed D-424)

- **Phone list:** soldiers with nothing in the range fold into one quiet row at the end of their unit, "8 ללא
  היעדרויות ›", which expands in place. A row is 44 px (the touch token), with the leave chip on the same line as the
  name. On 12 soldiers the whole answer fits one screen.
- **Phone timeline:** it opens scrolled so that today is the second column. The names column is 96 px (first name and
  the family initial, the full name in the row's accessible name). Rows are 36 px with the 44 px target kept by the
  row's full width. The "כללים" row becomes a **presence row**: each day shows the present count on a heat step
  (`heat-1..4`, the dashboard's scale), and a day below a rule gets the rejected-tone edge plus a "!" mark. The row is
  sticky under the day headers.
- **Labeled bars:** a bar wide enough (two days on a phone, one on desktop) shows the type's Lucide icon and short
  name (חופשה, גימלים, קורס) in the body text color. A narrow bar shows the icon only. The hatch and the dashed edge
  stay as they are.
- **Legend:** one line under the top pill, folded into a "מקרא" chip on a phone. It shows the types that appear in
  the range (icon, swatch, name) plus "מאושר" (hatched) and "ממתין" (dashed). Only types present show.
- **Desktop empty space:** the grid ends after the last row, and the space below is canvas, not empty grid cells.

### 4.3 View and filter affordances (Proposed D-425)

- **View:** D-311's sheet stays. The active "לוח" tab gains a small chevron under its icon, so the tab reads as a
  menu. In the sheet the four cards stay, and the saved views stay quiet (D-387).
- **Quick filters:** "סינון ומיון" opens with a row of ready chips before the builder: "רק מי שחסר", "ממתינות",
  "לפי סוג ▾", "לפי מחלקה ▾". A chip toggles at once, and the builder ("+ הוספת סינון", the sort) stays below for the
  rest. The chips row under the top pill (D-213) is unchanged.

### 4.4 Range picker (Proposed D-422, answering R4's range question)

The label in the top pill stays the trigger and the arrows stay. The menu becomes a compact glass popover (a bottom
sheet on a phone):

```
[ יום | שבוע | חודש | סבב ]       ← segmented, the four common spans
  ‹  נובמבר 2026  ›
  א  ב  ג  ד  ה  ו  ש
  1  2  3  4  5  6  7               ← a month grid; the chosen range is a band;
  8  9 10 (11) 12 13 14                the rotation's days carry a faint underline;
 ...                                   today is the circle
 עוד: שבועיים · ארבעה שבועות · טווח אחר
 סבבים: סבב נובמבר 1–30 בנוב׳ ✓
```

- The four segments cover nearly every use. "שבועיים" and "ארבעה שבועות" (D-383) stay one tap away under "עוד".
- **Picking on the grid.** A tap on a day moves the anchor and keeps the span. Two taps (a start, then an end) make a
  custom range, so "טווח אחר" no longer needs its own dialog. It stays as a keyboard path to typed dates
  (accessibility), bounded by `DATE_WINDOW.maxDays`.
- The rotations stay in the picker (D-217, D-339) as a section with their dates.

### 4.5 "מצב" (Proposed D-421, answering R4's dashboard question)

**Segment "היום" (דוח 1), answer first:**

1. The header: "דוח 1 · יום רביעי, 11 בנובמבר" with the arrows and "היום".
2. Five count tiles (סך הכול, נוכחים, חסרים, יוצאים, חוזרים) as one compact row, and the rule line under them.
3. The units, collapsed: name, the counts as "10/13", the confirmation state as a pill ("אומת" in the approved tone,
   "טרם אומת" in the pending tone). The duplicate five numbers inside each unit card go: a unit card shows its own
   absent, leaving and returning names when open.
4. **One action row, at the bottom, inside the thumb's reach:** the primary action is "אימות הדוח" (or "שליחה" once
   all are confirmed, which opens the share), with "העתקה" and "תמונה" as icon buttons and "סיבות" as a switch.
   "כמה ימים" moves into the date's menu.
5. "אומתו 0 מתוך 1" becomes a progress pill in the header.

**Segment "סבב" (the dashboard):** the dashboard as built (D-349, D-362), moved here unchanged except for its order:
the rule health and presence trend first, then fairness (the heat map), then the rest. Its layout preferences
(D-361) are kept. "הסבב שלי" stays on top of "שלי" (D-360). The segment shows only for whoever may open the dashboard
(D-362's `some_unit`), and a viewer without it sees "מצב" with "היום" only and no segmented control.

### 4.6 "בקשות" (Proposed D-427)

- Each pending row: the type icon, the name, "type · dates · N ימים", and **an impact line**: "נוכחות במחלקה 1 ב־13
  בנוב׳: 50% ← 33% ⚠". The line shows only when the request moves a rule's state. Otherwise it is one muted "✓
  בתוך הכללים".
- The rows are grouped by the first day ("השבוע", "שבוע הבא", "בהמשך"), so the next to start are first.
- **Bulk:** "אישור N שבתוך הכללים" at the head of the list approves exactly those whose impact line is ✓, after one
  confirmation that lists their names. A request that breaks a soft rule is never in the bulk; it is approved one by
  one with the acknowledgement (D-145).
- **Row actions:** on a phone, approve and reject become two 44 px icon buttons (✓ and ✕ with accessible names) at
  the row's end. The row's body opens the drawer. A swipe is an extra path, never the only one.

### 4.7 The leave drawer (Proposed D-428)

- **One primary action by state:** pending → "אישור" (for an approver), approved → "עריכה", rejected → "פתיחה
  מחדש". **At most two secondary actions** show as pills ("דחייה", "העתקה לחיילים נוספים"), and the rest go to a
  "…" menu.
- **Destructive actions last:** "ביטול הבקשה" goes at the end of the "…" menu, after a divider, in the rejected
  tone, with a confirmation that names the soldier, the type and the dates.
- The thread ("הערות") becomes a section of the drawer's body, not a pill.

### 4.8 The request form (Proposed D-426)

- **The order is who, what, when, and only what is needed.** For a commander, the soldier comes first. For a
  soldier, it is themselves, shown as a line rather than a field.
- **The soldier picker offers only those in the rotation** on the chosen days. If dates come first, it offers those
  in the rotation on any of them, with a muted "לא בסבב" line under the others, disabled, so a bad pick cannot
  happen. The error after "שליחה" becomes unreachable through the form, while the core still refuses it (rule 4).
- **Type as chips with icons,** grouped under small group headings (יציאות, רפואי, תפקיד, אחר) and showing the
  type's short name ("חופשה", not "יציאות · חופשה"). "סבב יציאה" leaves the type list and stays the mode pill at the
  top ("סבבי יציאות").
- **"+ סוג חדש" leaves the form.** Types are defined in ניהול › הגדרות היחידה. A request never defines a catalog.
- **Inline impact:** under the dates, the same impact line as in בקשות, live, before sending.
- **"עוד אפשרויות" folds** "חוזרת", "+ בקשה נוספת" and "לאשר מיד", collapsed by default. It is opened, and the
  choice remembered on the device, by whoever used one last time.
- The primary action "שליחה" is full width at the bottom of the sheet, in `glass-action`.

### 4.9 "שלי" (Proposed D-429)

- **The answer first:** one card, "היציאה הבאה: ה׳ 12 – א׳ 15 בנוב׳ · חופשה · מאושר", or "אין יציאה מתוכננת" with
  "בקשה חדשה" as its action. The text wraps inside the card (this fixes F13's overflow).
- **A 14-day strip** in place of seven "בפנים" rows: one cell per day, today circled, home days hatched, a
  pending request dashed. That is the board's own language at one row's height.
- Then my requests (pending first) and "הסבב שלי" (the dashboard's personal figures, as built).

### 4.10 Routine and empty states (part of D-429)

- In routine, the board shows one glass card in place of the prose band and the empty grid: "שגרה · אין סבב פעיל",
  then the roster count, then the labeled primary action "פתיחת סבב". D-215's "a title and its action" holds.
- The quick action "+" shows its label on a desktop ("בקשה חדשה" or "פתיחת סבב"), and an accessible name and a
  tooltip on a phone.

### 4.11 Archiving without accidents (Proposed D-423, answering OI-297)

- **Quiet place:** "העברה לארכיון…" is the last item of a row's "…" menu, after a divider, with the Archive icon and
  the muted text tone (not red: archiving hides, it does not delete). A row whose menu has only this item shows its
  ordinary actions too ("עריכה", "פרטים"), so the menu never opens straight onto archiving. On the soldier's own card
  it lives in the card's "…" too, never as a visible button.
- **A confirmation that names it:** a `glass-menu` dialog, titled "להעביר את נועה כהן לארכיון?", listing what it hides
  with numbers: "תוסתר מהלוח, מהדוח ומהבחירה בטפסים · 2 בקשות פתוחות ייסגרו · ההיסטוריה נשמרת". The primary button
  repeats the name ("העברת נועה כהן לארכיון"). The secondary "ביטול" takes the initial focus, so Enter cancels.
- **After:** a toast "נועה כהן הועברה לארכיון", and once OI-104's restore exists for that kind, a "ביטול" in the
  toast that restores it. A unit or a definition shows the same dialog with its own consequences (soldiers under it,
  leaves of the type).

## 5. How each proposal keeps the design language

| Principle | How the proposal keeps it |
|---|---|
| **Palette** | No new color. The tones already mean what they mean: approved, pending, rejected, marker, today. The heat steps (`heat-1..4`) serve the presence row, as in the dashboard. Leave types keep their palette colors, never green (D-290). Status is always carried by form or icon as well (D-111). |
| **Icons** | Lucide only, the ones in use: the type icons (TreePalm, Stethoscope, GraduationCap…) now also appear on bars and chips, plus Archive, Check, X, ChevronDown, Info and AlertTriangle. |
| **Glass** | The same five utilities: `glass-bar` for the two pills, `glass-card` for the today strip and the routine card, `glass-menu` for the range popover and the confirmations, `glass-drawer` for the drawer and sheets, `glass-action` for one primary action per surface. Each keeps its reduced-transparency fallback. |
| **Floating** | The two pills stay floating, content-hugging and centered (D-252). The today strip floats under the top pill as a card, with the canvas around it, not a full-width band. The action row of "מצב" floats over its content. |
| **Economy of space** | The empty rows fold, the rows go from about 100 px to 44 px (36 px on the timeline), the duplicate numbers in דוח 1 go, the "בפנים" list becomes one strip, the six drawer pills become three, the form folds what is rare, and the desktop grid ends with its rows. |
| **Type and sizes** | Heebo and the existing scale only: the strip's number at `text-body` bold, the names at `text-name`, the impact line at `text-micro`. The touch target stays 44 px. |
| **RTL and logical direction** | All the layouts are drawn RTL. Dates and numbers inside Hebrew lines keep their `dir="ltr"` segments. |
| **Data, not prose (D-215)** | The proposal removes the remaining prose (the routine band, the report's explanatory sentence) and adds numbers that say something. |

## 6. Answers to R4's open questions

| R4 question | Recommendation | Why |
|---|---|---|
| **Does the board stay the main screen?** | **Yes**, for whoever manages someone else, with the "today" strip on top (D-420). "שלי" stays home for everyone else (D-265). | The board is the plan and the presence at once. Making a separate home screen would add a step to J5 and split J2 from its evidence. The strip gives J2's answer without leaving the board. |
| **Where does the dashboard live?** | **In "מצב", as the "סבב" segment next to "היום" (דוח 1)** (D-421). It leaves ניהול. Its key figures also feed the board's today strip. | J2 and J6 are one question at two time scales. Today it is four presses deep under a management panel, next to setup screens. The move is a design-round change, not a rebuild (D-360). |
| **Archiving without accidents (OI-297)** | **The last item of "…", after a divider, plus a dialog that names the item and its consequences, with cancel focused; an undo toast once restore exists** (D-423). | It is quiet but findable, and a slip of the finger cannot archive. Naming the consequences ("2 בקשות פתוחות ייסגרו") makes the choice informed. |
| **The range picker's redesign** | **A segmented control of four spans plus a month grid with the rotation underlined; two taps make a custom range** (D-422). | The common spans become one tap; the dates become visible; the custom range stops being a separate dialog. D-383's spans and D-339's rotations stay. |

## 7. What changes and what stays

| Changes | Stays |
|---|---|
| "דוח 1" tab → "מצב" (היום · סבב); the dashboard leaves ניהול | The two floating pills, their places, the scope and range in the top pill |
| A today strip on the board, for managers | Home by permission (D-265) and the saved start view (D-386) |
| Labeled bars, a legend, a sticky presence row, today in view | The hatch for approved, the dashed edge for pending (D-290) |
| Empty rows fold, rows 44/36 px, the grid ends with its rows | The four views and D-311's sheet; saved views quiet (D-387) |
| A visible "▾" on the active לוח tab; quick filter chips | The filter builder and the chips row (D-213) |
| The range popover: segments plus a month grid | The spans (D-383), rotations in the picker (D-217, D-339), the arrows |
| The report answer first; one bottom action row; no duplicate numbers | The report's counts, its confirmations (D-293), the copy and the image |
| Impact per request; bulk approve within the rules | The hub's tabs, the approve-now switch, soft and hard rules (D-145) |
| One primary drawer action; destructive actions last | The drawer, its fields and the thread |
| The request form: who, what, when; members only; chips; inline impact; "עוד אפשרויות" | The form's fields and validation; the server still refuses (rule 4) |
| "+ סוג חדש" leaves the form | Defining types in the unit settings |
| "שלי": the next leave first and a 14-day strip | "הסבב שלי" as built |
| Archiving: last in "…", a naming dialog | Restoring as OI-104 and OI-320 define it |

No table, column or permission changes. Everything new on screen is derived (the strip, the impact line, the presence
row), so nothing is stored (rule 3). The new strings go to `i18n`, and the spans, row heights and the fold threshold
go to `config` and theme tokens (rule 2).

## 8. Proposed decisions (for the owner's approval)

| Proposed | Title |
|---|---|
| D-420 | The board stays the managers' home, with a "today" strip: presence, the rule's state, who's missing, what waits |
| D-421 | "מצב" replaces the "דוח 1" tab: "היום" (the day report, answer first) and "סבב" (the dashboard, moved from ניהול) |
| D-422 | The range picker: four spans in a segmented control, a month grid with the rotation, two taps for a custom range |
| D-423 | Archiving: the last item of "…" after a divider, a dialog naming the item and its consequences, cancel focused |
| D-424 | A compact board: folded empty rows, 44/36 px rows, labeled bars with icons, a sticky presence row, a legend, today in view |
| D-425 | Visible affordances: a chevron on the active לוח tab; quick filter chips above the builder |
| D-426 | The request form: who, what, when; only rotation members; type chips; inline impact; rare options folded; no catalog action |
| D-427 | The inbox: an impact line per request, grouped by start, bulk approve of what stays within the rules |
| D-428 | The drawer's action hierarchy: one primary by state, two secondary, destructive last behind "…" with a confirmation |
| D-429 | "שלי" and routine: the answer first (the next leave; "פתיחת סבב"), a 14-day strip, the prose band and empty grid replaced |

## 9. Proposed open items

| Proposed | Target | Item |
|---|---|---|
| OI-360 | R5 | "שלי" on a desktop: the "היציאה הבאה" tile's text overflows its card (F13). It is a defect under D-333's fix rule, and it can be fixed before R5 without a redesign. |
| OI-361 | R5 | The request form offers soldiers not in the rotation, and the refusal shows only after sending (F10). The domain already knows the membership; the form should read it. |
| OI-362 | R5 | Opening `/?panel=dashboard` on a phone showed the board, not the dashboard. To check: is the panel name different, or does the phone drop it? A link that names a panel should win (D-265). |
| OI-363 | R5 | Measure the daily journeys before and after R5: presses and seconds to J1, J2 and J3 on the mobile e2e device, as an e2e journey with step counts. Then R5 can show it improved them. |

## 10. A phased plan for R5

Each phase is one slice with its own branch, plan, e2e journeys and visual check on desktop, mobile and RTL, and
axe stays clean. The order puts the daily value and the least risk first.

| Phase | Content | Value | Risk |
|---|---|---|---|
| **R5.1 Quiet fixes** | OI-360, OI-361; D-423 (archiving); D-428 (drawer hierarchy); the request form's "+ סוג חדש" out (part of D-426) | Removes accidents and dead ends | Low: small, local |
| **R5.2 The answer first** | D-421 (מצב: היום answer first, the dashboard moved); D-420 (the today strip) | J2 and J3 in one press; the commander's morning | Medium: the bottom strip changes; e2e journeys (e) and the dashboard's update |
| **R5.3 The compact board** | D-424 (folding, row heights, labels, presence row, legend, today in view); D-425 (view chevron, quick filters) | The board readable on a phone, J2 and J5 | Medium: the board's rendering; visual regression across four views |
| **R5.4 Requests** | D-427 (impact, grouping, bulk); the rest of D-426 (the form) | J1 and J4, J7 faster and safer | Medium: the bulk needs the soft-rule logic per request, already in `domain` |
| **R5.5 The range and "שלי"** | D-422 (the range popover); D-429 ("שלי", routine) | J5 and J8 | Low-medium |

Each phase ends with the owner's look at the deployed preview before the next starts. A phase the owner rejects is
dropped without blocking the others: none depends on another, except that R5.2's strip reads the same presence that
R5.3's row shows (built once in R5.2).

## Assumptions (D-170)

- D-333 is lifted for R5 only after the owner approves this concept, and only for the screens approved.
- "מצב" is a working name. "תמונת מצב" was renamed "דשבורד" by the owner, so the tab avoids that phrase and uses the
  plain word.
- The bulk approve is safe because it takes only requests that move no rule's state, and it is one confirmed
  action, not an automatic one.
- The phone figures (rows on screen, presses) come from the mobile e2e device. A real device differs a little and
  the proportions hold.
