import { LeaveStatus, type CalendarDate, type Leave, type LeaveId, type LeaveTypeId } from '@contracts'
import { daysTally } from '../availability/tally'
import { addDays, compareDates, daysBetween, eachDay, rangeCovers, spanCovers, type DateSpan } from '../time'

// "הסבב שלי" (D-350): one soldier's own figures over their rotation. Nothing of it is stored (P-10).

/** A leave that sends the soldier home: approved, of an `unavailable` effect (the caller resolves the effect, D-032). */
export type HomeLeave = Pick<Leave, 'id' | 'leave_type_id' | 'start_date' | 'end_date'>

/** A leave of the soldier, read for their requests. */
export type MyLeave = Pick<Leave, 'id' | 'soldier_id' | 'created_by' | 'leave_type_id' | 'status'>

export interface MyRotationInput {
  readonly rotation: { readonly start_date: CalendarDate; readonly end_date: CalendarDate | null }
  /** The soldier's served spans in the rotation (`daysOf`, D-336). */
  readonly served: readonly DateSpan[]
  readonly today: CalendarDate
  /** The soldier's approved leaves of an `unavailable` effect. */
  readonly homeLeaves: readonly HomeLeave[]
  /** The soldier's leaves in the rotation, for their requests. */
  readonly leaves: readonly MyLeave[]
  /** Whether a type makes a leave a request: not in the "סבב יציאות" group (D-345). */
  readonly isRequestType: (type: LeaveTypeId) => boolean
}

/** Days so far against the planned ones; `planned` is null when the rotation has no end. */
export interface SoFar {
  readonly sofar: number
  readonly planned: number | null
}

export type NextLeave =
  | { readonly kind: 'home'; readonly until: CalendarDate }
  | {
      readonly kind: 'next'
      readonly leaveId: LeaveId
      readonly typeId: LeaveTypeId
      readonly start: CalendarDate
      readonly end: CalendarDate
      readonly inDays: number
    }
  | { readonly kind: 'none' }

export type RotationLeft =
  | { readonly kind: 'left'; readonly days: number; readonly lastDay: CalendarDate; readonly elapsed: number; readonly total: number }
  | { readonly kind: 'starts'; readonly date: CalendarDate }

export interface MyRotationFigures {
  /** All served days of the rotation; null when it has no end. */
  readonly total: number | null
  readonly base: SoFar
  readonly home: SoFar
  readonly openRequests: number
  /** Approved ÷ decided requests; null when none is decided. */
  readonly approvalRate: number | null
  readonly next: NextLeave
  /** Null when the rotation has no end. */
  readonly left: RotationLeft | null
}

/** The figures of "הסבב שלי" (D-350). */
export function myRotationFigures(input: MyRotationInput): MyRotationFigures {
  const { rotation, served, today, homeLeaves } = input
  const serves = (day: CalendarDate) => served.some((span) => spanCovers(span, day))
  const coveringOf = (day: CalendarDate) => homeLeaves.find((leave) => rangeCovers(leave, day))
  const atHome = (day: CalendarDate) => coveringOf(day) !== undefined
  const begun = compareDates(today, rotation.start_date) >= 0
  const lastSoFar = rotation.end_date !== null && compareDates(rotation.end_date, today) < 0 ? rotation.end_date : today
  const soFarDays = begun ? eachDay({ start_date: rotation.start_date, end_date: lastSoFar }) : []
  const soFar = daysTally(soFarDays, serves, atHome)
  const allDays = rotation.end_date === null ? null : eachDay({ start_date: rotation.start_date, end_date: rotation.end_date })
  const whole = allDays === null ? null : daysTally(allDays, serves, atHome)

  const requests = input.leaves.filter((leave) => leave.created_by === leave.soldier_id && input.isRequestType(leave.leave_type_id))
  const approved = requests.filter((leave) => leave.status === LeaveStatus.enum.approved).length
  const rejected = requests.filter((leave) => leave.status === LeaveStatus.enum.rejected).length
  const decided = approved + rejected

  return {
    total: whole?.served ?? null,
    base: { sofar: soFar.base, planned: whole?.base ?? null },
    home: { sofar: soFar.home, planned: whole?.home ?? null },
    openRequests: requests.filter((leave) => leave.status === LeaveStatus.enum.pending).length,
    approvalRate: decided === 0 ? null : approved / decided,
    next: nextLeave(input, serves, coveringOf),
    left: allDays === null ? null : rotationLeft(allDays, begun, rotation.start_date, today, serves),
  }
}

function nextLeave(
  input: MyRotationInput,
  serves: (day: CalendarDate) => boolean,
  coveringOf: (day: CalendarDate) => HomeLeave | undefined,
): NextLeave {
  const { rotation, today, homeLeaves } = input
  const lastLeaveDay = homeLeaves.map((leave) => leave.end_date).sort(compareDates).at(-1)
  const end = rotation.end_date ?? lastLeaveDay
  if (end === undefined) return { kind: 'none' }
  const isHome = (day: CalendarDate) => serves(day) && coveringOf(day) !== undefined
  if (compareDates(today, rotation.start_date) >= 0 && compareDates(today, end) <= 0 && isHome(today)) {
    let until = today
    while (compareDates(until, end) < 0 && isHome(addDays(until, 1))) until = addDays(until, 1)
    return { kind: 'home', until }
  }
  const from = compareDates(today, rotation.start_date) < 0 ? rotation.start_date : addDays(today, 1)
  if (compareDates(from, end) > 0) return { kind: 'none' }
  for (const day of eachDay({ start_date: from, end_date: end })) {
    const leave = serves(day) ? coveringOf(day) : undefined
    if (leave === undefined) continue
    return {
      kind: 'next',
      leaveId: leave.id,
      typeId: leave.leave_type_id,
      start: day,
      end: leave.end_date,
      inDays: daysBetween(today, day),
    }
  }
  return { kind: 'none' }
}

function rotationLeft(
  days: readonly CalendarDate[],
  begun: boolean,
  start: CalendarDate,
  today: CalendarDate,
  serves: (day: CalendarDate) => boolean,
): RotationLeft | null {
  if (!begun) return { kind: 'starts', date: start }
  const servedDays = days.filter(serves)
  const lastDay = servedDays.at(-1)
  if (lastDay === undefined) return null
  const elapsed = servedDays.filter((day) => compareDates(day, today) <= 0).length
  return { kind: 'left', days: servedDays.length - elapsed, lastDay, elapsed, total: servedDays.length }
}
