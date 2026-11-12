import type { Store } from './store'
import {
  ArchiveUnitInput,
  CreateUnitInput,
  IssueCode,
  MoveUnitInput,
  ReorderUnitsInput,
  Unit,
  UpdateUnitInput,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type UnitId,
} from '@contracts'
import {
  archiveUnitIssues,
  buildUnitTree,
  moveUnitIssues,
  placementTarget,
  rootIssues,
  unitTarget,
} from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { colorKeyIssues, propertiesIssues } from './checks'
import { tableOf } from './store'
import { updatedBy, type LocalDependencies } from './dependencies'
import { asResult, failValidation, parseInput } from './failure'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  permissionOf,
  requireWritable,
  tablesOf,
  visibleRow,
  type ReferenceSpec,
  type RowCheck,
} from './reference'

// `units`: `parent_id` is the only source of ancestry (D-009), and changes only through `move`.
// One live root per organization (D-251): neither create nor move makes a second one.

async function organizationUnits(database: Store, scope: ActorScope): Promise<Unit[]> {
  return tableOf(database, 'units').where('organization_id').equals(scope.organization_id).toArray()
}

/** A new parent must exist, be visible and be live. */
async function parentIssues(database: Store, scope: ActorScope, parentId: UnitId | null): Promise<Issue[]> {
  if (parentId === null) return []
  const parent = await tableOf(database, 'units').get(parentId)
  const visible =
    parent !== undefined &&
    parent.organization_id === scope.organization_id &&
    holds(scope, permissionOf('units', 'view'), unitTarget(parent))
  if (!visible) return [{ path: ['parent_id'], code: IssueCode.enum.reference_not_found }]
  if (parent.archived_at !== null) return [{ path: ['parent_id'], code: IssueCode.enum.reference_archived }]
  return []
}

/** A new level must exist, be visible and be live. An unchanged one is left alone (D-088). */
async function levelIssues({ database, scope, row, before }: RowCheck<Unit>): Promise<Issue[]> {
  if (row.unit_level_id === null || row.unit_level_id === before?.unit_level_id) return []
  const level = await tableOf(database, 'unit_levels').get(row.unit_level_id)
  const visible =
    level !== undefined &&
    level.organization_id === scope.organization_id &&
    holds(scope, permissionOf('unit_levels', 'view'), { kind: 'organization' })
  if (!visible) return [{ path: ['unit_level_id'], code: IssueCode.enum.reference_not_found }]
  if (level.archived_at !== null) return [{ path: ['unit_level_id'], code: IssueCode.enum.reference_archived }]
  return []
}

/** `uq_units_code`: unique in the organization, archived units included. */
async function codeIssues({ database, scope, row, before }: RowCheck<Unit>): Promise<Issue[]> {
  if (row.code === null || row.code === before?.code) return []
  const taken = await tableOf(database, 'units')
    .where('[organization_id+code]')
    .equals([scope.organization_id, row.code])
    .first()
  return taken === undefined ? [] : [{ path: ['code'], code: IssueCode.enum.already_exists }]
}

const SPEC: ReferenceSpec<Unit> = {
  table: 'units',
  resource: 'units',
  schema: Unit,
  checkTables: ['unit_levels', 'property_definitions'],
  optionalText: ['code'],
  targetOf: unitTarget,
  rowIssues: async (check) => {
    const { database, scope, row, before } = check
    return [
      ...colorKeyIssues(before?.color_key, row.color_key),
      ...(before === null
        ? [
            ...(await parentIssues(database, scope, row.parent_id)),
            ...rootIssues(await organizationUnits(database, scope), row.id, row.parent_id),
          ]
        : []),
      ...(await levelIssues(check)),
      ...(await codeIssues(check)),
      ...(await propertiesIssues(database, scope, 'unit', before?.properties ?? null, row.properties)),
    ]
  },
}

/** Live sub-units and placements of soldiers who are not archived keep a unit (D-088). */
async function archiveIssues(database: Store, scope: ActorScope, unit: Unit): Promise<Issue[]> {
  const organizationId = scope.organization_id
  const [units, memberships, soldiers] = await Promise.all([
    organizationUnits(database, scope),
    tableOf(database, 'unit_memberships').where('unit_id').equals(unit.id).toArray(),
    tableOf(database, 'soldiers').where('organization_id').equals(organizationId).toArray(),
  ])
  const archivedSoldiers = new Set(soldiers.filter((row) => row.archived_at !== null).map((row) => row.id))
  return archiveUnitIssues(
    { units, memberships: memberships.filter((row) => !archivedSoldiers.has(row.soldier_id)) },
    unit.id,
    scope.context.clock.today,
  )
}

export function createUnitRepository(dependencies: LocalDependencies): DataRepositories['units'] {
  return createReferenceRepository(dependencies, SPEC, bySortOrder)
}

export function createUnitCommands(dependencies: LocalDependencies): DataCommands['units'] {
  const { database, changes } = dependencies
  return {
    ...createReferenceCommands(dependencies, SPEC, {
      create: CreateUnitInput,
      update: UpdateUnitInput,
      archive: ArchiveUnitInput,
      placementOf: (input) => placementTarget(input.parent_id),
      archiveIssues,
    }),

    reorder: createReorderCommand(dependencies, SPEC, ReorderUnitsInput, (row) => row.parent_id),

    move: (raw) =>
      asResult(async () => {
        const input = parseInput(MoveUnitInput, raw)
        const moved = await database.transaction('rw', tablesOf(SPEC), async () => {
          const scope = await loadActorScope(dependencies)
          const before = await visibleRow(database, SPEC, scope, input.id)
          // Policy on both sides comes before the row's state (D-090, OI-051).
          requirePermission(scope, permissionOf('units', 'update'), unitTarget(before))
          requirePermission(scope, permissionOf('units', 'update'), placementTarget(input.parent_id))
          requireWritable(before, input.expected_version)
          if (before.parent_id === input.parent_id) {
            return failValidation([{ path: ['parent_id'], code: IssueCode.enum.no_changes }])
          }

          const units = await organizationUnits(database, scope)
          const issues = [
            ...(await parentIssues(database, scope, input.parent_id)),
            ...moveUnitIssues(buildUnitTree(units), input.id, input.parent_id),
            ...rootIssues(units, input.id, input.parent_id),
          ]
          if (issues.length > 0) return failValidation(issues)

          // The unit lands after its new siblings (D-087).
          const siblings = units.filter((unit) => unit.parent_id === input.parent_id && unit.archived_at === null)
          const row = Unit.parse({
            ...before,
            parent_id: input.parent_id,
            sort_order: Math.max(-1, ...siblings.map((unit) => unit.sort_order)) + 1,
            ...updatedBy(scope.soldier_id, scope.now, before.version),
          })
          await tableOf(database, 'units').put(row)
          return row
        })
        changes.publish([{ table: 'units', ids: [moved.id] }])
        return moved
      }),
  }
}
