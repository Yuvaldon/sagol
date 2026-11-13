# Specs of the Later items

Proposed specs of the items in ROADMAP "Later", for a worker to build from. Nothing here is decided: a spec's
P-n become D-numbers, and its card enters `FEATURE_MAP.md` with a V-number, only when its slice starts. Each spec
ends with an **Integration map** (where it lives in the code, reuse, entry points, indicators, effects), its
**Dependencies** and the **Assumptions** made where the intent was unclear (D-170): correct a spec by reading them.

## Owner's feedback (2026-11-13, recorded as decided, D-170)

- **Board calendar fix:** top priority, above every new feature. It is a fix, being built now, with no spec here.
- **Saved views:** approved on condition that it never burdens everyday use: quiet by default, only inside the
  existing view sheet, nothing shown until a view is saved (`saved-views.md` P-6).
- **Dashboard** (renamed from "situation picture"): charts and key figures, with a fairness heat map of who is
  mostly on base and who is mostly at home; all derived, free tier, read permissions respected (`dashboard.md`).
- **Missions / operations** (renamed from "temporary task units"): relatively important, beyond the MVP, after the
  dashboard. It now ships before attached memberships, so it builds the attachment core (`missions.md` P-4).
- **Attached memberships:** not urgent; last.
- **Hour-level leaves:** frozen.

## Ranking

Value is to a company commander and their soldiers using Sagol daily. Cost and risk weigh schema, permission
impact and the free-plan limits (Supabase and Vercel free, no paid service).

| # | Item | Daily value | Cost and risk | Spec |
|---|---|---|---|---|
| 1 | Saved views | Medium-high: the commander's morning look in one press; niche, so it stays quiet | Low: preferences JSON only, no permission impact | [saved-views.md](saved-views.md) |
| 2 | Notifications | High: every request and answer, for every soldier | Medium: one new table (`push_subscriptions`), a service-worker change, an after-commit seam, VAPID secrets the owner sets; Web Push is free | [notifications.md](notifications.md) |
| 3 | Rotation templates | Medium, once per rotation | Low: a pure inference over the previous rotation's leaves that prefills the planner; no table | [rotation-templates.md](rotation-templates.md) |
| 4 | Dashboard | Medium-high mid-rotation: who is mostly on base, who mostly at home | Low-medium: derived only, on D-336's single rotation membership; client-side charts, no library | [dashboard.md](dashboard.md) |
| 5 | Missions / operations | Medium, occasional; beyond the MVP | Medium-high: `units.kind='temporary'` exists, but it carries the attachment core (seven `primaryUnitOn` readers, D-054 coverage, D-105 rows) | [missions.md](missions.md) |
| 6 | Attached memberships | Medium in reserve service; not urgent per the owner | Low once missions shipped: opens the core to standing hosts, plus the soldier-details block | [attached-memberships.md](attached-memberships.md) |
| — | Hour-level leaves (**frozen by the owner, 2026-11-13**) | Medium: departure and return hours | Medium: two nullable columns (D-012) and every leave form | [hour-level-leaves.md](hour-level-leaves.md) |
| — | Simulations | Low daily, high for planning | Highest | deferred, below |

## Recommended build order

0. **Board calendar fix**: top priority, above all new features (owner, 2026-11-13); being built; no spec here.
1. **Saved views**: low risk, no dependency, daily value; quiet by default (P-6).
2. **Notifications**: highest reach; the after-commit seam and the owner's VAPID keys are the only blockers.
3. **Rotation templates**: small, on the shipped planner; fixes `previousRotation`'s sort.
4. **Dashboard**: on D-336 (shipped); on its assumed defaults.
5. **Missions / operations**: builds the attachment core, limited to temporary hosts.
6. **Attached memberships**: opens that core to standing hosts.

Hour-level leaves is frozen by the owner (2026-11-13), a marginal feature for now: not in the order.

## UI freeze (D-333)

D-333 as amended on 2026-11-13 holds for every slice here: existing screens are not moved, restyled or
reworked; a feature adds the new UI components it needs (a module, a sheet, an action, a primitive), and may make
only the small adjustments to an existing screen that fitting it in requires (an entry in the drawer, an action in
a header, a field in a form). Fixes follow D-333's fix rule unchanged.

## Findings from the code (for the build)

- Saved views: applying a view replaces history (D-332), not push; the start view lives in `useHome`, not `app`;
  the whole feature sits in `ViewSheet`, so no `Drawer` footer and no `FilterBar` change are needed.
- Notifications: the server gateway has no after-commit hook; a new `afterCommit` seam is the only server change.
- Rotation templates: round batches are not identifiable (`leave_batches` holds no rhythm); inferred from leaves.
- Whole-unit rotation membership existed three times and disagreed: fixed by OI-292 / D-336
  (`createRotationMembership`); the dashboard builds on it.
- Attached memberships: `placementIssues` checks neither unit kind nor validity, and archiving a soldier does not
  end memberships; both checked against main and latent (no UI path, no production rows), fixed in that slice.
- Rotation templates: `previousRotation`'s start-date sort is latent: live rotations never overlap.

## Assumptions to confirm

- Notifications: pushes only about requests (one's own answer, requests awaiting one); opt-in per device; the
  בקשות count stays the only in-app count.
- Attached memberships: always time-bound; the host counts the soldier, the home unit sees but does not count;
  both chains may handle leaves; identity stays home.
- Saved views: personal only (no shared unit views yet); relative to the day; at most 12; saved from the view
  sheet, not from "סינון ומיון".
- Rotation templates: "repeat last rotation" rather than a named template library; prefill only.
- Dashboard: five widgets (key figures, fairness heat map by week, daily presence, spread per sub-unit, home
  days by type); fairness = days home against the unit median; `unavailable` absences count as home; approved
  leaves only, future ones on request; CSS and SVG charts, no chart library.
- Hour-level leaves (frozen): hours are information, availability stays per day; a short absence that keeps presence uses
  an `available` leave type.
- Missions: always time-bound, ended by date; members are attachments, never primary moves; the UI word is
  "משימה".

## Simulations (deferred)

Simulating a rotation means a parallel copy of leaves and memberships, or a scenario marker on every row that
every read must ignore by default, which touches every query, rule and permission for little daily use. The
planner's preview already answers "what if" for a leave round, and rotation templates plus the dashboard
cover repeating and checking a plan. Revisit only if commanders ask for multi-rotation planning; then spec it as
a read-only scenario over derived data, never as stored copies.
