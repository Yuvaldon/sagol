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
| OI-102 | owner (later) | V9 | Invite links (was OI-026): a link directs, it does not approve; a request made through it attaches to the link's unit and matching searches only that unit's soldiers; expiry and use limits; optional "approve all exact matches". Needs a schema change (link table, request reference) and changes `linkCandidates` and the reviewer filter (D-030, D-149, D-152). | open | Needs a product-owner decision when wanted. Its own slice. 1.0: Won't; stays open after 1.0 (D-344). |
| OI-116 | owner (later) | V18 | The installed app needs the network for every read and write (D-185): a lost connection mid-session shows the failure of the call, and nothing is queued. Add a connection banner, and an offline queue only if users ask for one. | open | Free-plan limits apply to any sync service. 1.0: Won't; stays open after 1.0 (D-344). |
| OI-117 | owner (later) | V18 | Google sign-in from the installed app on an iPhone (standalone) is a full-page redirect inside the scope (D-184); verified in emulation only. Verify it on a real iPhone and a real Android phone once the app is deployed. | open | Needs a real device and the production deploy. Android verified by the owner on a real phone (2026-11-13); the iPhone is checked in acceptance testing, on a borrowed device (the owner has none). 1.0: Must (D-344). |
| OI-297 | R4 | docs | Archiving a row (a soldier, a unit, a definition) must not happen by accident: the design rounds give it a quiet, non-prominent action and a clear confirmation that names what is archived and what it hides. Restoring stays OI-104 (D-344). | open | From the 1.0 planning. Input to stage 4, the design rounds (ROADMAP M7). |
| OI-298 | R3 | domain | A leave of a type in the built-in group carries no reason (D-347), but only the forms keep it out: the shared command core (`leaveReasonIssues`, `domain/leaves/workflow.ts`) still accepts a reason on such a leave, and the details and the thread show one if a stored row has it. Refuse a reason there in the core, so the local and server adapters answer the same. | open | Found in the review of OI-295 (D-347). 1.0: Should. |
| OI-299 | R3 | D-348 | Live changes reach members only (D-348): a requester whose account link is still pending hears nothing, so the approval shows after their next read (a focus or a reload). Let the waiting screen hear its own request's answer. | open | Should. Needs a check that admits a pending requester to a topic of their own, without opening a table (D-203). |
| OI-300 | R3 | supabase | The database tests apply the migrations to an empty database, so a migration that changes existing rows is never run against them: the built-in group's migration (D-347) passed the tests and failed on staging, where moving the existing groups down skipped the version raise the guard requires (D-012). Run each new migration over a database that already holds an organization from the migrations before it. | open | Found in the staging deploy of OI-295. 1.0: Should. |
| OI-301 | R3 | D-358 | A browser may renew or drop a push subscription on its own (`pushsubscriptionchange`), and the server then keeps a dead endpoint until a send answers 404 or 410, while the device stays silent. The worker handles no `pushsubscriptionchange`, and the app does not compare the browser's subscription with the server's on start. Resubscribe in the worker and send the new endpoint, or have the open app send its current subscription again when the switch reads "on". | open | Found in the notifications slice review. Should. The worker has no session of its own, so the app's start is the simpler place. |
| OI-302 | R3 | D-358 | Sign-out awaits the device's unsubscribe (`forgetThisDevice`, `src/logic/session/hooks.ts`) with no time limit: a browser whose push service hangs keeps the soldier from signing out. Bound the wait (a config timeout), then sign out; the server row ends on the next 404 or 410, or on revoke. | open | Found in the notifications slice review. Should. |
| OI-310 | R5 | D-362 | The dashboard's modules are reordered only by the arrows in edit mode. Add dragging a card on a desktop, with the arrows kept for the keyboard and the phone. | open | Found in the dashboard slice (D-362). Could. Built with the design (R5), which may move the dashboard. |
| OI-311 | R5 | D-362 | The heat map's cells open nothing. Opening a soldier's row on the board, or a week's cell on that week, would let the commander act on what they see. | open | Found in the dashboard slice (D-362). Could. Built with the design (R5). |
| OI-320 | owner (later) | D-371 | Restore an archived role, rank role binding or deployment. Each gives back permissions or a placement plan, so each needs its own rules (what an archived role's grants become, a binding whose rank is archived, a deployment whose dates have passed) before a `restore` like D-371's. | open | From OI-104 (D-371). 1.0: Could (D-344). |
| OI-341 | R3 | A9a | The local adapter starts an organization's change counter in three places (`organizations.ts` on create, the database upgrade in `database.ts`, and the import). Start it in one function in `changeCounters.ts`, as the server does in its migration and its load. | open | Found in audit A9a. Could. |
| OI-342 | R3 | D-402 | The report's leaves are read after the change number (D-402), but its memberships are read in their own query, so a membership change committed between the reads can be covered by the confirmation's `seen_seq` unseen. Read the memberships in the same counted query. | open | Found in the fix of A9a. Should. |
| OI-353 | owner (later) | A9b | The production release (`.github/workflows/production.yml`) runs `supabase db push` and then `supabase functions deploy`, so for a few minutes the old function runs on the new schema (D-410). A column that is not additive and defaulted, a dropped or renamed column, or a changed check, still breaks the old function in that window. Make a release compatible both ways by rule (expand, then contract in a later release), checked by a test that the previous function's writes pass on the new schema. | open | Found by audit A9b (F4). After 1.0: D-410 covers the additive case, which is every migration so far. |
| OI-354 | R3 | A9a | Web push follows redirects: `@negrel/webpush` posts with the global `fetch` (default `redirect: 'follow'`) and keeps its encryption helpers private (D-411). Own the request: encrypt and sign with the library's exported parts or a small RFC 8291 module, and post with `redirect: 'manual'`, treating a 3xx as a failed delivery. | open | Found by audit A9a. Bounded until then: known push hosts only, `Authorization` dropped across origins, encrypted body. |
| OI-380 | R5 | D-443 | The cut-over hour of "סטטוס דוח 1" is one config hour (`DAY_REPORT.nextDayFromHour`) for every organization, where the spec says "the organization's cut-over hour". Decide whether it becomes an organization setting (a model change: `schema.sql`, contracts, the settings screen) or stays one hour. | open | Found while closing OI-312. Could. Needs a product decision. |
| OI-381 | R4 | D-442, D-385 | "שמירת השינויים" can save a view with the same query as another view, and two equal views both match the board: the sheet marks the first, which may not be the one just saved. Decide whether an overwrite (or a save) that equals another view is refused, merged, or allowed with the saved one marked. | open | Found in the review of fix/r3-rest-b. Could. |
