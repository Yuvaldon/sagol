import type { PermissionCheck, Result, Unit, UnitId, UnitLevel, UpdateUnitLevelInput } from '@contracts'
import { placementTarget, unitTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import type { WithProperties } from '../properties/properties'
import { usePorts } from '../runtime/context'
import { toCreateUnitInput, toCreateUnitLevelInput, toUpdateUnitInput, type UnitFormValues } from './forms'
import { siblingsUnder, steppedOrder, type UnitDropPlan } from './tree'

// Reading and changing the unit tree.

const LIVE = { include_archived: false }
const WITH_ARCHIVED = { include_archived: true }

/** Live units. Archived ones appear nowhere on screen (D-088). */
export function useUnits(): Loaded<readonly Unit[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.units, LIVE],
      queryFn: () => unwrap(data.repositories.units.list(LIVE)),
    }),
  )
}

/** Every level, archived ones too: a unit keeps showing the name of its level (D-088). */
export function useUnitLevels(): Loaded<readonly UnitLevel[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.unitLevels, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.unit_levels.list(WITH_ARCHIVED)),
    }),
  )
}

export function liveLevels(levels: readonly UnitLevel[]): UnitLevel[] {
  return levels.filter((level) => level.archived_at === null)
}

export function useUnitCommands() {
  const { data } = usePorts()
  const { units } = data.commands

  const create = useCommand(
    [QUERY_KEYS.units],
    ({ values, parentId, siblings }: { values: UnitFormValues & WithProperties; parentId: UnitId | null; siblings: readonly Unit[] }) =>
      units.create(toCreateUnitInput(values, parentId, siblings)),
  )

  const update = useCommand(
    [QUERY_KEYS.units],
    async ({ unit, openedVersion, values }: { unit: Unit; openedVersion: number; values: UnitFormValues & WithProperties }) => {
      const input = toUpdateUnitInput(unit, openedVersion, values)
      const unchanged: Result<Unit> = { ok: true, value: unit }
      return input === null ? unchanged : units.update(input)
    },
  )

  const archive = useCommand([QUERY_KEYS.units], ({ unit, openedVersion }: { unit: Unit; openedVersion: number }) =>
    units.archive({ id: unit.id, expected_version: openedVersion }),
  )

  const move = useCommand([QUERY_KEYS.units], ({ unit, parentId }: { unit: Unit; parentId: UnitId | null }) =>
    units.move({ id: unit.id, expected_version: unit.version, parent_id: parentId }),
  )

  const step = useCommand(
    [QUERY_KEYS.units],
    async ({ unit, direction, all }: { unit: Unit; direction: -1 | 1; all: readonly Unit[] }) => {
      const order = steppedOrder(siblingsUnder(all, unit.parent_id), unit.id, direction)
      const unchanged: Result<Unit[]> = { ok: true, value: [] }
      if (order === null) return unchanged
      return units.reorder({ items: order.map((row) => ({ id: row.id, expected_version: row.version })) })
    },
  )

  /** A move, then the position, when the unit should not stay last. Each is one transaction. */
  const drop = useCommand([QUERY_KEYS.units], async ({ unit, plan }: { unit: Unit; plan: UnitDropPlan }) => {
    let moved = unit
    if (plan.move !== null) {
      const result = await units.move({ id: unit.id, expected_version: unit.version, parent_id: plan.move.parent_id })
      if (!result.ok) return result
      moved = result.value
    }
    if (plan.order === null) {
      const done: Result<Unit[]> = { ok: true, value: [moved] }
      return done
    }
    return units.reorder({
      items: plan.order.map((row) => ({
        id: row.id,
        expected_version: row.id === moved.id ? moved.version : row.version,
      })),
    })
  })

  return { create, update, archive, move, step, drop }
}

export function useUnitLevelCommands() {
  const { data } = usePorts()
  const levels = data.commands.unit_levels

  const create = useCommand(
    [QUERY_KEYS.unitLevels],
    ({ name, existing }: { name: string; existing: readonly UnitLevel[] }) =>
      levels.create(toCreateUnitLevelInput(name, existing)),
  )
  const update = useCommand([QUERY_KEYS.unitLevels], (input: UpdateUnitLevelInput) => levels.update(input))
  const archive = useCommand([QUERY_KEYS.unitLevels], (level: UnitLevel) =>
    levels.archive({ id: level.id, expected_version: level.version }),
  )
  const reorder = useCommand([QUERY_KEYS.unitLevels], (order: readonly UnitLevel[]) =>
    levels.reorder({ items: order.map((level) => ({ id: level.id, expected_version: level.version })) }),
  )
  return { create, update, archive, reorder }
}

// ---------------------------------------------------------------------- hints

const check = (action: 'create' | 'update' | 'delete', target: PermissionCheck['target']): PermissionCheck => ({
  permission: { resource: 'units', action },
  target,
})

/** What the signed-in soldier may do in the tree, in the terms of D-089. */
export function useUnitPermissions(units: readonly Unit[]) {
  const checks = useMemo(
    () => [
      check('create', placementTarget(null)),
      check('update', placementTarget(null)),
      ...units.flatMap((unit) => [
        check('update', unitTarget(unit)),
        check('delete', unitTarget(unit)),
        check('create', placementTarget(unit.id)),
        check('update', placementTarget(unit.id)),
      ]),
    ],
    [units],
  )
  const can = useCan(checks)
  // One root unit (D-251): once it exists, a unit is made or moved under a parent, never beside it.
  return useMemo(() => {
    const rooted = units.some((unit) => unit.parent_id === null)
    const placeable = (parentId: UnitId | null) => parentId !== null || !rooted
    return {
      createUnder: (parentId: UnitId | null) => placeable(parentId) && can(check('create', placementTarget(parentId))),
      moveTo: (parentId: UnitId | null) => placeable(parentId) && can(check('update', placementTarget(parentId))),
      update: (unit: Unit) => can(check('update', unitTarget(unit))),
      archive: (unit: Unit) => can(check('delete', unitTarget(unit))),
      /** Every live sibling in sight. The command also counts the ones out of sight (D-089). */
      reorderAround: (unit: Unit) =>
        siblingsUnder(units, unit.parent_id).every((sibling) => can(check('update', unitTarget(sibling)))),
    }
  }, [can, units])
}

const LEVEL_CHECKS = {
  create: { permission: { resource: 'unit_levels', action: 'create' }, target: { kind: 'organization' } },
  update: { permission: { resource: 'unit_levels', action: 'update' }, target: { kind: 'organization' } },
  archive: { permission: { resource: 'unit_levels', action: 'delete' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const LEVEL_CHECK_LIST: readonly PermissionCheck[] = Object.values(LEVEL_CHECKS)

export function useUnitLevelPermissions() {
  const can = useCan(LEVEL_CHECK_LIST)
  return {
    create: can(LEVEL_CHECKS.create),
    update: can(LEVEL_CHECKS.update),
    archive: can(LEVEL_CHECKS.archive),
  }
}
