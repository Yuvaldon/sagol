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
| OI-219 | the first track-A slice after V26 merges | V24 | The quick action follows the mode once V26 derives it (OI-211): "בקשה חדשה" while a rotation is current or upcoming, "פתיחת סבב" in routine for who may create a rotation, none otherwise (D-266). | open | Moved from V28: the mode it follows is V26's, not yet merged (V28). |
| OI-222 | owner (later) | docs | A situation picture: days in base per soldier and unit, fairness spread, rules over the rotation; derived, never stored. Needs joint design with the owner (D-272). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-230 | owner | docs | Production delivery's one-time settings only the owner can make, all repository-level: the secret `SUPABASE_ACCESS_TOKEN` replaced by one new scoped token covering the production and staging projects, the copy in the `staging` environment deleted, and `PRODUCTION_DB_PASSWORD` and `PRODUCTION_PROJECT_REF` present at repository level; after that each green Staging run on `main` delivers production (D-280). | open | No `production` environment (owner's choice, 2026-11-12). A missing permission on the token shows as a run error naming it. |
| OI-240 | V31 | V26 | A soldier's tags sheet shows a category's tags in the scope its lifetime chooser points at: with "this rotation" chosen, the soldier's persistent tags in that category are out of sight, though they still apply. Show them, read-only, or say they exist. | open | Raised in V26's review (#9); assigned to V32, which shipped without it, so it moves to V31, the next rotation slice. |
| OI-244 | A7 | V32 | `NavigationModule` and `soldier_preferences.pinned_modules` outlived the pins (D-254) and the work/setup panel (D-285): drop both or name what they mean now, in `schema.sql`, `DECISIONS.md` and `contracts` together; until then the config test checks the panel's own placement, not the enum. | open | Needs the orchestrator's approval (contracts). |
| OI-245 | A7 | V32 | A soldier's card reads every grant the viewer may see to show that soldier's own (`useGrantRows`); a read by grantee keeps a large unit's card light. | open | |
| OI-246 | A7 | V29 | Two rounds of one soldier that overlap draw their bands in the same place on the timeline, so the one beneath is hidden there (it is still reached from the list); stack them or mark the overlap (D-290). | open | |
| OI-254 | A7 | V30 | "Changed since" (D-293) reads the leaves of a section's current soldiers that touch the day ±1 now: a leave moved wholly off those days after the confirmation, and a soldier moved into or out of the unit, do not mark the report changed. A leave's past dates (its events) or the membership's `updated_at` would catch them. | open | |
| OI-255 | A7 | V30 | A confirmation holds from the client's read (`seen_at`, D-293), but on the server a leave transaction that began before that read and commits after it carries an `updated_at` older than `seen_at`, so that change does not show as "changed since". A commit-ordered stamp (or reading the change feed's position) would catch it. | open | |
