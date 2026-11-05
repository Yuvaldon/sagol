# Session 1.3 — Domain: availability and rule evaluation

Date: 2026-11-05 · Layer: domain
Roadmap row: 1.3 · Commits: `feat(domain): availability partition and rule evaluation`

## Done

- **`src/domain/availability/days.ts`**: `effectiveEffect`, `leaveCovers`, `statusCounts`,
  `createAvailabilityContext(data)` → `on` / `isAvailable` per soldier per day
  (`SoldierDay`: one status + covering leaves with effect and `counted`),
  `partitionAvailability` (present / absent lists), `APPROVED_ONLY`.
- **`src/domain/availability/rules.ts`**: `ruleThresholds` (exact counts in hundredths),
  `createRuleContext(data).evaluate(rules, { dates, soldier_ids? })` →
  `{ targets, conflicts }`. Each `RuleTargetResult` carries the evaluated unit, population
  key, group, day, members, available count, required minimum, allowed maximum, broken
  bounds and `overridden_by`. `RuleConflict` per target and day.
- **`src/domain/availability/gate.ts`**: `ruleViolations(targets)` (contract
  `RuleViolation`, effective rules only), `leaveChangeViolations(data, rules, changed)`
  (only what a change makes worse), `ruleGate(violations, acknowledged)` → `Result` with
  the ids to store, or `rule_violation` / `rule_acknowledgment_required`.
- **`src/domain/filters/selections.ts`**: `positiveSelections` (tags and ranks a filter
  selects in a positive sense, the input for groups nobody holds).
- **`src/domain/time`**: `DateRange`, `eachDay`, `rangeCovers`.
- Docs: D-070 … D-073 (entries, index rows, "changed by" of D-012, D-014, D-031, D-032,
  D-047), ARCHITECTURE "Availability", ROADMAP row 1.3, OPEN_ITEMS.

## Decisions

- D-070 availability of a soldier on a day (listed leaves, counting, missing type,
  partition).
- D-071 rule days, evaluated units, populations, thresholds. Owner chose: exact rounding
  (minimum up, maximum down); only active, non-archived, placed soldiers; a deployment limits
  days and soldiers; soldiers placed directly on the scope unit of `each_child` /
  `each_descendant_at_level` are not counted.
- D-072 groups, priority, conflicts. Owner chose: selected tags and ranks are evaluated even
  when nobody holds them.
- D-073 leave changes and enforcement. Owner chose: a violation only when the change makes it
  worse.

## Checks

- `npm run check`: green (357 tests, 42 new). `npm run build`: green.
- `availability.test.ts`: month/year/leap ranges; effect override, type and fallback; union
  of overlapping leaves with markers; pending only on request; closed leaves never listed;
  the partition invariant on a generated world (30 soldiers, 120 leaves of every status,
  type and override, 20 days, both counting options, repeated ids); positive selections
  under negation and `none`.
- `rules.test.ts`: a company with platoons, a squad, an archived platoon, a membership
  change, inactive / archived / unplaced soldiers and a deployment with member dates.
  Thresholds (60 % of 7, 14.29 % of 7, 0.29 % float case, count 2.5); every scope mode, local
  and global; archived and time-bounded units; rule days and deployments; groups (empty
  selected group, held tags, category limit, archived tags and ranks, negated tags, ranks);
  pending counting per rule; priority across scope modes with a differently written equal
  filter; equal priority; conflicts incl. one rule after rounding; priority before the focus
  filter; violations grouped and day-sorted; gate cases (approval, already broken day,
  cancel, marker, other unit, reschedule both directions, maximum, overridden rule) and
  `ruleGate` outcomes; a 92-day window.
- Mutations, each reverted, each failing at least one test (48): pending counting, override
  order, missing-type effect, closed leaves listed, repeated ids, inclusive end; ceil / floor
  / round, float hundredths; inactive and archived soldiers, subtree, archived and
  time-bounded units, disabled rules, rule dates, archived and off-day deployments, member
  dates, deployment members, the filter; positive tags and ranks, held tags, category,
  archived tags and ranks; each child vs descendants, scope unit in its own level, global top
  level; overriding, effective-only conflicts, `<=` conflicts, per-rule pending option,
  `<=` / `>=` bounds, focus before priority; worse-only comparisons (both bounds), overridden
  in the gate and in `ruleViolations`, old dates of a reschedule, hard / acknowledged gate,
  day order; negation and `none` in selections; inclusive `eachDay`.

## Open items

- Opened: OI-027 (2.2, leave commands call `leaveChangeViolations` + `ruleGate`, and what a
  violation may show about invisible soldiers), OI-028 (7.1 and 3.3, logic exposes
  availability and rule evaluation, live warnings), OI-029 (8.1, backend port of D-070 …
  D-073).
- OI-015 trigger: start-of-session documents are now ≈ 132 KB (≈ 35k tokens), up from
  128 KB at 1.2b. This session was not compacted. The owner decides whether that is above
  ~10% of the context window (D-062).

## Input for the next session (1.4 config)

- OI-001 (env Zod schema from `AuthMode`, `DataAdapterMode`) and OI-011 (closed palette-key
  list) are targeted at 1.4. The palette list is a product choice: ask the owner.
- Nothing in 1.3 needs a config constant: thresholds use local named constants, and
  `APPROVED_ONLY` is the domain default for views that do not count pending leaves.
- After 1.4 the next row is the phase 1 audit **A1** (D-051): the 1.4 session must end by
  telling the owner to open a separate read-only audit session with `docs/AUDIT.md`.

## Recommendation for the next session (D-052)

- Model: Sonnet 5.5 · Effort: medium
- Reason: 1.4 is config constants and an env schema built from existing contract enums,
  following established patterns; the palette list is an owner question, not design work.
