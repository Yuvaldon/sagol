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

export interface SoldierRow {
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** The primary unit today. NULL when the actor cannot see a placement or the unit. */
  readonly unit: Unit | null
  /** The open primary row, which the next move closes. It can start in the future (D-097). */
  readonly open: UnitMembership | null
}

const collator = new Intl.Collator(DATE_LOCALE)

/** Last name, then first name, in Hebrew order (D-094). */
function byName(a: Soldier, b: Soldier): number {
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
): SoldierRow[] {
  const rankById = new Map<CommandRankId, CommandRank>(ranks.map((rank) => [rank.id, rank]))
  const unitById = new Map<UnitId, Unit>(units.map((unit) => [unit.id, unit]))
  const bySoldier = new Map<SoldierId, UnitMembership[]>()
  for (const row of memberships) bySoldier.set(row.soldier_id, [...(bySoldier.get(row.soldier_id) ?? []), row])

  return [...soldiers].sort(byName).map((soldier) => {
    const own = bySoldier.get(soldier.id) ?? []
    const unitId = today === null ? null : primaryUnitOn(own, soldier.id, today)
    return {
      soldier,
      rank: soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null),
      unit: unitId === null ? null : (unitById.get(unitId) ?? null),
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
