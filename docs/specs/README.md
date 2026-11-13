# Specs of the Later items

Proposed specs of the items in ROADMAP "Later", for a worker to build from. Nothing here is decided: a spec's
P-n become D-numbers, and its card enters `FEATURE_MAP.md` with a V-number, only when its slice starts. Each spec
ends with an **Integration map** (where it lives in the code, reuse, entry points, indicators, effects), its
**Dependencies** and the **Assumptions** made where the intent was unclear (D-170): correct a spec by reading them.

## Ranking

Value is to a company commander and their soldiers using Sagol daily. Cost and risk weigh schema, permission
impact and the free-plan limits (Supabase and Vercel free, no paid service).

| # | Item | Daily value | Cost and risk | Spec |
|---|---|---|---|---|
| 1 | Notifications | High: every request and answer, for every soldier | Medium: one new table (`push_subscriptions`), a service-worker change, an after-commit seam, VAPID secrets the owner sets; Web Push is free | [notifications.md](notifications.md) |
| 2 | Attached memberships | High in reserve service: medics, drivers, staff attached for a rotation | Medium-high: no new table, two constraints, but seven `primaryUnitOn` readers, D-054 coverage, D-105 rows, rules, דוח 1 and rotations change | [attached-memberships.md](attached-memberships.md) |
| 3 | Saved views | Medium-high: the commander's morning look in one press | Low: preferences JSON only, no permission impact | [saved-views.md](saved-views.md) |
| 4 | Rotation templates | Medium, once per rotation | Low: a pure inference over the previous rotation's leaves that prefills the planner; no table | [rotation-templates.md](rotation-templates.md) |
| 5 | Situation picture | Medium-high mid-rotation: who was home least | Low-medium: derived only; unifies three copies of whole-unit membership first; needs the owner's design input | [situation-picture.md](situation-picture.md) |
| 6 | Hour-level leaves | Medium: departure and return hours | Medium: two nullable columns (D-012) and every leave form; availability stays per day by design | [hour-level-leaves.md](hour-level-leaves.md) |
| 7 | Temporary task units | Medium, occasional | Medium: `units.kind='temporary'` exists; mostly UI over item 2, which must ship first | [temporary-task-units.md](temporary-task-units.md) |
| 8 | Simulations | Low daily, high for planning | Highest | deferred, below |

## Recommended build order

1. **Saved views**: low risk, no dependency, daily value; also adds the shared `Drawer` footer.
2. **Notifications**: highest reach; the after-commit seam and the owner's VAPID keys are the only blockers.
3. **Rotation templates**: small, on the shipped planner; fixes `previousRotation`'s sort.
4. **Situation picture**: after the owner's design input; its whole-unit unification helps item 5.
5. **Attached memberships**: the largest change of readers; benefits from the unified membership function.
6. **Temporary task units**: needs item 5.
7. **Hour-level leaves**: independent; last because its value is lower than its form-wide reach.

## Findings from the code (for the build)

- Saved views: applying a view replaces history (D-332), not push; the start view lives in `useHome`, not `app`.
- Notifications: the server gateway has no after-commit hook; a new `afterCommit` seam is the only server change.
- Rotation templates: round batches are not identifiable (`leave_batches` holds no rhythm); inferred from leaves.
- Whole-unit rotation membership exists three times and disagrees (`inDeployment`, the planner's `servedDays`,
  `WHOLE_UNIT`); unified in the situation picture slice.
- Attached memberships: `placementIssues` checks neither unit kind nor validity, and archiving a soldier does not
  end memberships; both fixed in that slice.

## Assumptions to confirm

- Notifications: pushes only about requests (one's own answer, requests awaiting one); opt-in per device; the
  בקשות count stays the only in-app count.
- Attached memberships: always time-bound; the host counts the soldier, the home unit sees but does not count;
  both chains may handle leaves; identity stays home.
- Saved views: personal only (no shared unit views yet); relative to the day; at most 12.
- Rotation templates: "repeat last rotation" rather than a named template library; prefill only.
- Situation picture: fairness = days home against the unit median; approved leaves only (see its owner list).
- Hour-level leaves: hours are information, availability stays per day; a short absence that keeps presence uses
  an `available` leave type.
- Temporary task units: always time-bound, ended by date; members are attachments, never primary moves.

## Simulations (deferred)

Simulating a rotation means a parallel copy of leaves and memberships, or a scenario marker on every row that
every read must ignore by default, which touches every query, rule and permission for little daily use. The
planner's preview already answers "what if" for a leave round, and rotation templates plus the situation picture
cover repeating and checking a plan. Revisit only if commanders ask for multi-rotation planning; then spec it as
a read-only scenario over derived data, never as stored copies.
