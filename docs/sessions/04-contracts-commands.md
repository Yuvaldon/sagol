# Session 1.1b — Contracts: commands, repositories, auth, errors

Date: 2026-11-04 · Layer: contracts
Roadmap row: 1.1b · Commits: `feat(contracts): command inputs, data adapter interfaces, auth and errors`

## Done

- **Entities, refactored without changing behavior:** refined entities now also export
  an unrefined `XColumns` object (`UnitColumns`, `LeaveColumns`, `AccessGrantColumns`, ...),
  because Zod 4.6 throws on `pick` / `omit` / `partial` of a refined object.
  `checkAvailabilityRule` and `scopeColumns` are exported for inputs. These stay internal:
  `index.ts` does not re-export them.
- **`common/result.ts`**: `Result<T>`, `AsyncResult<T>`, `Unsubscribe`.
- **`errors/`**: `ErrorCode`, `AppError` (discriminated on `code`), `IssueCode` (field
  codes + `SchemaIssue` + state codes), `Issue`, `RuleViolation`, `RuleGroupValue`,
  `RuleBound`.
- **`auth/`**: `AuthMode` (= `IdentityProvider`), `DEVELOPMENT_ONLY_AUTH_MODES`,
  `DataAdapterMode`, `AuthIdentity`, `IdentitySource`, `GoogleAuthProvider`,
  `LocalAuthProvider` (+ `LocalIdentityRequest`), `AuthProvider`, `Session`,
  `SessionStatus`, `OnboardingState`, `SessionService`.
- **`inputs/`**: one schema per command, by resource (organization, accounts, hierarchy,
  soldiers, permissions, tags, leaves, deployments, rules, properties, transfer). Helpers
  in `inputs/common.ts`: `updateInput`, `changesOf`, `archiveInput`, `reorderInput`,
  `distinctIds`, `checkDistinct`. Plus `ImportOperation`, `ImportBatchInput`,
  `ImportReport`, `OrganizationExport`, `EXPORT_FORMAT_VERSION`.
- **`repositories/`**: query schemas (`ReferenceQuery`, `LeaveQuery`, `DateWindow`, ...),
  `EntityRepository`, `ListRepository`, `DataRepositories` (one entry per table),
  `LinkCandidate`, `DataChange`, `ChangeFeed`.
- **`commands/`**: `Command`, `ReferenceCommands`, `SortableCommands`, `DataCommands`,
  `DataTransfer`, `DataAdapter`, `DataAdapterFactory`.

## Decisions (approved by the product owner)

- D-044 caller-generated ids. D-045 input conventions (one organization per installation
  in MVP). D-046 error model. D-047 soft-rule acknowledgment. D-048 auth and session.
  D-049 leave command set. D-050 import and export.
- ARCHITECTURE "Server-authoritative data layer" now names `DataAdapter` and these entries.

## Checks

- `npm run check`: green (126 tests). `npm run build`: green.
- `inputs.test.ts`:
  - every exported `*Input` is mapped to its table, and every field (nested objects and
    `changes` included) is a column of that table or a declared command field;
  - no input takes `organization_id` or audit columns;
  - strictness (`status` in a leave update, `parent_id` in a unit update and
    `organization_id` on create are rejected), `no_changes`, row checks on inputs (dates,
    scope, rule thresholds), `duplicate_item`, permission pairs, membership change, link
    review, import operations, export covers every table;
  - every `ErrorCode` has a payload shape; `IssueCode` contains every `SchemaIssue`;
    `AuthMode` equals `IdentityProvider`;
  - type test: `keyof DataRepositories` equals `TableName`.
- Shown to fail on deliberate mutations, each reverted: a non-column field
  (`new_parent`), `organization_id` on a create input, a missing repository entry
  (caught by `tsc`).

## Open items

- OI-001: note added (enums now available). Target unchanged (1.4).
- OI-002: the contracts part is done; moved to 4.2 for the `vite.config.ts` guard (tooling
  follow-up), with the reason in Notes.
- Opened: OI-016 (1.2), OI-017 (2.2, owner decision), OI-018 (2.3, owner decision),
  OI-019 (owner, later), OI-020 (8.3).
- OI-015 trigger check: 20 rows in OPEN_ITEMS (trigger ~30), 50 entries in DECISIONS
  (trigger ~60). Not reached.

## Input for the next session (1.2 domain)

- Read `docs/OPEN_ITEMS.md`. Items targeted at 1.2: OI-009, OI-010, OI-016.
- Report domain failures as `Issue` objects with `IssueCode` state codes already in
  `src/contracts/errors/index.ts`: `unit_cycle`, `membership_overlap`,
  `seniority_override_overlap`, `tag_single_selection`, `last_access_manager`,
  `invalid_transition`, `reason_required`, `property_*`, `filter_operator_invalid`,
  `range_inverted` (OI-009). A missing code is a contracts change: record it, do not
  invent a string.
- The leave state machine maps `LeaveTransition` (`approve`, `reject`, `cancel`, `reopen`)
  from `LeaveStatus` to the next status and `LeaveEventType`.
- Account-link candidates produce `LinkCandidate` (`personal_id`, then `name`).
- Availability rule evaluation (1.3) reports breaks as `RuleViolation`.
- Update inputs are merged with the stored row and re-parsed with the entity schema by the
  adapter (D-045): domain validators receive complete rows.
