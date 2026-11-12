import type { CalendarDate, Deployment, Leave, ReportConfirmation, SoldierId, Timestamp, UnitId } from '@contracts'
import {
  addDays,
  compareDates,
  confirmationStatus,
  confirmReportIssues,
  reportRotationOf,
  type ConfirmationStatus,
  type UnitTree,
} from '@domain'
import type { ReportDay, ReportSection } from './report'

// The daily report workflow (D-269, D-293): where each unit's section of a day stands, who may confirm it, and the
// summary the report's owner reads. Pure; the hook feeds it.

export interface SectionConfirmation {
  readonly unitId: UnitId
  readonly status: ConfirmationStatus
  /** Whether the actor may confirm it now: the permission on the unit, and an open rotation over it on the day. */
  readonly canConfirm: boolean
}

export interface ConfirmationSummary {
  /** The unit sections of the day. */
  readonly total: number
  readonly confirmed: number
  readonly changed: number
}

export interface DayConfirmations {
  /** By the section's key; a section with no unit (D-106) has none. */
  readonly sections: ReadonlyMap<string, SectionConfirmation>
  /** NULL where the actor does not read the summary: not the owner, nor, with no owner named, a confirmer. */
  readonly summary: ConfirmationSummary | null
}

export interface DayConfirmationsInput {
  readonly day: ReportDay
  /** The confirmations the actor reads of the day. */
  readonly confirmations: readonly ReportConfirmation[]
  /** The leaves of every status the actor reads that touch the day before through the day after. */
  readonly leaves: readonly Leave[]
  /** The live units, for which rotation runs over a section's unit. */
  readonly tree: UnitTree
  /** The scope's rotations, closed ones too: a closed one blocks a confirmation and still names its owner. */
  readonly rotations: readonly Deployment[]
  readonly mayConfirm: (unitId: UnitId) => boolean
  readonly actorId: SoldierId | null
}

/**
 * When each leave that bears on a section's day was last written: its soldiers' leaves, of any status, that touch the
 * day or its neighbors, as the day's leaving and returning read them (D-193).
 */
function changedAtOf(section: ReportSection, date: CalendarDate, leaves: readonly Leave[]): Timestamp[] {
  const soldiers = new Set<SoldierId>([...section.present, ...section.absent].map((entry) => entry.soldier.id))
  const before = addDays(date, -1)
  const after = addDays(date, 1)
  return leaves
    .filter(
      (leave) =>
        soldiers.has(leave.soldier_id) && compareDates(leave.start_date, after) <= 0 && compareDates(before, leave.end_date) <= 0,
    )
    .map((leave) => leave.updated_at)
}

export function dayConfirmations(input: DayConfirmationsInput): DayConfirmations {
  const { day, tree, rotations } = input
  const byUnit = new Map(
    input.confirmations.filter((row) => row.report_date === day.date).map((row) => [row.unit_id, row] as const),
  )
  const sections = new Map<string, SectionConfirmation>()
  for (const section of day.units) {
    const unitId = section.unitId
    if (unitId === null) continue
    const rotation = reportRotationOf(rotations, tree, unitId, day.date)
    sections.set(section.key, {
      unitId,
      status: confirmationStatus(byUnit.get(unitId) ?? null, changedAtOf(section, day.date, input.leaves)),
      canConfirm: confirmReportIssues(rotation).length === 0 && input.mayConfirm(unitId),
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
  }
}
