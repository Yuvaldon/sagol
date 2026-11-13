import type { CalendarDate, Leave, ReportConfirmation, SoldierId, Timestamp, UnitId } from '@contracts'
import { addDays, compareDates, confirmationStatus, isAncestorOrSelf, type ConfirmationStatus, type UnitTree } from '@domain'
import type { ReportDay, ReportSection } from './report'

// The daily report workflow (D-269, D-293): where each unit's section of a day stands, who may confirm it, and the
// summary the report's owner reads. Pure; the hook feeds it.

export interface SectionConfirmation {
  readonly unitId: UnitId
  readonly status: ConfirmationStatus
  /**
   * Whether the actor may confirm it now: the data layer's answer (the permission on the unit, and an open rotation over
   * it on the day), and the whole section in view.
   */
  readonly canConfirm: boolean
  /** The actor may confirm it, but the view filter hides some of its soldiers: confirming needs the full list (D-293). */
  readonly needsFullList: boolean
}

export interface ConfirmationSummary {
  /** The unit sections of the day that a rotation covers. */
  readonly total: number
  readonly confirmed: number
  readonly changed: number
}

export interface DayConfirmations {
  /**
   * By the section's key. A section with no unit (D-106) has none, nor one that no rotation of the day covers, unless
   * the actor may confirm it or a confirmation of it stands: there is no report of it to confirm (D-293).
   */
  readonly sections: ReadonlyMap<string, SectionConfirmation>
  /** NULL where the actor does not read the summary: not the owner, nor, with no owner named, a confirmer. */
  readonly summary: ConfirmationSummary | null
  /**
   * The latest write among the leaves the statuses come from, as the server stamped it: a confirmation sent from this
   * view holds from then, with no reliance on the client's clock.
   */
  readonly seenAt: Timestamp
}

export interface DayConfirmationsInput {
  /** The day's whole report, with no view filter: what a section's status and the summary are read on (D-293). */
  readonly day: ReportDay
  /** The same day as the view filter shows it. */
  readonly shown: ReportDay
  /** The confirmations the actor reads of the day. */
  readonly confirmations: readonly ReportConfirmation[]
  /** The leaves of every status the actor reads that touch the day before through the day after. */
  readonly leaves: readonly Leave[]
  /** Whether the actor may confirm the unit's report of the day, as the data layer answers it on the whole tree. */
  readonly confirmable: (unitId: UnitId, date: CalendarDate) => boolean
  /** The permission on a rotation's unit, for who reads the summary where no owner is named. */
  readonly mayConfirm: (unitId: UnitId) => boolean
  /** The live units' tree, for the units a rotation of the day covers. */
  readonly tree: UnitTree
  readonly actorId: SoldierId | null
  readonly seenAt: Timestamp
}

/**
 * When each leave that bears on a section's day was last written: its soldiers' leaves, of any status, that touch the
 * day or its neighbors, as the day's leaving and returning read them (D-193).
 */
function changedAtOf(section: ReportSection, date: CalendarDate, leaves: readonly Leave[]): Timestamp[] {
  const soldiers = soldiersOf(section)
  const before = addDays(date, -1)
  const after = addDays(date, 1)
  return leaves
    .filter(
      (leave) =>
        soldiers.has(leave.soldier_id) && compareDates(leave.start_date, after) <= 0 && compareDates(before, leave.end_date) <= 0,
    )
    .map((leave) => leave.updated_at)
}

function soldiersOf(section: ReportSection): ReadonlySet<SoldierId> {
  return new Set<SoldierId>([...section.present, ...section.absent].map((entry) => entry.soldier.id))
}

export function dayConfirmations(input: DayConfirmationsInput): DayConfirmations {
  const { day } = input
  const shown = new Map(input.shown.units.map((section) => [section.key, section] as const))
  const byUnit = new Map(
    input.confirmations.filter((row) => row.report_date === day.date).map((row) => [row.unit_id, row] as const),
  )
  const sections = new Map<string, SectionConfirmation>()
  for (const section of day.units) {
    const unitId = section.unitId
    if (unitId === null) continue
    const confirmable = input.confirmable(unitId, day.date)
    const row = byUnit.get(unitId) ?? null
    const covered = day.rotations.some((rotation) => isAncestorOrSelf(input.tree, rotation.unit_id, unitId))
    if (!confirmable && row === null && !covered) continue
    const inView = shown.get(section.key)
    const hidden = inView !== undefined && soldiersOf(inView).size < soldiersOf(section).size
    sections.set(section.key, {
      unitId,
      status: confirmationStatus(row, changedAtOf(section, day.date, input.leaves)),
      canConfirm: confirmable && !hidden,
      needsFullList: confirmable && hidden,
    })
  }
  const reads = day.rotations.some((rotation) =>
    rotation.report_owner_id === null ? input.mayConfirm(rotation.unit_id) : rotation.report_owner_id === input.actorId,
  )
  const statuses = [...sections.values()].map((section) => section.status)
  return {
    sections,
    summary: reads
      ? {
          total: statuses.length,
          confirmed: statuses.filter((status) => status === 'confirmed').length,
          changed: statuses.filter((status) => status === 'changed_since').length,
        }
      : null,
    seenAt: input.seenAt,
  }
}
