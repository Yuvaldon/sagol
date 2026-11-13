# Specs of the Later items

Proposed specs of the items in ROADMAP "Later", for a worker to build from. Nothing here is decided: a spec's
P-n become D-numbers, and its card enters `FEATURE_MAP.md` with a V-number, only when its slice starts.

## Ranking

Value is to a company commander and their soldiers using Sagol daily. Cost and risk weigh schema, permission
impact and the free-plan limits (Supabase and Vercel free, no paid service).

| # | Item | Daily value | Cost and risk | Spec |
|---|---|---|---|---|
| 1 | Notifications | High: every request and answer, for every soldier | Medium: one new table (`push_subscriptions`), a service-worker change, VAPID secrets the owner sets; Web Push is free | [notifications.md](notifications.md) |
| 2 | Attached memberships | High in reserve service: medics, drivers, staff attached for a rotation | Medium-high: no new table, two constraints, but D-054 coverage, D-105 rows, rules, דוח 1 and rotations change | [attached-memberships.md](attached-memberships.md) |
| 3 | Saved views | Medium-high: the commander's morning look in one press | Low: preferences JSON only, no permission impact | [saved-views.md](saved-views.md) |
| 4 | Rotation templates for leave batches | Medium, once per rotation | Low-medium: "repeat the last plan" can be derived from the previous rotation's batch; no table needed | — |
| 5 | Hour-level leaves | Medium: appointments, half days | High: additive columns (D-012) but the availability union, rules, drag, every view and דוח 1 learn hours | — |
| 6 | Temporary task units | Medium, occasional | Medium-high: `units.kind='temporary'` exists, but it needs attachments (item 2) first and has the same permission questions | — |
| 7 | Simulations | Low daily, high for planning | Highest: a parallel copy of leaves and memberships, or a scenario column on each; every read must ignore it by default | — |

## One line each on the rest

- **Rotation templates:** "פתיחה מהסבב הקודם" in the leave-round planner prefills groups and rhythm from the
  previous rotation's collective batch; derived, so build it as a planner action, not a stored template.
- **Hour-level leaves:** add nullable `start_time` / `end_time` to `leaves`; a day with a partial leave stays
  "present" in דוח 1 unless the rule says otherwise. Spec after notifications, as it touches every view.
- **Temporary task units:** after attachments; a temporary unit under the company, members attached for its
  dates, closed automatically at `valid_to`. Mostly UI over item 2.
- **Simulations:** defer; the planner's preview already covers "what if" for leave rounds. Revisit only if
  commanders ask for multi-rotation planning.
