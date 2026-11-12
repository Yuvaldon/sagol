# Sagol — Open Items

The single source of truth for work that one session leaves for another (D-043).
Handoff notes record what happened in a session. This file records what must still happen.

## Rules

1. **Start of session:** read this file. Every `open` item whose target is this session
   (or this session's layer, when the target is a layer) is in scope: resolve it, or move it
   explicitly (new target + reason in the Notes column).
2. **End of session:** close what was resolved (status `closed`, closing session in Notes) and
   move those rows to `docs/OPEN_ITEMS_ARCHIVE.md`, unchanged (D-128). Add new items, and in the
   pull request description refer to items by id (`opened OI-016`, `closed OI-009`) instead of copying their text.
3. **Never delete a row.** Ids are permanent and never reused. A closed row is moved to the
   archive, which is not read at the start of a session. An item that turns out to be
   unnecessary is closed with the reason.
4. **Target** is one roadmap row (`V3`, `8.1`) or a track (`docs`). Work that spans slices is one
   item per slice, and the Notes column is not a change log (D-128). `owner` means the product
   owner acts outside a session.
5. Items that need a product decision say so. The target session asks the owner first.

Status: `open` · `closed`

## Items

| Id | Target | From | Item | Status | Notes |
|----|--------|------|------|--------|-------|
| OI-032 | V23 | 0.7 | Focus mode (the mock's "מצב מיקוד") has no decision behind it. Define it and give it a slice when wanted (D-077). | open | Moved to V23 in V24: D-252 makes the two strips the whole chrome it hides, D-264 orders it after V25. |
| OI-102 | owner (later) | V9 | Invite links (was OI-026): a link directs, it does not approve; a request made through it attaches to the link's unit and matching searches only that unit's soldiers; expiry and use limits; optional "approve all exact matches". Needs a schema change (link table, request reference) and changes `linkCandidates` and the reviewer filter (D-030, D-149, D-152). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-104 | owner (later) | V9 | Restore an archived row (units, levels, ranks, soldiers, ...). An archived soldier's personal number stays taken until then (D-098, D-152). | open | Needs a product-owner decision when wanted. |
| OI-111 | owner (later) | V13 | The window is always a week, and its arrows say "previous week" and "next week" in every view. A month for the calendar, or two and four weeks for the list and the table, needs a span in the URL beside the window (D-103, D-174). | open | Needs a product-owner decision when wanted. |
| OI-112 | owner (later) | V14 | The filter bar reads property conditions of select and yes / no soldier properties only. Text, number, date and reference properties, and unit or leave properties, need operators and inputs in the bar (D-177). | open | Needs a product-owner decision when wanted. |
| OI-116 | owner (later) | V18 | The installed app needs the network for every read and write (D-185): a lost connection mid-session shows the failure of the call, and nothing is queued. Add a connection banner, and an offline queue only if users ask for one. | open | Free-plan limits apply to any sync service. |
| OI-117 | owner (later) | V18 | Google sign-in from the installed app on an iPhone (standalone) is a full-page redirect inside the scope (D-184); verified in emulation only. Verify it on a real iPhone and a real Android phone once the app is deployed. | open | Needs a real device and the production deploy. |
| OI-118 | A7 | V18 | The entry chunk is above Vite's 500 kB warning again (539 kB on main before V18, 543 kB after), though D-210 resolved OI-045 with no chunk above it. Split the app's own code (route-level lazy modules) so no chunk passes 500 kB. | open | Found in the V18 build. |
| OI-151 | owner (later) | 8.3 | The remote adapter hears only its own writes and other tabs' (D-204): a change made on another device shows after the next read. Add live changes (Supabase Realtime or polling) when users need it. | open | Free-plan limits apply. |
| OI-152 | owner (later) | 8.4 | Vercel Preview (staging) points at the production Supabase project (D-209). Create a second free Supabase project for staging, apply the migrations, deploy the function there and point Preview's `VITE_REMOTE_*` at it. | open | The free plan allows two active projects; the orchestrator holds the account. |
| OI-200 | V25 | V24 | Apply the term map of `docs/Design.md` ("Simplification: information architecture") in `i18n`: every rename, merge and hide, no "ארגון" in any string, the root unit's name where the scope or a rule meant the whole organization, and one plain line per management module (D-250, D-251). | open | |
| OI-201 | V25 | V24 | The two strips: a context pill at the top and a destination pill at the bottom, hugging their content on every screen size and orientation; remove the full-width phone bars, the context row and the wide phone's folded row (D-252). | open | |
| OI-202 | V25 | V24 | The profile holds the person only: appearance with the rules row's place, install, the identity switch, sign-out; the "תצוגה" section leaves the panel (D-253). | open | |
| OI-203 | V25 | V24 | "ניהול יחידה": the navigation panel renamed and regrouped (היחידה, נוכחות, פרטי חיילים, הרשאות, נתונים), "ניהול" as the last destination with the summed count, pins and their control removed; the stored pin preference is no longer read (D-254). | open | Removing `pinned_modules` from `SoldierPreferences` and the `schema.sql` comment is a model change: V26 makes it with D-257 … D-260; a missing key already reads as the default. |
| OI-204 | V25 | V24 | The requests inbox for who approves: the approve-now switch in its header, "ממתינות לאישורי" and the closed section; "בקשה חדשה" moves to the role's primary quick action, a filled round button at the bottom strip's inline end, which replaces the floating "+" and follows the creation permission until the mode exists (D-266); MyLeaves loses its own new-request button; old panel links still land (D-252, D-255, D-256, D-265). | open | |
| OI-218 | V25 | V24 | "שלי" and the home by permissions: a bottom destination for whoever has a soldier record (my next days in or out, my requests open and history); who approves or manages someone lands on the board at their widest scope, everyone else on "שלי"; the last choice remembered on the device; a link naming a panel or view wins; `my_leaves` lands on "שלי" (D-265). | open | |
| OI-205 | V25 | V24 | One path per action: the empty board's single action, no "סבב חדש" in the range menu, no presence count in the bar, the לוח destination keeps the dates (D-256). | open | |
| OI-206 | V25 | V24 | e2e walks journeys (c), (d) and (e) of `docs/Design.md` step by step, on desktop and a phone, with axe (D-263). | open | |
| OI-207 | V26 | V24 | One rotation at a time per organization, by dates and not by open state: the domain rule with its own error, and an exclusion constraint over `organization_id` and the date range with `btree_gist` from `extensions`; the migration says which live rotations overlap if any do (D-257). | open | Model change: `schema.sql`, `DECISIONS.md` and `contracts` first in the slice. |
| OI-208 | V26 | V24 | The explicit close: `deployments.closed_at`, `closed_by`, the "סגירת סבב" command only for `created_by` or who may manage rotations, never automatic on the end date; a closed rotation stays readable and read-only for dates, members and rotation tags; "פתיחה מחדש" clears the close (D-258). | open | Model change. |
| OI-209 | V26 | V24 | A rotation with no member rows holds its unit's soldiers for its days, derived in the domain; the form's "כל היחידה" or "רשימה" choice (D-259). | open | |
| OI-210 | V26 | V24 | Tag lifetimes per assignment: `soldier_tags.deployment_id` nullable for every category (NULL persistent, set this rotation only), an `id` key with the two partial unique rules, `tag_categories.default_lifetime` pre-selecting the choice when assigning, and "כמו בסבב הקודם" on the soldier's card (D-260). | open | Model change. |
| OI-211 | V26 | V24 | The mode of the screen: derived: the rotation holding today, else the nearest upcoming, else the latest ended rotation still open, else שגרה; the top strip names it, the range opens on it, the routine notice (its action is the strip's "פתיחת סבב"), the hub and דוח 1 only in a rotation's mode; e2e walks journey (b) (D-257, D-263). | open | |
| OI-217 | V26 | V24 | "סבב חדש מסבב קודם": a new rotation starts from a previous one, copying its member list (if it had one) and its rotation tags through the ordinary commands, reported per step (D-258, D-260). | open | |
| OI-212 | V27 | V24 | The claim creates the organization and its root unit from one name; the unit form has no "no parent" choice once a root exists (D-251, D-262). | open | Changes the bootstrap command and its server function. |
| OI-213 | V27 | V24 | The "פלוגה" template: structure in `config`, names in `i18n`, applied as a sequence of the ordinary commands that stops and reports at a failed step (D-261). | open | |
| OI-214 | V27 | V24 | The setup as pick, adjust, done, landing in routine mode; the D-180 checklist only for an unfinished setup; e2e walks journey (a) (D-262, D-263). | open | |
| OI-215 | V27 | V24 | The time zone shows and can be changed in the root unit's form, since the claim takes it from the device (D-262). | open | |
| OI-219 | V28 | V24 | The quick action follows the mode once V26 derives it (OI-211): "בקשה חדשה" while a rotation is current or upcoming, "פתיחת סבב" in routine for who may create a rotation, none otherwise (D-266). | open | |
| OI-220 | V29 | docs | The board's opening view follows the device when neither a link nor a remembered choice names one: the timeline from `md` for planning, today's list or calendar on a phone for the field (D-272). | open | |
| OI-221 | V29 | docs | A rule's breach shows in every view from the existing rule evaluation: the calendar's day, the list's unit heading, the timeline's heat row as today (D-272). | open | |
| OI-222 | owner (later) | docs | A situation picture: days in base per soldier and unit, fairness spread, rules over the rotation; derived, never stored. Needs joint design with the owner (D-272). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-223 | V28 | docs | The install offer, once on its own after sign-in, where the install can act; "לא עכשיו" or an install ends it on the device; the menu item stays (D-274). | open | |
