import { LEAVE_ROUNDS } from '@config'
import {
  CreateLeaveBatchInput,
  IssueCode,
  LeaveBatchId,
  LeaveId,
  type AvailabilityRuleId,
  type CalendarDate,
  type Deployment,
  type DeploymentId,
  type DeploymentMember,
  type Issue,
  type LeaveType,
  type LeaveTypeId,
  type SoldierId,
} from '@contracts'
import { addDays, compareDates, leaveReasonIssues, optionalText, roundDays, type LeaveDays, type RoundRhythm } from '@domain'
import { formIssues } from '../forms/issues'
import type { WithProperties } from '../properties/properties'

// The leave-round planner (D-270, D-286): inside one rotation, groups of soldiers each go home on the same rhythm, from
// their own first day home. It sends one collective leave (D-179) with a leave per soldier and round, so the rounds are
// ordinary leaves of one batch (D-268); only the leaves are stored (D-019). Pure.

export interface RoundGroup {
  /** The group's own key in the list, so a removed group takes its fields with it. Never sent. */
  readonly key: string
  readonly soldier_ids: readonly SoldierId[]
  /** The group's first day home. '' while the field is empty. */
  readonly first_home: CalendarDate | ''
}

export interface LeaveRoundValues {
  readonly name: string
  readonly description: string
  /** The rotation the plan is in: its days bound the plan, its members are who may be planned. */
  readonly deployment_id: DeploymentId | null
  /** The plan's days, within the rotation's. '' while the field is empty. */
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  /** As typed: the form's fields are text. */
  readonly days_in: string
  readonly days_home: string
  readonly groups: readonly RoundGroup[]
  readonly leave_type_id: LeaveTypeId | null
  readonly reason: string
  /** Shown only to who may approve every soldier planned (D-013). */
  readonly as_approved: boolean
}

/** The rotations a plan may be in, and their members, as the actor reads them. */
export interface RoundContext {
  readonly rotations: readonly Deployment[]
  readonly members: readonly DeploymentMember[]
}

/** One leave of the plan: a soldier of a group, home on one round's days. */
export interface PlannedRound extends LeaveDays {
  readonly group: number
  readonly soldier_id: SoldierId
}

export function newRoundGroup(firstHome: CalendarDate | ''): RoundGroup {
  return { key: crypto.randomUUID(), soldier_ids: [], first_home: firstHome }
}

/**
 * A new plan in `rotation`: from today or the rotation's start, whichever is later, to its end, at the routine rhythm,
 * with one group home first on the plan's first day.
 */
export function newLeaveRoundValues(today: CalendarDate, rotation: Deployment | null, approveNow = false): LeaveRoundValues {
  const start = rotation === null ? today : compareDates(rotation.start_date, today) > 0 ? rotation.start_date : today
  return {
    name: '',
    description: '',
    deployment_id: rotation?.id ?? null,
    start_date: start,
    end_date: rotation?.end_date ?? '',
    days_in: String(LEAVE_ROUNDS.defaultDaysIn),
    days_home: String(LEAVE_ROUNDS.defaultDaysHome),
    groups: [newRoundGroup(start)],
    leave_type_id: null,
    reason: '',
    as_approved: approveNow,
  }
}

/**
 * The next group's first day home: right after the last group's days home, so groups take turns. The plan's first day
 * when there is no such day yet.
 */
export function nextFirstHome(values: Pick<LeaveRoundValues, 'groups' | 'days_home' | 'start_date'>): CalendarDate | '' {
  const last = values.groups.at(-1)?.first_home ?? ''
  const home = Number(values.days_home)
  if (last === '' || !isDays(values.days_home)) return values.start_date
  return addDays(last, home)
}

/** A rhythm part as typed: a whole number of days within the planner's limits. */
function isDays(typed: string): boolean {
  const days = Number(typed)
  return typed.trim() !== '' && Number.isInteger(days) && days >= 1 && days <= LEAVE_ROUNDS.maxDays
}

/** The rhythm typed, once both parts are days. */
export function rhythmOf(values: Pick<LeaveRoundValues, 'days_in' | 'days_home'>): RoundRhythm | null {
  return isDays(values.days_in) && isDays(values.days_home) ? { days_in: Number(values.days_in), days_home: Number(values.days_home) } : null
}

function rotationOf(values: Pick<LeaveRoundValues, 'deployment_id'>, context: RoundContext): Deployment | null {
  return context.rotations.find((rotation) => rotation.id === values.deployment_id) ?? null
}

/** The plan's days, once both are given and in order. */
function planSpan(values: Pick<LeaveRoundValues, 'start_date' | 'end_date'>): LeaveDays | null {
  const { start_date, end_date } = values
  if (start_date === '' || end_date === '' || compareDates(start_date, end_date) > 0) return null
  return { start_date, end_date }
}

/**
 * The days a soldier serves in the rotation: a member's own, else the rotation's. A rotation with no member row holds
 * the whole unit (D-259). NULL when the soldier is not a member.
 */
function servedDays(rotation: Deployment, members: readonly DeploymentMember[], soldierId: SoldierId): { start: CalendarDate; end: CalendarDate | null } | null {
  const rows = members.filter((member) => member.deployment_id === rotation.id)
  if (rows.length === 0) return { start: rotation.start_date, end: rotation.end_date }
  const member = rows.find((row) => row.soldier_id === soldierId)
  if (member === undefined) return null
  return { start: member.start_date ?? rotation.start_date, end: member.end_date ?? rotation.end_date }
}

/** Who among `soldierIds` serves in the rotation, so the plan offers them. */
export function rotationSoldiers(
  rotation: Deployment | null,
  members: readonly DeploymentMember[],
  soldierIds: readonly SoldierId[],
): SoldierId[] {
  if (rotation === null) return []
  return soldierIds.filter((soldierId) => servedDays(rotation, members, soldierId) !== null)
}

/** A group's rounds over the plan's days, as the preview shows them; none until the rhythm, days and first day are. */
export function groupRounds(values: LeaveRoundValues, group: RoundGroup): LeaveDays[] {
  const rhythm = rhythmOf(values)
  const span = planSpan(values)
  if (rhythm === null || span === null || group.first_home === '') return []
  return roundDays(rhythm, group.first_home, span)
}

/**
 * Every leave of the plan, group by group and soldier by soldier: each group's rounds, cut to the days the soldier
 * serves in the rotation, so no leave falls outside them (D-216).
 */
export function plannedRounds(values: LeaveRoundValues, context: RoundContext): PlannedRound[] {
  const rhythm = rhythmOf(values)
  const span = planSpan(values)
  const rotation = rotationOf(values, context)
  if (rhythm === null || span === null || rotation === null) return []
  return values.groups.flatMap((group, index) => {
    const firstHome = group.first_home
    if (firstHome === '') return []
    return group.soldier_ids.flatMap((soldierId) => {
      const served = servedDays(rotation, context.members, soldierId)
      if (served === null) return []
      const start = compareDates(served.start, span.start_date) > 0 ? served.start : span.start_date
      const end = served.end !== null && compareDates(served.end, span.end_date) < 0 ? served.end : span.end_date
      if (compareDates(start, end) > 0) return []
      return roundDays(rhythm, firstHome, { start_date: start, end_date: end }).map((days) => ({
        ...days,
        group: index,
        soldier_id: soldierId,
      }))
    })
  })
}

function planInput(
  values: LeaveRoundValues & WithProperties,
  rounds: readonly PlannedRound[],
  acknowledged: readonly AvailabilityRuleId[],
) {
  return {
    deployment_id: values.deployment_id ?? undefined,
    batch: { id: LeaveBatchId.parse(crypto.randomUUID()), name: values.name.trim(), description: optionalText(values.description) },
    leaves: rounds.map((round) => ({
      id: LeaveId.parse(crypto.randomUUID()),
      soldier_id: round.soldier_id,
      leave_type_id: values.leave_type_id,
      start_date: round.start_date,
      end_date: round.end_date,
      availability_effect_override: null,
      reason: optionalText(values.reason),
      properties: values.properties ?? {},
    })),
    as_approved: values.as_approved,
    acknowledged_rule_ids: [...acknowledged],
  }
}

/** A rhythm part's own issues: a whole number of days, at least one and within the planner's limit. */
function daysIssues(field: 'days_in' | 'days_home', typed: string): Issue[] {
  const days = Number(typed)
  const code =
    typed.trim() === ''
      ? IssueCode.enum.required
      : !Number.isInteger(days)
        ? IssueCode.enum.not_integer
        : days < 1
          ? IssueCode.enum.too_small
          : days > LEAVE_ROUNDS.maxDays
            ? IssueCode.enum.too_big
            : null
  return code === null ? [] : [{ path: [field], code }]
}

/** The plan's days: given, in order, and within the rotation's. */
function spanIssues(values: LeaveRoundValues, rotation: Deployment | null): Issue[] {
  const issues: Issue[] = []
  if (values.deployment_id === null) issues.push({ path: ['deployment_id'], code: IssueCode.enum.required })
  if (values.start_date === '') issues.push({ path: ['start_date'], code: IssueCode.enum.required })
  else if (rotation !== null && compareDates(values.start_date, rotation.start_date) < 0) issues.push({ path: ['start_date'], code: IssueCode.enum.too_small })
  if (values.end_date === '') issues.push({ path: ['end_date'], code: IssueCode.enum.required })
  else if (values.start_date !== '' && compareDates(values.end_date, values.start_date) < 0) issues.push({ path: ['end_date'], code: IssueCode.enum.too_small })
  else if (rotation?.end_date != null && compareDates(values.end_date, rotation.end_date) > 0) issues.push({ path: ['end_date'], code: IssueCode.enum.too_big })
  return issues
}

/** Each group: soldiers, none of them in an earlier group, and a first day home within the plan's days. */
function groupIssues(values: LeaveRoundValues): Issue[] {
  const seen = new Set<SoldierId>()
  return values.groups.flatMap((group, index): Issue[] => {
    const issues: Issue[] = []
    const at = (field: string): Issue['path'] => ['groups', index, field]
    if (group.soldier_ids.length === 0) issues.push({ path: at('soldier_ids'), code: IssueCode.enum.required })
    else if (group.soldier_ids.some((soldierId) => seen.has(soldierId))) issues.push({ path: at('soldier_ids'), code: IssueCode.enum.duplicate_item })
    for (const soldierId of group.soldier_ids) seen.add(soldierId)
    if (group.first_home === '') issues.push({ path: at('first_home'), code: IssueCode.enum.required })
    else if (values.start_date !== '' && compareDates(group.first_home, values.start_date) < 0) issues.push({ path: at('first_home'), code: IssueCode.enum.too_small })
    else if (values.end_date !== '' && compareDates(group.first_home, values.end_date) > 0) issues.push({ path: at('first_home'), code: IssueCode.enum.too_big })
    return issues
  })
}

/**
 * An issue of `leaves.createBatch` on the plan's fields (D-068): the batch's own fields are the form's, a leave's type,
 * reason and properties are the plan's, its soldier and days its group's, and the list itself is the groups'. A
 * leave's id has no field, and keeps its path for the form's general message.
 */
function planIssue(issue: Issue, rounds: readonly PlannedRound[]): Issue {
  const [head, index, field, ...rest] = issue.path
  if (head === 'batch') return { ...issue, path: issue.path.slice(1) }
  if (head !== 'leaves') return issue
  if (typeof index !== 'number') return { ...issue, path: ['groups'] }
  if (field === 'leave_type_id' || field === 'reason' || field === 'properties') return { ...issue, path: [field, ...rest] }
  if (field === 'id') return issue
  const group = rounds[index]?.group ?? 0
  return { ...issue, path: ['groups', group, field === 'soldier_id' ? 'soldier_ids' : 'first_home'] }
}

/** The plan's answer from `leaves.createBatch`, on the plan's fields: an issue every round shares, once. */
export function roundAnswerIssues(issues: readonly Issue[], rounds: readonly PlannedRound[]): Issue[] {
  return dedupe(issues.map((issue) => planIssue(issue, rounds)))
}

/**
 * The codes the command answers, on the plan's own fields: the schema's (D-068), a reason the type requires (D-064),
 * the plan's days within the rotation's, the rhythm, each group, and how many leaves the plan makes. The command stays
 * the authority: the rotation's members and the rules are its (D-179, D-216).
 */
export function leaveRoundIssues(
  values: LeaveRoundValues,
  type: Pick<LeaveType, 'requires_reason'> | null,
  context: RoundContext,
): Issue[] {
  const rounds = plannedRounds(values, context)
  const schema = formIssues(CreateLeaveBatchInput, planInput(values, rounds, []))
    .filter((issue) => issue.path[0] !== 'deployment_id')
    // No leave yet is the groups' to answer while they are still incomplete.
    .filter((issue) => !(issue.path.length === 1 && issue.path[0] === 'leaves' && values.groups.some((group) => group.soldier_ids.length === 0)))
  const count = rounds.length > LEAVE_ROUNDS.maxLeaves ? [{ path: ['end_date'], code: IssueCode.enum.too_big }] : []
  return dedupe([
    ...roundAnswerIssues(schema, rounds),
    ...(type === null ? [] : leaveReasonIssues(type, optionalText(values.reason))),
    ...spanIssues(values, rotationOf(values, context)),
    ...daysIssues('days_in', values.days_in),
    ...daysIssues('days_home', values.days_home),
    ...groupIssues(values),
    ...count,
  ])
}

/** What `leaves.createBatch` is sent, and the round of each leave, so its answer lands on the groups. */
export interface RoundRequest {
  readonly input: CreateLeaveBatchInput
  readonly rounds: readonly PlannedRound[]
}

export function toLeaveRoundInput(
  values: LeaveRoundValues & WithProperties,
  context: RoundContext,
  acknowledged: readonly AvailabilityRuleId[] = [],
): RoundRequest {
  const rounds = plannedRounds(values, context)
  return { input: CreateLeaveBatchInput.parse(planInput(values, rounds, acknowledged)), rounds }
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
