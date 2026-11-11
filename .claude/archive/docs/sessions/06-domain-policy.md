# Session 1.2a — Domain: hierarchy and permission policy

Date: 2026-11-04 · Layer: domain (plus one tooling rule, D-061)
Roadmap row: 1.2a (row 1.2 split into 1.2a / 1.2b) · Commits: `feat(domain): hierarchy, permission policy and policy matrix`

## Done

- **`src/domain/time/`**: `Clock` (`today`, `now`), `todayIn` / `clockAt` (today in the
  organization time zone), `compareDates`, `compareInstants` (instants with any offset),
  `spanCovers` / `spansOverlap` (inclusive calendar spans, open end), `windowContains`
  (half-open instant window). Domain never reads a clock.
- **`src/domain/hierarchy/`**: `buildUnitTree`, `ancestorsOf`, `descendantsOf`, `depthOf`,
  `isAncestorOrSelf`, `ancestorAtSteps`, `ancestorOrSelfAtLevel`, `moveUnitIssues`
  (`unit_cycle`). Walks stop on cycles in corrupt data. Memberships: `primaryUnitOn`,
  `membershipOverlapIssues` (`membership_overlap`).
- **`src/domain/policy/`**:
  - `createPolicyContext(data, clock)`: indexes a `PolicyData` snapshot (each field is a
    `Pick` of the contract row, so full rows fit) and exposes `unitOf`, `seniorityOf`,
    `holdsPermissions`, `permissionsOf` (cached per soldier) and `soldierIds`.
  - `EffectivePermission`: pair, resolved scope, rank constraint, source (`baseline`,
    `rank_binding`, `access_grant`) and `expires_at`.
  - `resolveScope` / `scopeCovers`, `TARGET_KINDS_BY_RESOURCE` / `acceptsTarget`,
    `PolicyTarget` (`organization` | `unit` | `soldier`).
  - `can(context, actorId, permission, target)` and `missingPermissions` (escalation guard).
  - `accessManagers`, `accessManagerIssues` (`last_access_manager`),
    `ACCESS_MANAGEMENT_PERMISSIONS`, `accessGrantIssues` (`range_inverted`, OI-009).
  - Seniority: `activeOverrideOn`, `effectiveSeniority`, `seniorityOverrideOverlapIssues`.

## Decisions

- D-053 targets and what scopes cover. D-054 unit = primary membership today. D-055
  unresolvable anchors are empty. D-056 only active, linked soldiers hold permissions.
  D-057 rank constraints with missing ranks. D-058 active sources. D-059 access-manager
  invariant without expiry. D-060 no escalation. D-061 domain tests may import vitest
  (`.dependency-cruiser.cjs`).
- The product owner approved them as D-051 … D-058. A parallel docs session (0.4) took
  D-051 and D-052 first, so they were renumbered D-053 … D-060 before the commit.
- D-056 adds the account condition to the approved "active and not archived". It is
  D-003's "every active linked soldier" applied to every source. Actors are always linked,
  so this changes only the access-manager count.

## Checks

- `npm run check`: green (207 tests).
- `policy.test.ts`: a sample battalion → company → 2 platoons → 3 squads, 15 soldiers,
  5 roles, 5 rank bindings, 10 grants. `MATRIX` has 49 rows (actor × permission × target
  → allowed), each naming the rule it proves. Also: seniority, sources and expiry,
  relative scope following a membership change, 7 lockout cases plus a passing one,
  escalation, grant validity across offsets, override overlap.
- `hierarchy.test.ts`, `time.test.ts`: tree derivation, steps and levels, cycles, corrupt
  data, memberships, time-zone boundary, instant comparison across offsets.
- Mutations, each reverted, each failing at least one test: self in `junior_or_equal`,
  "view only" on organization targets, half-open grant window, account requirement,
  revoked account, expiry in the invariant, archived bindings, archived roles, empty scope,
  target kinds, subject without seniority, the level anchor including the home unit.
- `depcruise` refuses a production domain file that imports `vitest`.

## Open items

- Closed: OI-009 (`accessGrantIssues`).
- Moved: OI-010 → 1.2b (seniority-override overlap done; property and tag parts remain),
  OI-016 → 1.2b. Reasons in Notes.
- Opened: OI-021 (2.2, commands must call the checks), OI-022 (8.2, matrix extraction).
- OI-015 trigger: DECISIONS now has 61 entries (trigger ~60). **Reached.** OPEN_ITEMS has
  22 rows. Product-owner decision pending.

## Input for the next session (1.2b domain)

- Read `docs/OPEN_ITEMS.md`: OI-010 (property options and values, `single` tag category),
  OI-016 (Zod issue mapping).
- Ask the owner first: leave transitions per status (approved → reject? cancelled →
  reopen?), the permission each transition needs, edits on rejected/cancelled leaves,
  whether changing an approved leave's type follows `reschedule_policy`, personal-id and
  name normalization for link candidates, property validation of unchanged values and
  removed options.
- Reuse from 1.2a: `Clock`, `spanCovers` / `spansOverlap`, `primaryUnitOn`,
  `effectiveSeniority`, `isAncestorOrSelf` / `descendantsOf` (filter `unit` nodes with
  descendants, evaluated per day). Rule evaluation is 1.3.
- Report failures as `Issue` with existing `IssueCode`s. A missing code is a contracts
  change.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: 1.2b sets new domain rules (leave state machine, link matching, filter canonical
  form) that later layers and the server mirror.
- The phase 1 audit (A1) follows 1.4. It is not next.
