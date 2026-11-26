# Sagol — Design Decisions

The written record of every design rule and screen decision. Organized by scope:

- **System-wide** — applies everywhere.
- **Screen** — applies to one screen or flow.
- **Card bank**, **Field facts**, **Under discussion**, **Possible code changes** — context, not build instructions.

Terms and on-screen strings are defined in the glossary in `01-handoff-package.md` (§9). Hebrew in quotes is exact UI copy.

**`03-board-spec.md` is newer.** Items it supersedes are marked here with **[Superseded → 03 §x]**. Follow `03` for those.

---

## Working order (context)

- **The rotation interface comes first.** Routine mode will be designed separately, once its capabilities are defined.
- **Touch points between routine and rotation:**
  - When there is no active rotation, a user allowed to open one sees a list of past rotations and can open a new one. The rest is defined when routine mode is designed.
  - Switching to routine and back to the rotation happens from **Manage**. While in routine mode during an active rotation, a persistent indicator with "חזרה לסבב" (Back to rotation) appears at the top of the screen, next to the bell.
- **The rotation-opening flow** will be designed later. It does not depend on other screens.
- **Phone first.** Only phone screens are designed now. Desktop is a single conversion pass at the end:
  - Bottom tab bar → side rail.
  - Drawer → side panel.
  - Rows → table, where appropriate.
  - Unit tree: indented list → hierarchical diagram.
- **Division of work with the build agent.**
  - **Decided here:** what appears, where, for whom and why — structure, hierarchy, behavior, deliberate exceptions, non-obvious placement.
  - **The build agent completes:**
    - The full list of actions on each object, from the code and permissions.
    - Visual polish, real data, edge cases.
    - Gestures and animations according to the rules.
  - **If something is not settled:** flag it as a question. Do not invent.
  - **Do not change backend code for a one-off UI detail.** Whatever a mockup expresses that can be built on existing capabilities is completed when wiring the screen.
- **Seven-step plan** (from shared to specific, simple to complex):
  1. **Block structure** — done: card template, open-block template, the open block per persona.
  2. **Me** — done.
  3. **Manage and Settings** — in progress. Done: Soldiers, Join requests (structure and rows).
  4. **Leave-round planning** — done when there is a full flow from opening to saving.
  5. **Board** — define what each view gives, then design.
  6. **Back to Today** — assemble it from the card bank and fix what broke.
  7. **Desktop conversion.**
- **Cards are recorded with their source and designed at the end.** For each screen we note what should reach Today, for whom and when, in the card bank below. Cards are not designed alongside the screen. In step 6 all cards are generated together from the card template so they are consistent. Existing Today cards are not patched.
- **A new idea mid-step does not change direction.** It is logged under "Under discussion" and revisited in the matching step.

---

## System-wide

### Color = meaning
- Primary: night blue `#2B3A55` on warm gray background `#F2F1EE`. Used only for the primary action, selection and the active screen/tab.
- Green = approved / OK. Amber = pending / soft rule. Red = rejected / hard rule. Status colors are muted.
- Everything else is ink color (text and data).

### Copy and explanation
- **Minimal text.** Icon instead of text where possible. Icon-only is allowed only for familiar actions: search, notifications, approve, reject, close, edit (pencil), copy.
- **Icon button over text button** when a universal icon exists (e.g. a pencil in the block corner, no background). Text button only when there is no such icon (e.g. "דוח 1").
- **No explanations in the UI.** Screens never contain text describing how the interface works or what was decided. Needing one means the design is not clear enough yet.
- **The user's language, not our internal language.**
  - Write "דוח 1", not "send to the responsible officer".
  - Never explain how the system routed something to the user (e.g. "no platoon match").
  - **Don't show the obvious.** A marker true for every row on a screen says nothing — e.g. a "new soldier" chip on every row of the company commander's join-request list.
- **Uniform phrasing, not a sentence per case.** When the UI shows a reason or status from the system, the server returns a code only. The UI renders all codes with the same template, e.g. "{field} שונה מהכרטיס" ({field} differs from the card). Strings live in one strings file, never in logic.
- **An edge case gets a path, not a shortcut.** The system lets users resolve it with existing tools, no dedicated capability. Example: a mismatched personal number in a join request — the commander checks with the soldier, approves, and fixes the person card if needed.
- **Page title: one line, size 28.** Never shrink or wrap it. If it doesn't fit, choose a shorter name (e.g. "הצטרפות"). Ellipsis only as a fallback.

### One fact = one indicator
- Never show the same information twice on one screen.
  - A status label next to a button that does the same thing is redundant. Either the label is the button, or there is no label.
  - A broken rule is marked where the data itself is shown, not in a separate card.
  - The same component may appear in two destinations at different depth, e.g. the personal calendar in Today and in My rotation.

### Every indicator is a door
- Anything that summarizes something opens its detail:
  - A person's name opens the person card.
  - A unit opens a drawer with its people.
  - A rule marker opens rule details, and from there, via "⋯", the rule's definition.
- **The goal is fewer doors, not more.** No indicator without a way to reach what it indicates; no indicator and button that do the same thing. Add a door only when it has context.

### Open block and card
One component, two surfaces. Border = tappable. Source artboard: "מבנה בלוק · תבנית" (Block structure · template), page "שפת עיצוב" (Design language).
- **Open block:** the state or context of the screen. No border, edge to edge; the block itself is not tappable. Parts: title (optional), figure at sizes 48 and 28, context line, explicit actions (button, menu or name). Only the actions are tappable.
- **Card:** a summary of something that lives elsewhere. White, inset from the edges; the whole card is tappable and opens the source. Parts: title (always same place and size), "⋯" (only if permitted), figure (free area), rows (optional), at most one primary action.
- Height follows content. A card with no rows and no action is correspondingly small.

### Today structure
- **One open block per user, always at the top, followed only by cards.** No mixing. The open block answers the question the user opened the app for: soldier and squad commander — "where am I"; platoon commander — "how many are with me"; company commander — "the company today".
- **Today answers two questions:** what's the situation now (open block) and what's waiting for me (cards). No cards = nothing is waiting for you. It is not a notification feed; notifications are in the bell.
- **Feed without section headers.** Cards stand alone; each carries its own title.
- **Today = now and forward.** Past items (e.g. a request approved in the past) move to Me.

### Compact and expanded, in place
Any block or card where relevant has a compact state and an expanded state opened with a chevron, to avoid unnecessary screen transitions. Navigating to a dedicated screen remains only for full management and viewing.
- **Compact focuses on today.** Only it shows actions that refer to today, e.g. "דוח 1".
- **Expanded looks ahead, no per-day actions.** Tapping a day shows its data; the big number stays today's.
- **Collapsing returns to today** and to the current month.

### After an action, the indicator shrinks
A completed action frees its space and leaves a minimal indicator in a consistent place, e.g. "✓ 08:12" after sending Report 1. The indicator still opens what was sent.

### Top corners and floating layer
- **The top corner holds the current screen's actions.** Main screens (Today, Manage, Me): the bell. Inner page: no bell — a round back button on the right, and on the left a single glass capsule with the page tools (e.g. search, options, add, "אישור N" (Approve N)). Search expands from its icon into a full-width field with ✕. **Exception: Board** — no bell; its header is defined separately.
- **Top capsule vs bottom tray are different things.** The capsule acts on the whole page (e.g. "אישור 4" approves all ready items). The "N נבחרו" (N selected) tray at the bottom acts only on what was selected via long-press.
- **Tapping empty space closes** a floating menu, floating list, or empty search. A search with text stays open (to keep results) and closes with ✕.
- **On scroll, top-corner buttons stay floating in place.**
  - **Center "where am I" capsule:** when the title scrolls up, it collapses with a short animation into a glass capsule in the center, between back and tools. With grouping it shows the current group and its count ("מחלקה 1 · 30"); without grouping, the page name ("חיילים · 16"). Group headers inside the list are not sticky.
  - **The capsule is a door:** with grouping, tap opens a floating menu of all groups with counts; choosing one scrolls to it. Without grouping, tap returns to the top of the list.
  - **On scroll the whole top floating layer shrinks** to capsule height (36 instead of 44) with a soft 200ms transition. Hit area stays 44. Back at the top, buttons return to normal size.
  - **Top blur while scrolling:** a subtle fading blur band, ~70px, only when scrolled, so floating buttons stay legible without a bar.
- **No top bar when not needed** (like the tab bar, which only contains existing tabs). Currently, for everyone, there is only a floating glass circle with the bell in the top-left corner. The date sits on the background, as a quiet line at the top of the open block, level with the bell.

### Scope and relevance
- **One level down.** Each commander sees and hears only about the level directly below, plus feedback on actions they performed.
  - The company commander does not receive requests or notifications for the whole company.
  - A card or row the user can do nothing with does not appear.
- **Order by frequency.** In every menu and screen, what's used more appears first and more prominently. Marginal actions get less visual weight.
- **"Who's with me today" at the center.** Everywhere, show who is present first. Absentees go in a secondary layer, when something is needed from them.
- **The platoon is the everyday unit.** Default for every user except HQ and the company commander is their own platoon. The view can be widened to the whole company.
- **A platoon commander is a full commander, one level below the company commander.** The difference is only defaults and load: they see their own soldiers by default, not everything unrelated to them.
- **No squad split by default.** People lists show as one platoon list. "קיבוץ" (Group by) is available: by squad or by tag (e.g. medic, driver).
- **Default list order:** commanders pinned at top by command rank, everyone else below by name.

### Lists of people
- **Named list: each person appears once.** Someone returning today appears under "בבסיס" (On base) with a "חוזר היום" (Returning today) tag. Someone leaving today appears under "לא בבסיס" (Not on base) with "יוצא היום" (Leaving today). (Present tense per 03 §1.11.)
- **Person row:** dense row, height 44: name, role or tag, and 7 dots at the end. **Every people list uses the same row**, even when the secondary content differs (e.g. personal number in the join-request list).
  - First dot = today, emphasized. Then the next 6 days.
  - Filled dot = on base; hollow = home.
- **Free-text components** (e.g. reason) grow with content.

### Action placement
- Every action the user is permitted on an object appears in that object's drawer or card. One primary action is visible; the rest are behind "⋯".
- What is forbidden does not appear at all.
- The full action list is derived by the build agent from the code. Here we define only exceptions and placement.

### Icons
- Thin, soft line (1.7), rounded corners.
- There is an "options" icon (sliders) for view options, and a "settings" icon (gear).
- Leaving and returning have no icon. Show a number and a word.
- **Day strip:** today is marked with a night-blue circle with a white numeral, wherever a day strip appears.

### Presence and leaves on a timeline
**[Superseded → 03 §1.10]** Three time components with exact colors; the leave round is not shown in month cells. The text below is the earlier version.
- Presence: a continuous dark bar with thin dividers between days.
- Leave round: an outlined bar only.
- Request: a filled bar with icon and type name. A pending request gets an amber outline.
- A request falling inside a leave-round period is shown inside its bar.
- Monthly calendar uses the same language, as the date's background: dark bar with white numeral = on base, outline = leave round, amber = request. Past days are dimmed.

### Glass (inspired by Apple Liquid Glass)
Used only in the floating layer: bars, menus, drawers, floating buttons. Content cards are white and opaque. Two kinds:
- **Clear:** 14% white, 30px blur, boosted saturation, thin light edge, soft shadow.
  - For the bell circle, tab bar, floating buttons, and fan. These carry only icons and bold text.
  - Also for the drawer, at 22% white, because there is a dim layer beneath it.
- **Regular:** ~60% white, stronger blur. For floating menus, toasts, selection tray, search results.
- Never glass on glass.
- Respect the device "Reduce transparency" setting.

### Tab bar
**[Superseded → 03 §1.1, §1.3, §1.4]** No "+" in the bar; active tab is a glass capsule behind the icon; the bar collapses on scroll. The icon set below still applies.
- Icons only, size 26, no labels. Active tab: night blue ~~plus a small dot under the icon~~ (see 03 §1.3).
- Fixed icons:
  - Today: house.
  - Board: timeline. Does not change per view.
  - Manage: clipboard with check.
  - Me: figure, no profile circle.
- **Commanders (platoon commander and up):** Today, Board, +, Manage, Me. Same bar for all; content by permission.
- **Soldier and squad commander:** Today, +, Me.
- **Tab meaning is identical for all personas.** Only content changes, by permission.
  - **Today:** what's the situation and what's waiting for me. For commanders it includes what needs their action: requests, join requests, Report 1, rules.
  - **Board:** the picture of the force and control over it, in all views. Exists only for those who manage a force (platoon commander and up).
  - **Manage:** what changes during the rotation. Exists for every commander; content by permission.
  - **Me:** personal things over time: my requests (including past), My rotation, preferences, notifications.

### "+" = create
**[Superseded → 03 §1.1–1.2]** No "+" button. Today has an action circle for a leave request for myself; everything else is created in context (day selection → tray, or the add icon in the matching Manage page). The order-by-frequency facts below remain context.
- Soldier: the button opens a leave request directly.
- Squad commander and up: opens a small menu by permission, ordered by frequency:
  - Commander: "יציאה לעצמי" (Leave for myself), "כלל נוכחות" (Availability rule), "יציאה לחיילים" (Leave for soldiers). "חייל חדש" (New soldier) at the bottom, smaller.
  - Squad commander: leave for myself, leave for soldiers.
- "Leave for soldiers" is one action; choose one soldier or several.
- Leave round is not in "+".
- "+" is the main creation path. Contextual shortcuts are allowed, e.g. selecting days in the calendar.

### Toolbox
Every component has a usage rule. Source artboard: "ארגז הכלים" (Toolbox), page "שפת עיצוב".
- **Minimum screen transitions.** Actions open in a drawer (phone) or side panel (desktop). After approve/reject, a toast with "ביטול" (Undo).
- Drawer on phone, side panel on desktop, for any action or detail on an item. No drawer on drawer.
- Floating menu for a short choice, up to 7 options.
- Confirmation dialog only for irreversible actions (e.g. rejecting a join request). Then no Undo in the toast.
- Toast with Undo after every reversible action.
- Only one floating action button: the action circle on Today (03 §1.1).
- No breadcrumbs. Command search only later.

### Type and imagery
- **Font: Heebo.** Size scale: 48, 28, 17, 15, 13.
- **No profile circles.** There are and will be no photos of people, so no avatar circles or initials.

### Gestures and motion
Source artboard: "מחוות ותנועה" (Gestures and motion), page "שפת עיצוב". Applies to every component on every screen.
- **Everything tappable responds immediately:** button shrinks slightly, row gets a background, tab responds in its icon, toggle and segmented control slide.
- **Duration:** 120ms tap, 200ms menu and row, 280ms drawer and day change.
- **Easing:** fast in, slows at the end. Anything dragged by finger behaves like a gentle spring.
- **Direction:** motion comes from the action's origin; what closes returns to its origin.
- **Reduce motion:** users with Reduce Motion get only a short crossfade.
- **Haptics** (supported devices only): light for selection, medium for approve/reject, double for a hard-rule block.
- **Fixed gestures** (one gesture = one meaning everywhere):
  - Long-press a row: multi-select.
  - Long-press a button: secondary options.
  - Swipe a request row: reveals approve and reject. Actions exist only on the swiped row, not under every row.
  - Horizontal swipe on content: move in time (between days; in the calendar, between months).
  - Pinch on the timeline: change range.
  - Drag a drawer: change height. Pull down closes.
  - Tap the active tab: back to top and to today.
  - Drag in the unit tree: reorder.
- **No per-row action buttons in lists.** Quick actions are revealed by swipe.
- **Every drag has a non-drag alternative** (see `01-handoff-package.md` §1).

### Three layers per feature
Source artboard: "שלוש שכבות לכל פיצ'ר" (Three layers per feature), page "שפת עיצוב".
- **Definition:** what exists in the system. Touched rarely; lives in Settings.
- **Assignment:** who gets what. Medium frequency; lives on the object itself — person card, leave card, or a bulk action on several people.
- **Use:** where the feature has effect. Daily work; lives in the everyday UI: Today, Board, filters, person row.
- **Two deciding factors:** how often it changes, and whether it concerns the rotation, routine, or both.
- **Exception:** a definition that changes occasionally according to field conditions lives in Manage, not Settings. This applies to availability rules and temporary units.
- **Rarely-used flexibility is hidden.** E.g. free tag categories: the template ships with "צבאיות" (Military) and "אזרחיות" (Civilian); editing beyond that is one level deeper.

### Placement map (where each capability lives)
Source artboard: "מפת המיקום" (Placement map), page "שפת עיצוב".
- **4 destinations (own screens):** Today, Board, Me, Manage.
- **Manage:** what changes during the rotation. Content by permission:
  - Soldiers: all their soldiers, regardless of presence. Add and quick entry.
  - Join requests.
  - Availability rules.
  - Temporary unit.
  - Leave-round planning.
  - Rotation details (dates, participants, Report 1 owner, closing): only for whoever opened the rotation or has permission.
  - Switch to routine.
- **Settings:** separate from Manage. Holds the definition layer of every feature; available in both rotation and routine. Entered from a "הגדרות" (Settings) row at the bottom of Manage, like "העדפות" (Preferences) in Me.
- **Temporary full screen, for processes:** leave-round planning, rotation opening, org and template setup, import, join.
- **Large capabilities living inside screens, opening in a drawer or panel:** leave card, new leave, request approval, Report 1, person card, unit drawer, bulk action on people, notifications, join requests.
- **Floating menu:** filter, sort, range, saved views.
- **Search:** a layer above the screen.
- **Rule violations:** no container of their own. They appear as a marker and warning inside other containers.
- **Personal:** personal preferences in Me.
- **Updates:** bell in a floating circle for everyone. No separate updates tab.
- Between users only the set of Today cards changes. The capability itself always lives in the same place and form.

### Phone and desktop
- In the field people work almost only on the phone, so the commander's phone holds all daily work, including cross-unit control and the Board.
- Every action is possible on the phone. The device changes only how accessible it is.
- Desktop is used mainly for pre-rotation planning.
- Soldiers work only on the phone.

### The rotation is transparent
When a rotation is active it is the world the system lives in; don't show it or its name. The rotation list appears only:
- To whoever opened the rotation, or the system admin, when switching to routine mode.
- To a soldier, after the rotation closes, as a summary of their activity in it.

### Terminology
Use terms in current use: "סבב" for the service period (rotation) and "סבב יציאות" for the alternating leave schedule (leave round). "סבב יציאות" always appears in full.

---

## Screen

### Concept of each screen
- **Today:** one open block, then a feed of cards. Cards appear and disappear according to what's happening now and to permissions.
- **Me:** a personal area built of cards, in the same language as Today. Difference: cards here are fixed and in fixed order, so the user knows where everything is.
- **Board:** one frame (bar, fan, range, filter) with several views, each with its own character. The most complex screen.
- **Manage:** source artboard "ניהול · טלפון" (Manage · phone), page "שפת עיצוב". Title "ניהול" (28) on the bell line, the unit below it. No open block — it is an index of tools. Thin rows by frequency; each row ends with a number or live status (e.g. "בקשות הצטרפות · 3" in amber when action is waiting). Below, in a separate quieter group: "יציאה לשגרה" (Switch to routine) and "הגדרות" (Settings). One screen for all commanders; rows by permission.
- **Manage and Settings:** a list of thin items. Each opens its own page with a slide, with back to Manage. No accordion, since each item is a full list or tool. Desktop: list on the side, content beside it. "Minimum screen transitions" applies to actions, not to this navigation.

### Today — open block
Source: the three artboards "בלוק פתוח · ..." (Open block · ...), page "שפת עיצוב".
- **Soldier and squad commander:**
  - "בבסיס" (On base) or "בבית" (Home), and a context line such as "יוצא הביתה בשישי · חוזר בחמישי 26.11" (Going home Friday · back Thursday 26.11).
  - **Compact:** a single 14-day timeline row.
  - **Expanded:** calendar of the calendar month, from the 1st. No range picker. Swipe between months. At the bottom: "הסבב שלי ›" (My rotation), leading to Me.
  - **Selecting days in the calendar:** tapping a future day of any kind selects it. A second tap makes the selection a range; tapping the same day again clears it. Bars themselves are not tappable. When there is a selection, a tray floats up: "בקשת יציאה · N ימים" (Leave request · N days), which opens New leave with the dates; below it, a row for each existing leave in the selection, opening its leave card.
  - An open request in compact state opens from the "הבקשה שלי" (My request) card, not from the bar.
- **Platoon commander:** **[Superseded → 03 §1.13]** compact only: unit name, fraction (48), 7 day columns, "דוח 1". The text below is the old design.
  - Platoon name, "12 מתוך 16 בבסיס" (12 of 16 on base), "יוצאים 2 · חוזרים 1" (Leaving 2 · Returning 1).
  - **Compact:** presence bar with threshold marker; the rule forecast line ("מחר 7 מתוך 16 · מתחת ל־50% ›" — Tomorrow 7 of 16 · below 50%), opening rule details; and the "דוח 1" button. After sending, the button disappears and a green "✓ 08:12" sits between the bar and the rule line, reopening the report.
  - **Expanded:** a 14-column chart with the threshold line. Days below threshold in amber. Tapping a column shows the day and its number. No Report 1 button.
- **Company commander:** **[Superseded → 03 §1.13]** same compact block as the platoon commander; the fraction opens the unit drawer with a tab per unit. The text below is the old design.
  - "68 מתוך 104 בבסיס", "יוצאים 9 · חוזרים 6".
  - **Compact:** one company bar. Below it an alert line, e.g. "מחלקה 3 מתחת לסף · 10/24 ›" (Platoon 3 below threshold), only when some unit is below threshold. Opens the unit drawer.
  - **Expanded:** 14-day strip (amber dot under a day where any unit is below threshold), a summary for the selected day, and a row per unit updating to the selected day. Tapping a row opens the unit drawer for that day.
- **A commander's personal status** is a small quiet card low in the feed, using the same personal-calendar component.
- **Other Today cards will be rebuilt in step 6** from the card bank.

### Report 1 (drawer)
Top: "דוח 1", then the unit and date. Middle: the named list, "בבסיס" and "לא בבסיס". Bottom: "שלח" (Send), copy and share. After sending, "נשלח" (Sent) with the time replaces "שלח".

### Report 1 (general)
- No tab. Part of the commander's open block in Today. Its named list is the unit drawer.
- The button is "דוח 1". Inside the drawer the action is "שלח". Technically this confirms the day report.
- Usually sent by platoon commanders. The owner is a specific user, usually from HQ.

### Unit drawer
Also serves as the named list for Report 1.
- Opens for a specific day; default today.
- At the top, for users with several units, tabs to switch units. A unit below threshold shows its number in amber (no amber dot, 03 §1.9).
- If the rule is broken in the unit, an amber band appears at the top. Its "⋯" leads to rule details and editing.
- The list splits into "בבסיס" and "לא בבסיס", with "חוזר היום" and "יוצא היום" tags (present tense, 03 §1.11). The header shows a fraction (03 §1.8). Commanders also see the absence reason.
- Bottom: copy and share.

### Rule details
Presence vs threshold by day, and "עריכת הכלל" (Edit rule).

### Threshold marker
Shown only when an availability rule applies to the unit, at the place the rule sets. With several rules, the strictest is shown.

### New leave
- **Soldiers:** picker for one or several soldiers. Appears only in "Leave for soldiers".
- **Leave type:** horizontally scrolling chips, by leave types existing in the org. Types are added only in Settings.
- **Dates:** monthly calendar. One tap selects a day, two taps a range, like booking a flight. Past days unavailable. When opened from a calendar selection, dates are pre-filled.
- **Recurring leave:** "חוזרת" (Recurring) toggle that reveals "כל" (Every) and "עד" (Until).
- **Reason:** field that grows with content.
- **"לאשר מיד"** (Approve immediately): toggle, only for permitted users.

### Leave card (drawer)
Dates large, type and number of days. Pending request: "עריכה" (Edit) and "ביטול הבקשה" (Cancel request) with equal prominence. Leave round: "בקשת הזזה" (Request move).

### My request (soldier)
Edit and cancel with equal prominence.

### Quick request approval
- Swiping a request row in either direction reveals ✓ and ✗. After tapping, a toast with Undo.
- Tapping the row opens the full request.
- **No quick approval when:**
  - The request exceeds a soft rule — it opens in full, because the exception must be approved consciously.
  - Moving a leave out of the leave round — no quick reject. Instead: "השארה במועד המקורי" (Keep original dates).
  - A join request needing review, or a new soldier with no platoon chosen yet.

### Moving a leave out of the leave round (flow)
No new capability needed. Verified against code: a move is an edit of the leave; history keeps previous dates.
- **While pending:** shows "הוזזה מ־X ל־Y" (Moved from X to Y). The original slot appears as a gap with a dashed outline; the new slot as a pending gap.
- **What the approver sees:** no "Reject". Instead "אישור ההזזה" (Approve move) and "השארה במועד המקורי", which restores the dates from history and approves. Technically two existing actions in one tap.
- **A regular request:** keeps approve and reject.
- **Known limitation:** while pending, presence is computed from the new dates. Accepted for now.

### Manage → Soldiers
Source artboard "ניהול · חיילים · טלפון". Title "חיילים", below it the unit and soldier count. A list of person rows (name, role and tags, 7 dots).
- **Sort:** commanders by command rank then name (default), or name only.
- **Sort / group / filter UI:** **[Superseded → 03 §1.12]** one floating options menu with rows, not chip groups. The defaults below still apply.
- **Group:** platoon commander — none by default, options squad or tag. When the list covers several units (company commander) — group by unit by default, with a header per unit.
- **Filter:** inactive soldiers hidden; shown via a "כולל לא פעילים" (Include inactive) toggle.
- **Display:** a "הצגת 7 הימים הקרובים" (Show next 7 days) toggle, to remove the dot strip for a cleaner list.
- **Tap a row** opens the person card at half height. **Long-press** starts multi-select: selection circles on rows, and the tab bar is replaced by an "N נבחרו" tray with leave, tags and transfer.

### Manage → Join requests
Source: the three artboards "בקשות הצטרפות", page "שפת עיצוב", right of the Soldiers artboard. The page is a queue of what's waiting: pending requests only. Auto-linked users do not appear.
- **Header:** title "הצטרפות" (the Manage row stays "בקשות הצטרפות · N"), below it the unit and pending count. Capsule: "אישור N", only when there are ready requests.
- **Row:** person row, height 44: name, personal number in gray in the secondary slot. No squad. A request needing review has an amber chip at the end with the reason.
- **Platoon commander, two groups:**
  - **Ready to approve:** one candidate, no conflict. Mostly a soldier created with name only whose name is close to the requester's. A misspelled or reversed name is a normal match, not a conflict. Swipe: ✓ and ✗.
  - **Needs review:** a conflicting detail (personal number, invite email, or name not close), or several candidates. Swipe: ✗ only. Tap opens the drawer.
- **Company commander:** one list without headers, since all requests reaching them are soldiers with no card. Each row ends with a "מחלקה" (Platoon) chip, opening a floating menu of units. After choosing, the row is ready: ✓ on swipe, counted in "אישור N".
- **Multi-select:** long-press. The "N נבחרו" tray has "אישור". Company commander also has "מחלקה" to assign several at once. Platoon commander can select only ready requests.
- **Drawer "זה הוא?"** (Is this him?): requester name and "ביקש להצטרף · <when>" (Asked to join · when).
  - **One candidate:** "זה הוא?" and the candidate's person row. With a conflict, one amber block below: "{field} שונה מהכרטיס", with both values stacked. Buttons: "כן, לקשר" (Yes, link) and "לא" (No).
  - **Several candidates:** "מי מהם?" (Which one?) and selectable person rows. Buttons: "לקשר" (Link) and "אף אחד" (None).
  - **"לא" and "אף אחד":** open "חייל אחר" (Another soldier — search) and "דחיית הבקשה" (Reject request).
  - **Company commander:** "ליחידה: X" (To unit: X) and "יצירה וקישור" (Create and link). "עוד" (More) opens "קישור לחייל קיים" (Link to existing soldier) and "דחיית הבקשה".
- **After linking:** toast with "פתח כרטיס" (Open card) and Undo.
- **Rejection:** irreversible; the requester is notified. So a confirmation dialog, also from swipe, and no Undo in the toast.
- **Personal-number conflict:** approval does not overwrite the card. The commander checks with the soldier and fixes the person card if needed.

### Join requests — routing
A request goes to whoever may approve on the unit of the best candidate, usually the platoon commander. With no candidate, it goes to the company commander, where the action is "יצירה וקישור".

### Manage → Availability rules
UI name: "כללי נוכחות" (Availability rules). A new rule is "כלל נוכחות", created from the add icon in this page's capsule (03 §1.2).
- **List:** list order is priority; higher wins. Each row: name, the rule sentence below, and an on/off toggle at the end. No drag. A new rule enters at the top; "⋯" has "העברה לראש הרשימה" (Move to top).
- **Overridden rule:** a rule overridden by a higher one (exact same people, unit and day) gets a quiet "לא חל" (Not applied) marker, opening the overriding rule. The system already computes this.
- **Archive:** next to the add (+) icon in the capsule, an options button with "ארכיון" (Archive) and the count. In a rule's "⋯", "העברה לארכיון" (Move to archive) instead of "מחיקה" (Delete). The archive is a drawer. Tapping a rule opens it in the same drawer with "החזרה מהארכיון" (Restore). A restored rule returns to its place in the list. An archived rule stops overriding, and the "לא חל" marker on the rule below disappears.
- **Form, as a sentence of chips** (inspired by Notion filters): "במחלקה 2 · לפחות 50% · בכל הסבב" (In Platoon 2 · at least 50% · for the whole rotation). Each chip opens a short choice. Optional parts don't appear except as "+" chips: "+ רק חובשים" (+ medics only), "+ לכל היותר" (+ at most), "+ תאריכים" (+ dates), "+ בכל מחלקה בנפרד" (+ per platoon separately). "At least" and "at most" on the same people are one rule, not two. Below, quietly: a "לא לאפשר חריגה" (Don't allow exceptions) toggle (off = the system warns), and "עוד" (More: count pending requests). The sentence is also the row description. **The form stays as-is for now and will be revisited at the end.**
- **Language:** "soft", "hard", "priority" and "base rule" are internal terms and never appear in the UI.

### Add soldiers (one flow, for one or many)
Temporary full screen, no tab bar. Opens from the add icon in the Soldiers capsule.
- Top: "ליחידה: X", default current unit, chosen from the unit tree.
- One row per soldier: first and last name (required), personal number and email (optional, for auto-linking). A new empty row opens automatically.
- Three ways to fill the same rows: typing, "הדבקת רשימה" (Paste list — splits into rows), "ייבוא מקובץ" (Import from file).
- Inline validation (duplicate personal number, missing name). Bottom: "הוספת N חיילים" (Add N soldiers). Then a toast with Undo. Failed rows stay with the reason.
- Tags, command rank and phone are edited later in the person card.

### Person card
Me's open block is the person card. Me = my person card + a personal layer (preferences and account). One component in code.
- **One component, two heights:**
  - **Half height:** where the soldier is now, the next 14 days, and a quick action such as "יציאה עבורו" (Leave for him).
  - **Full screen:** details, tags and history. Reached by dragging up or tapping "כרטיס מלא" (Full card).
- **No middle layer:** no separate drawer from which you continue to the card.
- **Users without permission for the full card** (e.g. a soldier in "who's with me") see only half height.
- The card body shows only what's daily. Rare actions that must be quickly available are behind "⋯": personal permission, personal seniority, transfer, archive, unlink user. "⋯" appears only to users permitted for these actions.

### Me (personal profile)
Source artboard "אני · מסך אישי" (Me · personal screen), page "שפת עיצוב". One screen for everyone; only rows change by permission.
- **Value:** Today addresses you; you address Me. Nothing here demands action now. History is depth, not surface.
- **Open block: the profile.** Compact: name (28), unit and rank, tags as chips (military in soft blue, civilian in gray), personal number and phone with copy. Expanded: nickname, assignment date, email, and custom fields (admin-defined custom properties, in the admin's order).
- **The profile is my person card.** Same component and fields as the card others see.
- **Base fields always shown (also in person card):** full name, personal number, phone, unit, tags. Copy buttons next to personal number and phone. Everything else in expanded.
- **Personal number is not hidden.** It is not secret and is used constantly in the army. Same in join requests: do not mask the requester's personal number or email.
- **In-place editing, no drawer.** The pencil turns the block itself into edit mode: the block expands, and each editable field becomes an input in place. Non-editable fields stay text. Pencil and chevron become ✕ (cancel) and ✓ (save). After saving: toast with Undo. The same edit mode is used in the person card.
- **Tags like a Notion multi-select:** in edit mode, ✕ on each chip and a "+" chip at the end. "+" opens an attached floating list with search, grouped by category, with ✓ next to selected ones. "הוסף: X" (Add: X) only for users permitted to create tags.
- **Unit is not edited in the profile.** Changing unit is a "העברה" (Transfer: close an assignment and open a new one from a date), done only from the person card via "⋯" → "העברה", choosing from the unit tree.
- **What a soldier edits themselves:** phone, nickname and custom fields (by permission). Personal number and invite email read-only. If wrong, a commander with personal-details permission fixes them.
- **"הסבב שלי" (My rotation) card:** context line and 14-day row. Opens a full page: summary (days on base, days home, approved requests) and a monthly calendar that also goes to past months, with the same day selection as Today.
- **"הבקשות שלי" (My requests) card:** open and future requests. "כל הבקשות ›" (All requests) opens a page with "פתוחות" (Open) and "היסטוריה" (History).
- **Future personal capabilities** go in as thin rows below "העדפות".
- **"העדפות ›" (Preferences) row:** full page. Appearance, notifications (on this device, and which types), "עבודה" (Work) for commanders (leaves I create are auto-approved, saved views), account (signed in as, install app), sign out at the bottom.
- **Inner pages:** no bar. Round glass back button and a 28 title on the background.

### Tags on a soldier
- A field where you start typing and matching tags appear. Each selected tag shows as a removable chip.
- "הוסף: X" only for users permitted to create tags.
- After "add", choose a category from all categories in the org. If there is only one category, skip the choice.

### Unit tree
- Phone: indented collapsible list, with drag to reorder and move, and swipe for actions.
- Desktop: hierarchical diagram, designed in the desktop conversion.
- The same component is used for choosing a unit.

### Board
**[Superseded in part → 03 §2–3]** Views are Calendar, Timeline and Movements (Table on desktop only); range is set by the view; the header title is the month. The fan behavior below still applies.
- **View switcher ("fan"):**
  - Tapping the view button fans the other icons out along the bar; the title dims.
  - Icons sit directly on the bar, no background. A thin line under the current view.
  - Opening is soft, with a slight stagger between icons. Closing is fast.
  - On selection, the icons collapse into the new icon.
  - Long-press on the button opens saved views.
- **Time range:** ~~day, week, month, full rotation, or custom range~~ — set by the view (03 §2). No two-week and no four-week options.
- **Views:** ~~list, timeline, calendar, table, people~~ → Calendar, Timeline, Movements (03 §3).
- **Header:** month title, and a glass capsule with view switcher and options (03 §2).

### Leave round
The platoon commander plans it for their platoon. Planning and editing after creation will be designed as the next screen.

---

## Card bank
Short record of what each screen should bring to Today. Designed together in step 6 from the card template.

Cards decided before the bank was started: requests to approve, my requests, "איתך היום" (With you today), leave round · planning (at rotation start, for the platoon commander), and Report 1 · company (for the user set as Report 1 owner: a chip per unit, sent or not, and "העתקה" (Copy)).

- **Join requests.** For: every commander requests reach (usually platoon commander; company commander for new soldiers). When: only when some are pending. What: "בקשות הצטרפות · N", below it "N מוכנות · M לבדיקה" (N ready · M to review). Up to 3 person rows with the same swipe as the page. Action: "אישור N" for the ready ones. The whole card opens Manage → Join requests.

---

## Field facts (context)
- **HQ:** a regular unit subordinate to the company. Counts toward company presence normally.
- **Request approval:** the platoon commander approves. Not forbidden for the company commander, but not part of their job, so not prominent for them.
- **Squad commander:** sees only who is present and who isn't. Does not see others' requests — sensitive.
- **Soldier:** sees who is with them in the company. Default is the platoon. Need is occasional: guard roster, who leaves or returns tomorrow, who's free for a task.
- **Squad:** a loose level. A soldier may be assigned to a squad without knowing. Practice is at platoon level.
- **Tags:** military tags (role qualifications, e.g. medic or drone operator) and civilian tags (married, student). An org can create more categories.
  - A military tag can change during the rotation and is used daily, e.g. in rules and grouping.
  - A civilian tag is profile data.
  - The system already supports a lifetime per category: permanent, or one rotation.
- **Availability rules:** a base rule set at rotation start, e.g. minimum 50% per platoon. Beyond that, short-term rules per field conditions, e.g. minimum medics for weekend activity, or maximum present in a week without enough beds.
- **Linking and joining:** the soldier signs in with Google (providing email) and enters first name, last name and personal number. The platoon commander usually lacks all soldier details, so a name is enough to create a soldier; every extra detail saves a manual approval.
  - **Auto-link, no commander:** one match is enough — a verified email identical to one soldier's invite email, or one soldier's personal number with a close name (to guard against typos). Provided the soldier is not archived and has no user. A conflict between email and personal number, or an invite email differing from the Google email, prevents auto-linking.
  - **A join request is created only when:** (1) no soldier exists yet, (2) the soldier was created with name only, or (3) a detail conflicts and commander verification is needed.
  - **On approval** only missing card details are filled from the request. Existing name or details are never overwritten.
  - **The requester does not know** whether a match was found and does not see candidates.
  - **Implemented (19.11):** linking by email or personal number, request classification, bulk approve including name matching, and join-approval permission for platoon commanders in the "פלוגה" (Company) template. Existing orgs need to add the permission in the permissions screen.
- **Joining:** almost all requests are handled by the platoon commander. Only exceptions reach the company commander, e.g. HQ staff, or a new company commander or deputy. There is no platoon field in joining. The platoon commander can link but cannot create a new soldier from a request.
- **The "פלוגה" (Company) template:** a default for quick setup of an organic unit, for initial onboarding. Actual permissions are set per org.
- **"+" actions by frequency for a commander:** leave for myself and availability rule are most common. Leave for soldiers is less common, since the leave round covers most leaves and soldiers submit their own. New soldier is marginal.
- **Request on a day that already has a leave:** allowed.
- **Own details:** a soldier sees their own personal details and may edit some.
- **Personal number:** used all the time; useful to see others' as well.

---

## Under discussion (open — do not build; flag if blocking)
- **Verify in code: which fields a soldier may edit themselves.** In the field: some, yes.
- **"Go to day" from expanded state:** platoon and company commanders may get a door from the selected day. Not decided what it means, since there is no day screen.
- **Verify in code: unit drawer for a future day.** Future presence is computed from leaves; confirm the drawer can accept a date.
- **"People" screen for a platoon commander:** accessible, but one level below the main menu.
- **Request hub:** there is no requests tab. When there are many requests, the requests card in Today may open a screen that gathers them all.
- **Join requests, when wiring:** confirm that approval with soldier creation makes the assignment primary, from today, open-ended. The card value in the conflict block is shown from the candidate's card, which the approver may already see.
- **Availability rules, verify in code:** the early warning is currently computed only for users who read soldiers, assignments and leaves at org level. A platoon commander scoped to their platoon won't get it, which affects the forecast line in their block. Find out whether this is principle or an implementation shortcut.

---

## Possible code changes (NOT for implementation now)
Each is recorded with what and why. Code changes only when there is a real user need or a serious bug.
- **"Presence only" permission.** What: a permission showing only who is present. Why: viewing presence currently requires leave-view permission, which also exposes type, reason and requests. Need: squad commanders and soldiers, without exposing sensitive info (e.g. medical).
- **Transparency slider in preferences.** What: like iOS 27. Why: "Appearance" now has only light, dark or system.
- **Early alert on a rule that will break tomorrow.** What: a bell notification, maybe also in the platoon commander's block. Why: there are no rule notifications today; existing notifications are only about leave requests.
- **Bulk approve for new soldiers (join).** What: each item in a bulk approval can also be soldier creation in a given unit, not just linking. Why: so the company commander can approve several new soldiers together. Without it they approve one by one; the existing capability suffices.
- **Reordering availability rules.** What: one operation saving the priority of several rules together, as exists for other entities. Why: to allow free drag in the list. Today each rule saves separately; a drag would need several saves that could fail midway and leave a broken order. Meanwhile: no drag, new rule enters at top, "Move to top" in "⋯".
