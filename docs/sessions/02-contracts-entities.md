# Session 1.1a — Contracts: entities, vocabularies, filters

Date: 2026-11-04 · Layer: contracts (plus one tooling line, D-039)
Roadmap row: 1.1a (row 1.1 split into 1.1a / 1.1b) · Commits: `feat(contracts): entity schemas, vocabularies and schema drift test`

## Done

- **`src/contracts/common/`**
  - `ids.ts`: a branded UUID id per table (`SoldierId`, `UnitId`, ...), plus `AuthUserId`
    and `PropertyOptionId`.
  - `scalars.ts`: `CalendarDate` (`YYYY-MM-DD`), `Timestamp` (ISO 8601 with `Z` or an
    offset), `Integer`, `Version`, `varchar(n)`, `label(n)` (trimmed, non-empty), `Text`,
    `Email`, `ColorKey`, `IconKey`, `JsonValue`.
  - `audit.ts`: shared audit column blocks (D-017).
  - `issues.ts`: `SchemaIssue`, stable codes used as the message of row-check issues.
  - `refinements.ts`: date-range and scope-anchor checks that mirror the cross-column
    CHECK constraints.
- **`enums/`**: every CHECK vocabulary of `schema.sql`, plus `UNIT_SCOPE_ANCHORS` and
  `ReschedulePolicy`.
- **`permissions/`**: `PermissionResource`, `PermissionAction`,
  `PERMISSION_ACTIONS_BY_RESOURCE` and `Permission`, a discriminated union that admits only
  the valid pairs (D-040).
- **`settings/`**: `OrganizationSettings`, `SoldierPreferences` (both parse `{}` with
  defaults, D-041) and `PropertyOption`.
- **`filters/`**: `FilterExpression` (`{ where?: FilterNode }`, so `{}` means every
  soldier) and the recursive `FilterNode`: `and`, `or`, `not`, `tag` (any/all/none),
  `command_rank`, `seniority` (effective, inclusive bounds), `unit` (± descendants),
  `soldier_status`, `soldier`, `property` (operator + JSON operand).
- **`entities/`**: one row schema per table, snake_case column names (D-038). Row checks
  cover dates, scope anchors, permission pairs and availability-rule thresholds and modes.
- **`tables.ts`**: `TABLE_SCHEMAS` (table name → row schema), `TableName` and
  `TableRow<T>`. `unit_closure` is excluded on purpose (D-039).
- **Tooling:** `.dependency-cruiser.cjs` lets contracts `*.test.ts` files import `vitest`
  and `docs/schema.sql`. Production contracts code is still limited to `zod`.

## Decisions (asked and approved by the product owner)

- D-038 contract field names = schema column names (snake_case).
- D-039 drift test in contracts, with the narrow depcruise exception.
- D-040 valid `(resource, action)` pairs.
- D-041 `reschedule_policy` default `keep_if_can_approve`; `create_leaves_as_approved`
  default `false` (the conservative default, not asked separately).
- D-042 dates as `YYYY-MM-DD` strings, timestamps as ISO strings, NUMERIC as numbers.
- Roadmap 1.1 was split into 1.1a and 1.1b.

## Checks

- `npm run check`: green (102 tests).
- `schema-drift.test.ts` compares tables, columns, nullability, VARCHAR lengths, value
  types and CHECK vocabularies. It was shown to fail on five deliberate mutations, each
  reverted: wrong length, a NOT NULL column made required, a changed enum value, an extra
  column, and NUMERIC typed as int.
- `schemas.test.ts` covers the settings defaults, valid and invalid permission pairs,
  scope-anchor arguments, `include_descendants`, date ranges, date and timestamp formats,
  each availability-rule check, and valid and invalid filter expressions.
- The depcruise rules reject a contracts source file that imports vitest, and a contracts
  test that reads another docs file (probe files, then removed).

## Open items

- **Timestamp ordering** (`access_grants.valid_to > valid_from`) is not checked in
  contracts, because comparing ISO strings with offsets is not reliable. Domain (1.2)
  checks it.
- **Not in contracts, by design (domain 1.2):** whether property `options` match the data
  type, property values against their definitions, `single` tag selection, and seniority
  override overlap.
- **`color_key` / `icon_key`** are only length-checked here. The closed palette list lives
  in `config` (1.4). The data layer (2.x) checks membership on write.
- **`FilterExpression` selects soldiers only.** View filters on leaves (type, status) are
  not modeled. Session 3.3 should decide whether view state holds them separately or
  whether the model gains a leave subject (that would be a contracts change).
- **`leave_events.from_status/to_status`** have no CHECK in `schema.sql` (allow-listed
  in the drift test). Add one in a docs/contracts session or at 8.1.
- **Auth-mode enum** is still not defined. It belongs to 1.1b (auth contracts) and is
  needed by 1.4 and by the build guard in `vite.config.ts`.

## Input for the next session (1.1b contracts)

- Build on `@contracts`: ids, entities, `TABLE_SCHEMAS`, `SchemaIssue`, `Permission`.
- Write command inputs (createLeave, transitionLeave, rescheduleLeave, grantAccess,
  revokeAccess, requestAccountLink, reviewAccountLink, bootstrapOwner, moveUnit,
  changeMembership, importBatch) and reference-data create/update inputs. Derive them
  from the entity schemas (`pick` / `omit`) so names never fork.
- Write repository, command, auth (`AuthProvider`, identity, `AuthMode` enum) and session
  interfaces, a typed `Result`, and error codes. Fold `SchemaIssue` into the error-code
  vocabulary or reference it from there.
- Row-check helpers use `z.core.$RefinementCtx`. Keep cross-column checks in
  `common/refinements.ts`.
