import { DATE_LOCALE } from '@config'
import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  Soldier,
  SoldierId,
  Unit,
  UnitId,
  UnitMembership,
} from '@contracts'
import { MembershipType } from '@contracts'
import { normalizeName, primaryUnitOn } from '@domain'

// The roster as the drawer shows it. Rank and unit today are derived on every read, never stored
// (D-019, D-054). Pure.

/** A soldier's unit on a day, as far as the actor can know it (D-106). */
export type UnitState =
  | { readonly kind: 'unit'; readonly unit: Unit }
  /** The actor reads the soldier's placements, and none covers the day. */
  | { readonly kind: 'none' }
  /** A placement covers the day, in a unit the actor cannot see. */
  | { readonly kind: 'other' }
  /** No day, or the actor may not read the soldier's placements. */
  | { readonly kind: 'unknown' }

export interface SoldierRow {
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** The primary unit today (D-106). */
  readonly unitState: UnitState
  /** The unit today, when it is one the actor sees. Replaced by `unitState`, removed once the list reads it. */
  readonly unit: Unit | null
  /** The open primary row, which the next move closes. It can start in the future (D-097). */
  readonly open: UnitMembership | null
}

/** Whether the actor may read a soldier's placements (`memberships:view`, D-102). */
export type ReadsPlacements = (soldierId: SoldierId) => boolean

/**
 * The soldier's unit on `day`. `own` holds the soldier's placements the actor read: the adapter returns
 * all of them or none (D-102), so a soldier with rows is readable whatever the hint says.
 */
export function unitStateOn(
  own: readonly UnitMembership[],
  unitById: ReadonlyMap<UnitId, Unit>,
  soldierId: SoldierId,
  day: CalendarDate | null,
  readsPlacements: boolean,
): UnitState {
  if (day === null || (own.length === 0 && !readsPlacements)) return { kind: 'unknown' }
  const unitId = primaryUnitOn(own, soldierId, day)
  if (unitId === null) return { kind: 'none' }
  const unit = unitById.get(unitId)
  return unit === undefined ? { kind: 'other' } : { kind: 'unit', unit }
}

/** The actor's memberships grouped by soldier. */
export function membershipsBySoldier(memberships: readonly UnitMembership[]): Map<SoldierId, UnitMembership[]> {
  const bySoldier = new Map<SoldierId, UnitMembership[]>()
  for (const row of memberships) bySoldier.set(row.soldier_id, [...(bySoldier.get(row.soldier_id) ?? []), row])
  return bySoldier
}

const collator = new Intl.Collator(DATE_LOCALE)

/** Last name, then first name, in Hebrew order (D-094). */
export function byName(a: Soldier, b: Soldier): number {
  return collator.compare(a.last_name, b.last_name) || collator.compare(a.first_name, b.first_name) || a.id.localeCompare(b.id)
}

export function openMembershipOf(memberships: readonly UnitMembership[], soldierId: SoldierId): UnitMembership | null {
  return (
    memberships.find(
      (row) =>
        row.soldier_id === soldierId && row.membership_type === MembershipType.enum.primary && row.valid_to === null,
    ) ?? null
  )
}

export function soldierRows(
  soldiers: readonly Soldier[],
  ranks: readonly CommandRank[],
  units: readonly Unit[],
  memberships: readonly UnitMembership[],
  today: CalendarDate | null,
  readsPlacements: ReadsPlacements = () => false,
): SoldierRow[] {
  const rankById = new Map<CommandRankId, CommandRank>(ranks.map((rank) => [rank.id, rank]))
  const unitById = new Map<UnitId, Unit>(units.map((unit) => [unit.id, unit]))
  const bySoldier = membershipsBySoldier(memberships)

  return [...soldiers].sort(byName).map((soldier) => {
    const own = bySoldier.get(soldier.id) ?? []
    const unitState = unitStateOn(own, unitById, soldier.id, today, readsPlacements(soldier.id))
    return {
      soldier,
      rank: soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null),
      unitState,
      unit: unitState.kind === 'unit' ? unitState.unit : null,
      open: openMembershipOf(own, soldier.id),
    }
  })
}

/** Matches like account linking does: no niqqud, final letters as regular ones (D-066, D-094). */
export function matchesName(soldier: Soldier, query: string): boolean {
  const wanted = normalizeName(query)
  if (wanted === '') return true
  const names = [
    `${soldier.first_name} ${soldier.last_name}`,
    `${soldier.last_name} ${soldier.first_name}`,
    soldier.nickname ?? '',
  ]
  return names.some((name) => normalizeName(name).includes(wanted))
}

export function fullName(soldier: Pick<Soldier, 'first_name' | 'last_name'>): string {
  return `${soldier.first_name} ${soldier.last_name}`
}

/** What a history line shows about its unit (D-099). */
export type HistoryUnit =
  | { readonly kind: 'live'; readonly name: string }
  | { readonly kind: 'archived'; readonly name: string }
  /** A unit the actor cannot see. */
  | { readonly kind: 'hidden' }

export interface HistoryEntry {
  readonly membership: UnitMembership
  readonly unit: HistoryUnit
}

/** The soldier's placements, newest first. `units` holds archived ones too. */
export function soldierHistory(
  memberships: readonly UnitMembership[],
  units: readonly Unit[],
  soldierId: SoldierId,
): HistoryEntry[] {
  const unitById = new Map<UnitId, Unit>(units.map((unit) => [unit.id, unit]))
  return memberships
    .filter((row) => row.soldier_id === soldierId)
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from) || a.id.localeCompare(b.id))
    .map((membership) => {
      const unit = unitById.get(membership.unit_id)
      if (unit === undefined) return { membership, unit: { kind: 'hidden' } }
      return { membership, unit: { kind: unit.archived_at === null ? 'live' : 'archived', name: unit.name } }
    })
}

export function liveRanks(ranks: readonly CommandRank[]): CommandRank[] {
  return ranks.filter((rank) => rank.archived_at === null)
}
