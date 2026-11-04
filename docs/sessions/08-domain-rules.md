# Session 1.2b — Domain: leave workflow, account linking, filters, properties

Date: 2026-11-04 · Layer: domain
Roadmap row: 1.2b · Commits: `feat(domain): leave workflow, link matching, filters and property rules`

## Done

- **`src/domain/leaves/`**: `LEAVE_TRANSITIONS`, `LEAVE_PERMISSIONS`, `EDITABLE_LEAVE_STATUSES`;
  `planLeaveTransition`, `planLeaveCreation`, `planLeaveEdit` return either the refusal
  issues or the permissions to check, the next `status` / `reviewed_by` / `reviewed_at` and
  the event (`event_type`, `from_status`, `to_status`). `isMaterialLeaveUpdate`,
  `isMaterialReschedule`, `leaveReasonIssues`. Comments: `COMMENT_PERMISSIONS`,
  `isCommentAuthor`, `commentChangeIssues`.
- **`src/domain/accounts/`**: `normalizeName`, `normalizePersonalId`, `normalizeEmail`;
  `linkCandidates`, `autoLinkSoldier`, `linkReviewTargets`, `canReviewLinkRequest`
  (uses `can()`), `linkRequestTransitionIssues`, `linkEnrichment`.
- **`src/domain/properties/`**: `fitsPropertyType`, `isEmptyPropertyValue`, `foldText`,
  `propertyValueIssues` (checks only new or changed values), `propertyDefinitionIssues`.
- **`src/domain/tags/`**: `tagSelectionIssues`, `selectionModeChangeIssues`.
- **`src/domain/filters/`**: `createFilterContext(data)` → `matches` / `select` per soldier
  per day; `OPERATORS_BY_DATA_TYPE`, `operatorFits`, `operandFits`, `propertyMatches`;
  `filterIssues`, `filterReferences`; `canonicalFilter`, `filterKey`, `sameFilter`.
- **`src/domain/issues/`**: `issuesFromSchema` (Zod issues typed structurally →
  `IssueCode`), `withPathPrefix`.
- **`src/domain/json/`**: `stableStringify`, `jsonEqual`, `compareCodeUnits`.
- Docs: D-063 … D-068 (entries and index rows, "changed by" of D-013, D-015, D-016, D-030,
  D-031, D-041, D-046, D-049), ARCHITECTURE (identity, errors, filters, a leave-workflow
  section), ROADMAP row 1.2b, OPEN_ITEMS.

## Decisions

- D-063 leave state machine and permissions (owner chose the full machine and
  source-dependent reopen permission).
- D-064 editing a leave: closed statuses, material edits follow `reschedule_policy`
  (owner chose "like moving dates"). Applied here: when an approved leave stays approved,
  the actor becomes its reviewer.
- D-065 property values and options (owner chose "check changes only"), tag selection.
- D-066 account-link matching (owner chose normalized names with swap, normalized and
  stored personal ids, inactive soldiers included).
- D-067 filter semantics (owner chose complement and case-insensitive text) and structural
  canonical form.
- D-068 Zod issue mapping (OI-016).

## Checks

- `npm run check`: green (315 tests, 108 new). `npm run build`: green.
- `leaves.test.ts`: every status × transition (16 cases) with outcome, permission and event;
  review columns; creation; edits across status, materiality, policy and approver;
  reason; comments.
- `accounts.test.ts`: normalization (niqqud, geresh, maqaf, final letters, leading zeros,
  full-width digits); candidate order, exclusions, swap; auto-link incl. an ambiguous match;
  review by unit and by organization scope with a real `PolicyContext`; enrichment.
- `properties.test.ts`, `tags.test.ts`: value shapes per data type; stale values tolerated;
  required on create and on change; archived and foreign definitions; option rules;
  single-selection and switching to single.
- `filters.test.ts`: a 5-soldier world with a membership change and a seniority override;
  every node kind, per day; every operator family; complements; validation paths;
  references; canonical keys, and the canonical form selecting the same soldiers.
- `issues.test.ts`: real contract schemas, so a Zod upgrade that changes issue shapes fails.
- Mutations, each reverted, each failing at least one test (40): no undo-approval, reopen
  permission, cancelled code, re-approval reviewer, reopen keeping the review, editing
  closed leaves, blank reason; name swap, linked/archived candidates, ambiguous and
  email-less auto-link, no-candidate review, leading zeros, niqqud, final letters; unchanged
  values checked, required always / only on create, duplicate multi-select items, archived
  required; single selection; SQL-style `not_equals`, exact text, unfit stored values,
  `>=` as `>`; descendants, per-day unit, overrides, foreign definitions; flattening, double
  negation, one-tag `all`, key without `include_descendants`, operand check; missing as
  `invalid_type`, inherited keys, blank as `too_short`.

## Open items

- Closed: OI-010 (property, option and tag rules), OI-016 (`issuesFromSchema`).
- Opened: OI-023 (2.2, commands and reads call the 1.2b functions), OI-024 (logic 3.1,
  forms and hints), OI-025 (8.1, backend port of D-063 … D-067).
- Updated: OI-019 notes (a revoked account blocks re-linking: `uq_soldier_accounts_soldier`).
- OI-015 trigger: start-of-session documents are now ≈ 128 KB (≈ 34k tokens), up from
  115 KB at 0.5. This session was not compacted. Whether that is above ~10% of the context
  window depends on the model's window; the owner decides (D-062).

## Input for the next session (1.3 domain)

- Read OI-023 (the data layer will call 1.3's rule evaluation from the same commands).
- Rule populations: `createFilterContext(data).matches(rule.population_filter, soldier,
  date)` or `select(...)`. Rule targets compare populations with `filterKey` (D-031,
  D-067).
- Availability needs the effective effect: the leave's `availability_effect_override`,
  else its type's effect (D-032). Only approved leaves count, plus pending ones when
  `count_pending_as_unavailable` (D-014). Reuse `spanCovers`, `primaryUnitOn`,
  `descendantsOf`, `ancestorOrSelfAtLevel`.
- Rule violations use `RuleViolation` / `RuleGroupValue` from contracts. A missing code is a
  contracts change.
- Ask the owner first: how `percent` rounds (required count from a percentage), whether
  soldiers with status `inactive` are part of rule populations by default, how a rule tied
  to a deployment limits its days and soldiers (`deployment_members` dates), and what
  `each_child` / `each_descendant_at_level` do with soldiers placed directly on the scope unit.

## Recommendation for the next session (D-052)

- Model: Opus 5.5 · Effort: high
- Reason: 1.3 sets the availability partition invariant and the rule evaluation (targets,
  grouping, priority, conflicts) that commands enforce and the server mirrors.
- The phase 1 audit (A1) follows 1.4. It is not next.
