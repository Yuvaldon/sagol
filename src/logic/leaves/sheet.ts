import { LEAVE_SHEET } from '@config'
import {
  CreateLeavesInput,
  IssueCode,
  LeaveId,
  LeaveStatus,
  type AvailabilityRuleId,
  type CalendarDate,
  type CreateLeaveInput,
  type Issue,
  type LeaveType,
  type LeaveTypeId,
  type SoldierId,
} from '@contracts'
import { addDays, compareDates, daysBetween, leaveReasonIssues, optionalText } from '@domain'
import { formIssues } from '../forms/issues'
import type { WithProperties } from '../properties/properties'
import type { NewLeaveDraft } from '../view-state/draft'
import type { LeaveCandidate } from './forms'
import type { RequestRotation } from './rotation'

// The request sheet (D-275): one soldier, then rows, sent at once through `leaves.createMany`. A recurring row expands
// into its leaves here, when the sheet is judged and when it is sent; only the leaves are stored (D-019). Ids are
// generated here (D-044), and a blank reason is NULL, as the command stores it (D-101).

export interface LeaveSheetRow {
  /** The row's own key in the list, so a removed row takes its fields with it. Never sent. */
  readonly key: string
  readonly leave_type_id: LeaveTypeId | null
  /** '' while the field is empty; the schema then answers. */
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  readonly reason: string
  /** The row repeats its days every `every_days`, up to `until`. */
  readonly repeats: boolean
  readonly every_days: number
  readonly until: CalendarDate | ''
}

export interface LeaveSheetValues {
  readonly soldier_id: SoldierId | null
  readonly rows: LeaveSheetRow[]
  /** Shown only to who may approve the soldier (D-013). */
  readonly as_approved: boolean
}

/** A new row: today, or the days given, once, of no type yet. */
export function newSheetRow(start: CalendarDate | '', end: CalendarDate | '' = start): LeaveSheetRow {
  return {
    key: crypto.randomUUID(),
    leave_type_id: null,
    start_date: start,
    end_date: end,
    reason: '',
    repeats: false,
    every_days: LEAVE_SHEET.defaultEveryDays,
    until: '',
  }
}

/**
 * A new sheet: one row. "Approve now" starts from the actor's own default (D-121). A drag's draft fills the soldier and
 * the first row's days (D-143); `onlySoldier` is the one soldier the sheet offers, prefilled (D-167).
 */
export function newLeaveSheetValues(
  today: CalendarDate,
  approveNow = false,
  draft: NewLeaveDraft | null = null,
  onlySoldier: SoldierId | null = null,
): LeaveSheetValues {
  return {
    soldier_id: draft?.soldier_id ?? onlySoldier,
    rows: [newSheetRow(draft?.start_date ?? today, draft?.end_date ?? today)],
    as_approved: approveNow,
  }
}

/** The days of one leave a row yields. */
interface SheetDays {
  /** The row it came from, so its issues land there. */
  readonly row: number
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
}

/**
 * The days a row yields: its own, then, when it repeats, the same days moved by `every_days` while they start on or
 * before `until`. A repetition that is not yet valid yields the row's own days only, and its issues say why.
 */
export function rowDays(row: LeaveSheetRow, index: number): SheetDays[] {
  const first: SheetDays = { row: index, start_date: row.start_date, end_date: row.end_date }
  if (!row.repeats || repeatIssues(row).length > 0 || row.start_date === '' || row.end_date === '' || row.until === '') return [first]
  const length = daysBetween(row.start_date, row.end_date)
  const days: SheetDays[] = []
  // Bounded past the sheet's limit, so the count's issue is still raised without walking an endless rhythm.
  for (let start = row.start_date; compareDates(start, row.until) <= 0 && days.length <= LEAVE_SHEET.maxLeaves; start = addDays(start, row.every_days)) {
    days.push({ row: index, start_date: start, end_date: addDays(start, length) })
  }
  return days
}

/** Every leave's days in the sheet, row by row. */
export function sheetDays(values: Pick<LeaveSheetValues, 'rows'>): SheetDays[] {
  return values.rows.flatMap((row, index) => rowDays(row, index))
}

/**
 * A repetition's own issues: a whole number of days, no fewer than the leave's own days (a leave does not cover the one
 * before it) and within the sheet's limit, and a last date on or after the start.
 */
function repeatIssues(row: LeaveSheetRow): Issue[] {
  if (!row.repeats) return []
  const issues: Issue[] = []
  const at = (field: string): Issue['path'] => [field]
  const shortest =
    row.start_date === '' || row.end_date === '' || compareDates(row.start_date, row.end_date) > 0
      ? LEAVE_SHEET.minEveryDays
      : Math.max(LEAVE_SHEET.minEveryDays, daysBetween(row.start_date, row.end_date) + 1)
  if (!Number.isInteger(row.every_days)) issues.push({ path: at('every_days'), code: IssueCode.enum.not_integer })
  else if (row.every_days < shortest) issues.push({ path: at('every_days'), code: IssueCode.enum.too_small })
  else if (row.every_days > LEAVE_SHEET.maxEveryDays) issues.push({ path: at('every_days'), code: IssueCode.enum.too_big })
  if (row.until === '') issues.push({ path: at('until'), code: IssueCode.enum.required })
  else if (row.start_date !== '' && compareDates(row.until, row.start_date) < 0) issues.push({ path: at('until'), code: IssueCode.enum.too_small })
  return issues
}

/** The leave id an expanded leave gets when the sheet is sent; a fresh one each time (D-044). */
function newLeaveId(): LeaveId {
  return LeaveId.parse(crypto.randomUUID())
}

/** One leave as `leaves.createMany` takes it. */
function sheetLeave(
  values: LeaveSheetValues & WithProperties,
  days: SheetDays,
  rotationOf: RotationOf,
  id: LeaveId,
) {
  const row = values.rows[days.row]
  return {
    id,
    deployment_id: rotationOf(soldiersOfSheet(values), days).deployment_id ?? undefined,
    leave_type_id: row?.leave_type_id ?? null,
    // An empty field is an absent value, so the schema answers `required`.
    start_date: days.start_date === '' ? undefined : days.start_date,
    end_date: days.end_date === '' ? undefined : days.end_date,
    availability_effect_override: null,
    reason: optionalText(row?.reason ?? ''),
    properties: values.properties ?? {},
  }
}

/** The rotation of a leave's days, as the request forms pick it (D-216, D-220). */
export type RotationOf = (soldierIds: readonly SoldierId[], dates: Pick<SheetDays, 'start_date' | 'end_date'>) => RequestRotation

/** The soldiers a sheet is for: the one chosen, or none yet. */
function soldiersOfSheet(values: Pick<LeaveSheetValues, 'soldier_id'>): SoldierId[] {
  return values.soldier_id === null ? [] : [values.soldier_id]
}

function sheetInput(
  values: LeaveSheetValues & WithProperties,
  rotationOf: RotationOf,
  acknowledged: readonly AvailabilityRuleId[],
) {
  const days = sheetDays(values)
  return {
    days,
    input: {
      soldier_id: values.soldier_id,
      leaves: days.map((day) => sheetLeave(values, day, rotationOf, newLeaveId())),
      as_approved: values.as_approved,
      acknowledged_rule_ids: [...acknowledged],
    },
  }
}

/**
 * The same codes the adapter answers, on the sheet's own fields: the schema's (D-068), a reason the row's type requires
 * (D-064), each leave's rotation (D-216), which the sheet picks itself, the row's repetition, and how many leaves the
 * sheet makes. An expanded leave's issue lands on its row (D-275). The command stays the authority.
 */
export function leaveSheetIssues(
  values: LeaveSheetValues,
  typeOf: (id: LeaveTypeId | null) => Pick<LeaveType, 'requires_reason'> | null,
  rotationOf: RotationOf,
): Issue[] {
  const { days, input } = sheetInput(values, rotationOf, [])
  const onRow = (row: number, path: Issue['path']): Issue['path'] => ['rows', row, ...path]
  const schema = formIssues(CreateLeavesInput, input)
    .filter((issue) => !(issue.path[0] === 'leaves' && issue.path[2] === 'deployment_id'))
    .map((issue) => sheetIssue(issue, days))
  const rows = values.rows.flatMap((row, index) => {
    const type = typeOf(row.leave_type_id)
    const issues = [...(type === null ? [] : leaveReasonIssues(type, optionalText(row.reason))), ...repeatIssues(row)]
    return issues.map((issue) => ({ ...issue, path: onRow(index, issue.path) }))
  })
  const rotations = days.flatMap((day) =>
    rotationOf(soldiersOfSheet(values), day).issues.map((issue) => (issue.path[0] === 'soldier_id' ? issue : { ...issue, path: onRow(day.row, issue.path) })),
  )
  return dedupe([...schema, ...rows, ...rotations, ...countIssues(values, days)])
}

/** Past the sheet's limit, the issue lands on the last row: on its last date when it repeats, else on its start. */
function countIssues(values: LeaveSheetValues, days: readonly SheetDays[]): Issue[] {
  if (days.length <= LEAVE_SHEET.maxLeaves) return []
  const row = days.at(-1)?.row ?? 0
  const field = values.rows[row]?.repeats === true ? 'until' : 'start_date'
  return [{ path: ['rows', row, field], code: IssueCode.enum.too_big }]
}

/**
 * An issue of `leaves.createMany` on the sheet's fields: a leave's soldier is the sheet's, a leave's field is its row's,
 * and the list itself is the first row's start. Anything else keeps its path.
 */
function sheetIssue(issue: Issue, days: readonly SheetDays[]): Issue {
  const [head, index, field, ...rest] = issue.path
  if (head !== 'leaves') return issue
  if (typeof index !== 'number') return { ...issue, path: ['rows', 0, 'start_date'] }
  if (field === 'soldier_id') return { ...issue, path: ['soldier_id', ...rest] }
  const row = days[index]?.row ?? 0
  return { ...issue, path: ['rows', row, ...(field === undefined ? ['start_date'] : [field, ...rest])] }
}

/** The sheet's answer from `leaves.createMany`, on the sheet's fields (D-275). */
export function sheetIssues(issues: readonly Issue[], days: readonly SheetDays[]): Issue[] {
  return issues.map((issue) => sheetIssue(issue, days))
}

function dedupe(issues: readonly Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.path.join('.')}:${issue.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** What `leaves.createMany` is sent, and the days of each leave, so its answer lands on the rows. */
export interface SheetRequest {
  readonly input: CreateLeavesInput
  readonly days: readonly SheetDays[]
}

export function toCreateLeavesInput(
  values: LeaveSheetValues & WithProperties,
  rotationOf: RotationOf,
  acknowledged: readonly AvailabilityRuleId[] = [],
): SheetRequest {
  const { days, input } = sheetInput(values, rotationOf, acknowledged)
  return { input: CreateLeavesInput.parse(input), days }
}

/** Each leave of `leaves.createMany` as a single create, for the optimistic rows (D-115). */
export function leavesOfInput(input: CreateLeavesInput): CreateLeaveInput[] {
  return input.leaves.map((leave) => ({
    ...leave,
    soldier_id: input.soldier_id,
    as_approved: input.as_approved,
    acknowledged_rule_ids: input.acknowledged_rule_ids,
    comment: null,
  }))
}

/**
 * The leaves the sheet would create, as rules see them (D-142): pending, or approved when "approve now" is on, each with
 * an id no row has. Empty until the soldier is chosen; a row joins once its type and valid days are.
 */
export function sheetCandidates(values: LeaveSheetValues): LeaveCandidate[] {
  const { soldier_id } = values
  if (soldier_id === null) return []
  const status = values.as_approved ? LeaveStatus.enum.approved : LeaveStatus.enum.pending
  return sheetDays(values).flatMap((day, index) => {
    const leave_type_id = values.rows[day.row]?.leave_type_id ?? null
    const { start_date, end_date } = day
    if (leave_type_id === null || start_date === '' || end_date === '' || compareDates(start_date, end_date) > 0) return []
    if (index >= LEAVE_SHEET.maxLeaves) return []
    return [{ id: candidateId(index), soldier_id, leave_type_id, start_date, end_date, status, availability_effect_override: null }]
  })
}

/** The n-th candidate's id: no row has one in this range (D-142). */
function candidateId(index: number): LeaveId {
  return LeaveId.parse(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)
}
