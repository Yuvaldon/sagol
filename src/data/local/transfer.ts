import {
  EXPORT_FORMAT_VERSION,
  ImportBatchInput,
  ImportOperation,
  OrganizationExport,
  type AsyncResult,
  type DataChange,
  type DataTransfer,
  type ImportReport,
  type Permission,
  type PolicyTarget,
  type TableName,
} from '@contracts'
import { issuesFromSchema } from '@domain'
import { z } from 'zod'
import { loadActorScope, requirePermission } from './actor'
import type { LocalChangeFeed } from './changes'
import { createCommandRankCommands } from './commandRanks'
import { STORES } from './store'
import type { LocalDependencies } from './dependencies'
import { asResult, parseInput } from './failure'
import { createLeaveCommands } from './leaveCommands'
import { createLeaveTypeCommands, createLeaveTypeGroupCommands } from './leaveTypes'
import { createAccessGrantCommands, createRankRoleBindingCommands, createRoleCommands } from './permissions'
import { createAvailabilityRuleCommands } from './rules'
import { createSoldierCommands } from './soldiers'
import { createTagCategoryCommands, createTagCommands } from './tags'
import { createUnitLevelCommands } from './unitLevels'
import { createUnitCommands } from './units'

// Import and export (D-022, D-050, D-171). Import runs the same commands as the UI inside one outer transaction, so
// it has no path of its own around validation or permissions, and nothing is written unless every operation passes.

const IMPORT = { resource: 'data_transfer', action: 'import' } as const satisfies Permission
const EXPORT = { resource: 'data_transfer', action: 'export' } as const satisfies Permission
const ORGANIZATION: PolicyTarget = { kind: 'organization' }

/** Every store: the commands an import runs open their transactions inside this one. `STORES` names every table. */
const EVERY_TABLE = Object.keys(STORES) as TableName[]

/** The tables an export reads by organization; the organization itself is the actor's. */
const ORGANIZATION_TABLES = EVERY_TABLE.filter(
  (table) => table !== 'organizations' && Object.hasOwn(OrganizationExport.shape.tables.shape, table),
)

const OperationList = z.object({ operations: z.array(z.unknown()) })

/** The commands an import runs. Built over a feed that holds changes until the outer transaction commits. */
function importCommands(dependencies: LocalDependencies) {
  return {
    unit_levels: createUnitLevelCommands(dependencies),
    units: createUnitCommands(dependencies),
    command_ranks: createCommandRankCommands(dependencies),
    soldiers: createSoldierCommands(dependencies),
    roles: createRoleCommands(dependencies),
    rank_role_bindings: createRankRoleBindingCommands(dependencies),
    access_grants: createAccessGrantCommands(dependencies),
    tag_categories: createTagCategoryCommands(dependencies),
    tags: createTagCommands(dependencies),
    leave_type_groups: createLeaveTypeGroupCommands(dependencies),
    leave_types: createLeaveTypeCommands(dependencies),
    leaves: createLeaveCommands(dependencies),
    availability_rules: createAvailabilityRuleCommands(dependencies),
  }
}

type ImportCommands = ReturnType<typeof importCommands>

function runOperation(commands: ImportCommands, operation: ImportOperation): AsyncResult<unknown> {
  switch (operation.command) {
    case 'create_unit_level':
      return commands.unit_levels.create(operation.input)
    case 'create_unit':
      return commands.units.create(operation.input)
    case 'create_command_rank':
      return commands.command_ranks.create(operation.input)
    case 'create_soldier':
      return commands.soldiers.create(operation.input)
    case 'set_soldier_tags':
      return commands.soldiers.setTags(operation.input)
    case 'create_role':
      return commands.roles.create(operation.input)
    case 'create_rank_role_binding':
      return commands.rank_role_bindings.create(operation.input)
    case 'grant_access':
      return commands.access_grants.grant(operation.input)
    case 'create_tag_category':
      return commands.tag_categories.create(operation.input)
    case 'create_tag':
      return commands.tags.create(operation.input)
    case 'create_leave_type_group':
      return commands.leave_type_groups.create(operation.input)
    case 'create_leave_type':
      return commands.leave_types.create(operation.input)
    case 'create_leave':
      return commands.leaves.create(operation.input)
    case 'create_availability_rule':
      return commands.availability_rules.create(operation.input)
  }
}

/** A list with a malformed operation runs nothing: each operation is reported on its form alone (D-171). */
function malformedReport(raw: unknown): ImportReport | null {
  const list = OperationList.safeParse(raw)
  if (!list.success) return null
  const results = list.data.operations.map((operation, index) => {
    const parsed = ImportOperation.safeParse(operation)
    return {
      index,
      error: parsed.success ? null : { code: 'validation_failed' as const, issues: issuesFromSchema(parsed.error.issues, operation) },
    }
  })
  return results.some((result) => result.error !== null) ? { committed: false, results } : null
}

/** A feed that keeps what the commands announce, for one announcement after the commit. */
function heldFeed(changes: LocalChangeFeed, held: DataChange[]): LocalChangeFeed {
  return {
    publish(written) {
      held.push(...written)
    },
    subscribe: (listener) => changes.subscribe(listener),
  }
}

export function createTransfer(dependencies: LocalDependencies): DataTransfer {
  const { database, time, changes } = dependencies
  return {
    importBatch: (raw) =>
      asResult(async () => {
        // The permission comes first, so who may not import learns nothing of the input's form.
        await database.transaction('r', EVERY_TABLE, async () => {
          requirePermission(await loadActorScope(dependencies), IMPORT, ORGANIZATION)
        })
        const malformed = malformedReport(raw)
        if (malformed !== null) return malformed
        const input = parseInput(ImportBatchInput, raw)
        const held: DataChange[] = []
        const commands = importCommands({ ...dependencies, changes: heldFeed(changes, held) })
        const results: ImportReport['results'] = []
        // A refused command aborts the outer transaction with it, so the run ends there; a dry run is ended on purpose.
        let ended = false
        try {
          await database.transaction('rw', EVERY_TABLE, async () => {
            const scope = await loadActorScope(dependencies)
            requirePermission(scope, IMPORT, ORGANIZATION)
            for (const [index, operation] of input.operations.entries()) {
              const result = await runOperation(commands, operation)
              results.push({ index, error: result.ok ? null : result.error })
              if (!result.ok) {
                ended = true
                throw new Error('import refused')
              }
            }
            if (input.dry_run) {
              ended = true
              throw new Error('dry run')
            }
          })
        } catch (error) {
          if (!ended) throw error
          return { committed: false, results }
        }
        if (held.length > 0) changes.publish(held)
        return { committed: true, results }
      }),

    exportOrganization: () =>
      asResult(() =>
        database.transaction('r', EVERY_TABLE, async () => {
          const scope = await loadActorScope(dependencies)
          requirePermission(scope, EXPORT, ORGANIZATION)
          const entries = await Promise.all(
            ORGANIZATION_TABLES.map(async (table) => [
              table,
              await database.table(table).where('organization_id').equals(scope.organization_id).toArray(),
            ]),
          )
          return OrganizationExport.parse({
            format_version: EXPORT_FORMAT_VERSION,
            exported_at: time.now(),
            tables: { organizations: [scope.organization], ...Object.fromEntries(entries) },
          })
        }),
      ),
  }
}
