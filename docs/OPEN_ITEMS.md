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
| OI-032 | owner (later) | 0.7 | Focus mode (the mock's "מצב מיקוד") has no decision behind it. Define it and give it a slice when wanted (D-077). | open | Needs a product-owner decision. |
| OI-102 | owner (later) | V9 | Invite links (was OI-026): a link directs, it does not approve; a request made through it attaches to the link's unit and matching searches only that unit's soldiers; expiry and use limits; optional "approve all exact matches". Needs a schema change (link table, request reference) and changes `linkCandidates` and the reviewer filter (D-030, D-149, D-152). | open | Needs a product-owner decision when wanted. Its own slice. |
| OI-104 | owner (later) | V9 | Restore an archived row (units, levels, ranks, soldiers, ...). An archived soldier's personal number stays taken until then (D-098, D-152). | open | Needs a product-owner decision when wanted. |
| OI-111 | owner (later) | V13 | The window is always a week, and its arrows say "previous week" and "next week" in every view. A month for the calendar, or two and four weeks for the list and the table, needs a span in the URL beside the window (D-103, D-174). | open | Needs a product-owner decision when wanted. |
| OI-112 | owner (later) | V14 | The filter bar reads property conditions of select and yes / no soldier properties only. Text, number, date and reference properties, and unit or leave properties, need operators and inputs in the bar (D-177). | open | Needs a product-owner decision when wanted. |
| OI-116 | owner (later) | V18 | The installed app needs the network for every read and write (D-185): a lost connection mid-session shows the failure of the call, and nothing is queued. Add a connection banner, and an offline queue only if users ask for one. | open | Free-plan limits apply to any sync service. |
| OI-117 | owner (later) | V18 | Google sign-in from the installed app on an iPhone (standalone) is a full-page redirect inside the scope (D-184); verified in emulation only. Verify it on a real iPhone and a real Android phone once the app is deployed. | open | Needs a real device and the production deploy. |
| OI-118 | A7 | V18 | The entry chunk is above Vite's 500 kB warning again (539 kB on main before V18, 543 kB after), though D-210 resolved OI-045 with no chunk above it. Split the app's own code (route-level lazy modules) so no chunk passes 500 kB. | open | Found in the V18 build. |
| OI-151 | owner (later) | 8.3 | The remote adapter hears only its own writes and other tabs' (D-204): a change made on another device shows after the next read. Add live changes (Supabase Realtime or polling) when users need it. | open | Free-plan limits apply. |
| OI-152 | owner (later) | 8.4 | Vercel Preview (staging) points at the production Supabase project (D-209). Create a second free Supabase project for staging, apply the migrations, deploy the function there and point Preview's `VITE_REMOTE_*` at it. | open | The free plan allows two active projects; the orchestrator holds the account. |
