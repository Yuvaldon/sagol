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
| OI-297 | R5 | docs | Archiving a row (a soldier, a unit, a definition) must not happen by accident: the design rounds give it a quiet, non-prominent action and a clear confirmation that names what is archived and what it hides. Restoring stays OI-104 (D-344). | open | From the 1.0 planning. Input to stage 4, the design rounds (ROADMAP M7). Decided in D-461 (2026-11-26); moved from R4 to R5, where each rebuilt screen applies it. |
| OI-310 | owner (later) | D-362 | The dashboard's modules are reordered only by the arrows in edit mode. Add dragging a card on a desktop, with the arrows kept for the keyboard and the phone. | open | Found in the dashboard slice (D-362). Could. Built with the design (R5), which may move the dashboard. Moved from R5 (2026-11-26): the dashboard is no longer a main screen and keeps its layout (D-456). |
| OI-311 | owner (later) | D-362 | The heat map's cells open nothing. Opening a soldier's row on the board, or a week's cell on that week, would let the commander act on what they see. | open | Found in the dashboard slice (D-362). Could. Built with the design (R5). Moved from R5 (2026-11-26): same reason as OI-310 (D-456). |
| OI-320 | owner (later) | D-371 | Restore an archived role, rank role binding or deployment. Each gives back permissions or a placement plan, so each needs its own rules (what an archived role's grants become, a binding whose rank is archived, a deployment whose dates have passed) before a `restore` like D-371's. | open | From OI-104 (D-371). 1.0: Could (D-344). |
| OI-353 | owner (later) | A9b | The production release (`.github/workflows/production.yml`) runs `supabase db push` and then `supabase functions deploy`, so for a few minutes the old function runs on the new schema (D-410). A column that is not additive and defaulted, a dropped or renamed column, or a changed check, still breaks the old function in that window. Make a release compatible both ways by rule (expand, then contract in a later release), checked by a test that the previous function's writes pass on the new schema. | open | Found by audit A9b (F4). After 1.0: D-410 covers the additive case, which is every migration so far. |
| OI-381 | R5 | D-442, D-385 | "שמירת השינויים" can save a view with the same query as another view, and two equal views both match the board: the sheet marks the first, which may not be the one just saved. Decide whether an overwrite (or a save) that equals another view is refused, merged, or allowed with the saved one marked. | open | Found in the review of fix/r3-rest-b. Could. Decided in D-462 (2026-11-26): refused, naming the existing view; moved from R4 to R5 to build it with the board batch. |
| OI-382 | R5 | D-447, D-448 | The current join-requests module (`src/ui/modules/account-links/AccountLinksModule.tsx`) labels any candidate not matched by personal id as "by name", a match by invite email included, and shows neither the readiness nor the reason; bulk approval's "needs its own review" text gives no reason. The owner's new join-requests screen replaces it: wire it to `account_link_requests.assessment` (a logic hook over it) and `BulkLinkAnswer.reason`. | open | R3·J kept the `ui` layer unchanged by the owner's instruction (2026-11-19). Frozen: design and UI are the owner's separate track; nothing changes until the owner hands the screen over (2026-11-19). |
| OI-383 | owner | D-450 | The `platoon_command` template grants `accounts: view, approve` only to organizations created from now on. In an existing organization, production included, grant it to the platoon commanders' role in the permissions screen, if wanted. | open | R3·J. An owner action in the product, no code. |
| OI-385 | R5 | D-461 | The availability-rule form is built as drawn, and the handoff package says it is "revisited at the end". When the other screens are in, review the form against them (chips as a sentence, "עוד") and record what changes. | open | From the handoff package (`01` §2). |
| OI-386 | R5·3 | D-471 | The options menu (the "⋯" glass menu of the new interface) is not built: it has no user before the board's range, colors and saved views. Build it with the board batch as a shared component in `src/ui/kit`, and move the view sheet's choices into it. | open | From the shell batch (R5·1). |
| OI-389 | R5·4 | D-471, D-456 | Leave-round planning has no entry of its own: it is reached only from inside the new-leave form ("סבב יציאות"). Give it one, then add its row to "ניהול" (D-456) and the card "סבב יציאות · תכנון" to "היום" (D-459). | open | From the "היום" batch. Until then planning stays reachable through the new-leave form. |
| OI-391 | R5·5 | D-470 | The corner glass circle opens the "שלי" drawer, where the updates are. Replace it with the notifications drawer, and the row "הבקשות שלי" of "אני" with "כל הבקשות". | open | From the shell batch. |
| OI-394 | R5·3 | D-476 | Moving a leave out of the leave round is not built as the handoff describes it (`02`, "Moving a leave out of the leave round"): the leave card of a leave-round leave offers "עריכה", not "בקשת הזזה"; a moved leave does not show "הוזזה מ־X ל־Y", and its approver sees approve and reject, not "אישור ההזזה" and "השארה במועד המקורי". A move is an edit of the leave and its history keeps the earlier dates, so no model change is needed. | open | From the rest of R5·2. Built with the board, which draws the leave round. |
| OI-395 | R5·5 | D-476 | The 14-day strip draws a request that waits as an amber segment a day; the handoff writes the type's name on it, across its days. The strip is the personal-calendar component of "אני" too, so it is finished there. | open | From the rest of R5·2. |
| OI-396 | owner | D-478 | "איתך היום" reaches the holder's own unit and the units under it. The handoff's field notes speak of the platoon for a soldier of a squad (or the company). A reach set by unit level, per organization, would be a model change (`schema.sql`, contracts, the read). Decide whether it is wanted. | open | From the "איתך היום" batch. The narrow reach was chosen under D-170. |
