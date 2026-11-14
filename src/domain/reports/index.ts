import {
  CalendarDate,
  IssueCode,
  type ChangeSeq,
  type Deployment,
  type Issue,
  type Leave,
  type LeaveEvent,
  type Permission,
  type PolicyTarget,
  type ReportConfirmation,
  type UnitMembership,
  type UnitId,
} from '@contracts'
import { isAncestorOrSelf, type UnitTree } from '../hierarchy'
import { addDays, compareDates, compareInstants } from '../time'
import { isClosedRotation } from '../availability/deployments'

// The daily report workflow (D-269, D-293): each unit's report is confirmed per date, and whether it changed since is
// derived from the leave events and memberships numbered after the confirmation's `seen_seq` (D-373), never stored. Pure.

/** Confirming a unit's report for a date. */
export const CONFIRM_DAY_REPORT: Permission = { resource: 'day_reports', action: 'confirm' }

/** What confirming a unit's report is checked against: the unit, as a rotation's own unit is (D-293). */
export function dayReportTarget(unitId: UnitId): PolicyTarget {
  return { kind: 'unit', unit_id: unitId }
}

/** Where a unit's report of a date stands: confirmed, not yet, or confirmed and changed since (D-269). */
export type ConfirmationStatus = 'confirmed' | 'not_yet' | 'changed_since'

/** A leave of a section's soldier as the client read it, with its events read after the smallest `seen_seq`. */
export interface LeaveChanges {
  readonly leave: Pick<Leave, 'start_date' | 'end_date' | 'updated_at'>
  readonly events: readonly Pick<LeaveEvent, 'change_seq' | 'changes' | 'created_at'>[]
}

/** What may have changed a unit's section: its soldiers' leaves and the memberships in its unit, as read. */
export interface SectionChanges {
  readonly leaves: readonly LeaveChanges[]
  readonly memberships: readonly Pick<UnitMembership, 'change_seq' | 'valid_from'>[]
}

type Dates = { readonly start_date: CalendarDate; readonly end_date: CalendarDate }

/** The day before through the day after, as the day's leaving and returning read them (D-193). */
function touches(dates: Dates, date: CalendarDate): boolean {
  return compareDates(dates.start_date, addDays(date, 1)) <= 0 && compareDates(addDays(date, -1), dates.end_date) <= 0
}

/** A date field's value before an event, or the later value when the event did not change it. */
function dateBefore(event: LeaveChanges['events'][number], field: keyof Dates, later: CalendarDate): CalendarDate {
  const change = event.changes[field]
  if (change === undefined) return later
  const before = CalendarDate.safeParse(change.before)
  return before.success ? before.data : later
}

/**
 * Whether a leave changed the day after `seenSeq` (D-373): it has an event numbered after it, and in some state since,
 * its current dates or each earlier pair read back through the events, it touched the day or its neighbors. A leave
 * written after its events were read counts as changed: its walk back is not whole.
 */
export function leaveChangedSince(changes: LeaveChanges, date: CalendarDate, seenSeq: ChangeSeq): boolean {
  const events = [...changes.events].sort((a, b) => b.change_seq - a.change_seq)
  const latest = events[0]
  if (latest === undefined) return false
  if (compareInstants(changes.leave.updated_at, latest.created_at) > 0) return true
  let state: Dates = changes.leave
  let since = false
  for (const event of events) {
    if (event.change_seq <= seenSeq) break
    since = true
    if (touches(state, date)) return true
    state = {
      start_date: dateBefore(event, 'start_date', state.start_date),
      end_date: dateBefore(event, 'end_date', state.end_date),
    }
  }
  return since && touches(state, date)
}

/**
 * Whether a section changed after `seenSeq` (D-373): one of its soldiers' leaves did, or a membership in its unit that
 * starts on or before the day was written. A membership corrected in the past counts too: the rule leans to a false
 * positive, never a false negative.
 */
export function sectionChangedSince(changes: SectionChanges, date: CalendarDate, seenSeq: ChangeSeq): boolean {
  return (
    changes.memberships.some((row) => row.change_seq > seenSeq && compareDates(row.valid_from, date) <= 0) ||
    changes.leaves.some((leave) => leaveChangedSince(leave, date, seenSeq))
  )
}

/** A unit's report status: `not_yet` without a confirmation, `changed_since` when the section changed after it, else `confirmed`. */
export function confirmationStatus(
  confirmation: Pick<ReportConfirmation, 'seen_seq'> | null,
  changes: SectionChanges,
  date: CalendarDate,
): ConfirmationStatus {
  if (confirmation === null) return 'not_yet'
  return sectionChangedSince(changes, date, confirmation.seen_seq) ? 'changed_since' : 'confirmed'
}

type ReportRotation = Pick<Deployment, 'unit_id' | 'start_date' | 'end_date' | 'archived_at' | 'closed_at'>

/** The live rotation over the unit (its own unit or one above it) that runs on the date, if any (D-222, D-257). */
export function reportRotationOf<R extends ReportRotation>(
  rotations: readonly R[],
  tree: UnitTree,
  unitId: UnitId,
  date: CalendarDate,
): R | null {
  return (
    rotations.find(
      (rotation) =>
        rotation.archived_at === null &&
        compareDates(rotation.start_date, date) <= 0 &&
        (rotation.end_date === null || compareDates(date, rotation.end_date) <= 0) &&
        isAncestorOrSelf(tree, rotation.unit_id, unitId),
    ) ?? null
  )
}

/**
 * Whether a unit's report of a date may be confirmed: a live rotation over it runs on the date (`not_reportable`, D-222)
 * and is open (`rotation_closed`, D-258). Paths are the command's.
 */
export function confirmReportIssues(rotation: ReportRotation | null): Issue[] {
  if (rotation === null) return [{ path: ['report_date'], code: IssueCode.enum.not_reportable }]
  return isClosedRotation(rotation) ? [{ path: ['report_date'], code: IssueCode.enum.rotation_closed }] : []
}
