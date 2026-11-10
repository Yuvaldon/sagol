import type {
  CommandRank,
  Permission,
  PermissionCheck,
  PolicyTarget,
  Result,
  Soldier,
  SoldierId,
  SoldierPrivate,
  Unit,
  UnitId,
  UnitMembership,
} from '@contracts'
import { placementTarget, soldierTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useCan, useCanAnswers } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import {
  toChangeMembershipInput,
  toCreateRankInput,
  toCreateSoldierInput,
  toUpdatePrivateInput,
  toUpdateRankInput,
  toUpdateSoldierInput,
  type MoveFormValues,
  type NewSoldierValues,
  type PrivateFormValues,
  type RankFormValues,
  type SoldierFormValues,
} from './forms'

// Reading and changing the roster, in the terms of D-096.

const LIVE = { include_archived: false }
const WITH_ARCHIVED = { include_archived: true }
const EVERY_MEMBERSHIP = { soldier_ids: null, unit_ids: null, window: null }

/** Every rank, archived ones too: a soldier keeps showing the rank they hold. */
export function useCommandRanks(): Loaded<readonly CommandRank[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.commandRanks, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.command_ranks.list(WITH_ARCHIVED)),
    }),
  )
}

export function useSoldiers(): Loaded<readonly Soldier[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldiers, LIVE],
      queryFn: () => unwrap(data.repositories.soldiers.list(LIVE)),
    }),
  )
}

/** Soldiers archived ones too, for names in a leave's history (D-119), as units keep theirs (D-099). */
export function useSoldiersWithArchived(): Loaded<readonly Soldier[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldiers, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.soldiers.list(WITH_ARCHIVED)),
    }),
  )
}

/** Every membership the actor may read: the list needs today's unit, a soldier's page the history. */
export function useMemberships(): Loaded<readonly UnitMembership[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.unitMemberships, EVERY_MEMBERSHIP],
      queryFn: () => unwrap(data.repositories.unit_memberships.list(EVERY_MEMBERSHIP)),
    }),
  )
}

/** Units archived ones too, for names in a soldier's history (D-099). */
export function useUnitsWithArchived(): Loaded<readonly Unit[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.units, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.units.list(WITH_ARCHIVED)),
    }),
  )
}

/** NULL until the first private field is saved. Asks only when the actor may read it (D-018). */
export function useSoldierPrivate(soldierId: SoldierId, enabled: boolean): Loaded<SoldierPrivate | null> {
  const { data } = usePorts()
  const query = { soldier_ids: [soldierId] }
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldierPrivate, query],
      queryFn: async () => (await unwrap(data.repositories.soldier_private.list(query)))[0] ?? null,
      enabled,
    }),
  )
}

export function useCommandRankCommands() {
  const { data } = usePorts()
  const ranks = data.commands.command_ranks
  const keys = [QUERY_KEYS.commandRanks]
  const create = useCommand(keys, (values: RankFormValues) => ranks.create(toCreateRankInput(values)))
  const update = useCommand(
    keys,
    async ({ rank, openedVersion, values }: { rank: CommandRank; openedVersion: number; values: RankFormValues }) => {
      const input = toUpdateRankInput(rank, openedVersion, values)
      const unchanged: Result<CommandRank> = { ok: true, value: rank }
      return input === null ? unchanged : ranks.update(input)
    },
  )
  const archive = useCommand(keys, (rank: CommandRank) => ranks.archive({ id: rank.id, expected_version: rank.version }))
  return { create, update, archive }
}

export function useSoldierCommands() {
  const { data } = usePorts()
  const { soldiers } = data.commands

  const create = useCommand(
    [QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    (values: NewSoldierValues) => soldiers.create(toCreateSoldierInput(values)),
  )
  const update = useCommand(
    [QUERY_KEYS.soldiers],
    async ({ soldier, openedVersion, values }: { soldier: Soldier; openedVersion: number; values: SoldierFormValues }) => {
      const input = toUpdateSoldierInput(soldier, openedVersion, values)
      const unchanged: Result<Soldier> = { ok: true, value: soldier }
      return input === null ? unchanged : soldiers.update(input)
    },
  )
  const archive = useCommand([QUERY_KEYS.soldiers], (soldier: Soldier) =>
    soldiers.archive({ id: soldier.id, expected_version: soldier.version }),
  )
  const updatePrivate = useCommand(
    [QUERY_KEYS.soldierPrivate],
    async ({ soldierId, opened, values }: { soldierId: SoldierId; opened: SoldierPrivate | null; values: PrivateFormValues }) => {
      const input = toUpdatePrivateInput(soldierId, opened, values)
      const unchanged: Result<SoldierPrivate | null> = { ok: true, value: opened }
      return input === null ? unchanged : soldiers.updatePrivate(input)
    },
  )
  const move = useCommand(
    [QUERY_KEYS.unitMemberships],
    ({ soldierId, open, values }: { soldierId: SoldierId; open: UnitMembership | null; values: MoveFormValues }) =>
      soldiers.changeMembership(toChangeMembershipInput(soldierId, open, values)),
  )
  return { create, update, archive, updatePrivate, move }
}

// ---------------------------------------------------------------------- hints

const P = {
  rankCreate: { resource: 'command_ranks', action: 'create' },
  rankUpdate: { resource: 'command_ranks', action: 'update' },
  rankArchive: { resource: 'command_ranks', action: 'delete' },
  soldierCreate: { resource: 'soldiers', action: 'create' },
  soldierUpdate: { resource: 'soldiers', action: 'update' },
  soldierArchive: { resource: 'soldiers', action: 'delete' },
  privateView: { resource: 'soldier_private', action: 'view' },
  privateUpdate: { resource: 'soldier_private', action: 'update' },
  membershipView: { resource: 'memberships', action: 'view' },
  membershipUpdate: { resource: 'memberships', action: 'update' },
} as const satisfies Record<string, Permission>

const check = (permission: Permission, target: PolicyTarget): PermissionCheck => ({ permission, target })

const ORGANIZATION: PolicyTarget = { kind: 'organization' }

const RANK_CHECKS = {
  create: check(P.rankCreate, ORGANIZATION),
  update: check(P.rankUpdate, ORGANIZATION),
  archive: check(P.rankArchive, ORGANIZATION),
} as const

const RANK_CHECK_LIST: readonly PermissionCheck[] = Object.values(RANK_CHECKS)

export function useCommandRankPermissions() {
  const can = useCan(RANK_CHECK_LIST)
  return { create: can(RANK_CHECKS.create), update: can(RANK_CHECKS.update), archive: can(RANK_CHECKS.archive) }
}

const unitAsTarget = (unitId: UnitId): PolicyTarget => ({ kind: 'unit', unit_id: unitId })

/** What the list needs: a menu and a form per row, and where a new soldier may be placed (D-096). */
export function useRosterPermissions(soldiers: readonly Soldier[], units: readonly Unit[]) {
  const checks = useMemo(
    () => [
      check(P.soldierCreate, placementTarget(null)),
      check(P.privateUpdate, placementTarget(null)),
      ...units.flatMap((unit) => [
        check(P.soldierCreate, placementTarget(unit.id)),
        check(P.membershipUpdate, unitAsTarget(unit.id)),
        check(P.privateUpdate, placementTarget(unit.id)),
      ]),
      ...soldiers.flatMap((soldier) => [
        check(P.soldierUpdate, soldierTarget(soldier.id)),
        check(P.soldierArchive, soldierTarget(soldier.id)),
        check(P.membershipView, soldierTarget(soldier.id)),
      ]),
    ],
    [soldiers, units],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const placeIn = (unitId: UnitId) =>
      can(check(P.soldierCreate, placementTarget(unitId))) && can(check(P.membershipUpdate, unitAsTarget(unitId)))
    const createWithoutUnit = can(check(P.soldierCreate, placementTarget(null)))
    return {
      createWithoutUnit,
      placeIn,
      /** Any way to add a soldier at all. */
      create: createWithoutUnit || units.some((unit) => placeIn(unit.id)),
      /** Whether the new form offers private fields for this placement. */
      privateOnCreate: (unitId: UnitId | null) => can(check(P.privateUpdate, placementTarget(unitId))),
      update: (soldier: Soldier) => can(check(P.soldierUpdate, soldierTarget(soldier.id))),
      archive: (soldier: Soldier) => can(check(P.soldierArchive, soldierTarget(soldier.id))),
      /** Whether "no unit" is known or only unknown (D-106). */
      readsPlacements: (soldierId: SoldierId) => can(check(P.membershipView, soldierTarget(soldierId))),
    }
  }, [can, units])
}

/** Whether the actor may read each soldier's placements (D-102, D-106). */
export function usePlacementReading(soldiers: readonly Soldier[]): (soldierId: SoldierId) => boolean {
  return usePlacementHints(soldiers).reads
}

/**
 * The same, with whether every soldier's hint has answered. What a row says about its unit waits for that, so
 * "unknown" is never said before the adapter has spoken (D-122).
 */
export function usePlacementHints(soldiers: readonly Soldier[]) {
  const checks = useMemo(() => soldiers.map((soldier) => check(P.membershipView, soldierTarget(soldier.id))), [soldiers])
  const { can, known } = useCanAnswers(checks)
  const reads = useCallback((soldierId: SoldierId) => can(check(P.membershipView, soldierTarget(soldierId))), [can])
  const settled = useMemo(() => checks.every(known), [checks, known])
  return useMemo(() => ({ reads, settled }), [reads, settled])
}

/** What one soldier's page needs (D-096). */
export function useSoldierPagePermissions(soldier: Soldier, units: readonly Unit[]) {
  const target = useMemo(() => soldierTarget(soldier.id), [soldier.id])
  const checks = useMemo(
    () => [
      check(P.soldierUpdate, target),
      check(P.privateView, target),
      check(P.privateUpdate, target),
      check(P.membershipView, target),
      check(P.membershipUpdate, target),
      ...units.map((unit) => check(P.membershipUpdate, unitAsTarget(unit.id))),
    ],
    [target, units],
  )
  const can = useCan(checks)
  const viewPrivate = can(check(P.privateView, target))
  return {
    update: can(check(P.soldierUpdate, target)),
    viewPrivate,
    /** Writing needs reading, because the answer holds the values (D-096). */
    updatePrivate: viewPrivate && can(check(P.privateUpdate, target)),
    viewMemberships: can(check(P.membershipView, target)),
    move: can(check(P.membershipUpdate, target)),
    moveTo: (unitId: UnitId) => can(check(P.membershipUpdate, unitAsTarget(unitId))),
  }
}
