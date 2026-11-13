import { DASHBOARD, FIRST_DAY_OF_WEEK } from '@config'
import {
  AvailabilityEffect,
  LeaveStatus,
  type CalendarDate,
  type Leave,
  type LeaveId,
  type LeaveType,
  type LeaveTypeGroup,
  type LeaveTypeId,
  type Soldier,
  type UnitId,
} from '@contracts'
import {
  APPROVED_ONLY,
  addDays,
  compareDates,
  createAvailabilityContext,
  daysTally,
  effectiveEffect,
  spreadOf,
  weeksOf,
  type AvailabilityContext,
  type DaysTally,
  type Spread,
} from '@domain'
import { fullName } from '../roster/roster'

// The dashboard's one tally of its scope (D-349): every module reads it, so modules never disagree (P-1). Derived on
// each render, never stored (D-019).

/** One row of the scope: a soldier the actor reads who serves in the span in the unit's tree. */
export interface DashboardRowInput {
  readonly soldier: Soldier
  /** The direct sub-unit of the chosen unit the soldier belongs to; NULL for the unit itself. */
  readonly subUnitId: UnitId | null
  /** Whether the soldier serves on a day, in the span's sense (a rotation's days, or a membership in the tree). */
  readonly serves: (day: CalendarDate) => boolean
}

export interface DashboardTallyInput {
  /** Every day of the span, in order. */
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  /** "כולל מתוכנן": the whole span is counted, future days too. */
  readonly planned: boolean
  readonly rows: readonly DashboardRowInput[]
  /** The chosen unit's direct sub-units, in the tree's order. */
  readonly subUnitIds: readonly UnitId[]
  /** The approved and pending leaves of the rows over the span, the day before today and the days ahead. */
  readonly leaves: readonly Leave[]
  /** Archived ones too, so a leave keeps its type (D-113). */
  readonly types: readonly LeaveType[]
  readonly groups: readonly LeaveTypeGroup[]
}

export interface DashboardRow {
  readonly soldier: Soldier
  readonly subUnitId: UnitId | null
  /** Over the counted days. */
  readonly tally: DaysTally
  /** One tally per week of the counted days (`weeks`). */
  readonly weeks: readonly DaysTally[]
  /** No outside day in the counted days: the median and the gap read these soldiers only. */
  readonly fullSpan: boolean
  /** Home days − the median; NULL for a soldier who is not full-span, or when there is no median. */
  readonly gap: number | null
  /** The gap is beyond `DASHBOARD.fairGapDays`. */
  readonly beyond: boolean
  readonly servesToday: boolean
  readonly homeToday: boolean
}

export interface TrendDay {
  readonly date: CalendarDate
  readonly serving: number
  readonly present: number
  /** After today: counted only under "כולל מתוכנן". */
  readonly future: boolean
}

export interface SubUnitTally {
  readonly unitId: UnitId
  readonly rows: number
  /** Over the sub-unit's full-span soldiers. */
  readonly spread: Spread | null
  readonly servingToday: number
  readonly presentToday: number
}

export interface DistributionBin {
  /** The fewest home days of the bin, included. */
  readonly from: number
  /** The most home days of the bin, included. */
  readonly to: number
  readonly soldiers: number
}

/** Home days of one type, or of the built-in "סבב יציאות" group's types as one (D-345). */
export type HomeByType =
  | { readonly kind: 'type'; readonly type: LeaveType; readonly days: number }
  | { readonly kind: 'group'; readonly group: LeaveTypeGroup; readonly types: readonly LeaveType[]; readonly days: number }

export interface UpcomingLeave {
  readonly leave: Leave
  readonly soldier: Soldier
  readonly pending: boolean
}

export interface UpcomingDay {
  readonly date: CalendarDate
  /** A leave that sends the soldier home starts that day. */
  readonly leaving: readonly UpcomingLeave[]
  /** One ended the day before. */
  readonly returning: readonly UpcomingLeave[]
}

export interface DashboardFigures {
  readonly rows: number
  /** Whether the span holds today: the today figures mean something only then. */
  readonly holdsToday: boolean
  readonly servingToday: number
  readonly presentToday: number
  readonly homeToday: number
  readonly fullSpan: number
  /** The mean home days of the full-span soldiers; NULL without one. */
  readonly meanHome: number | null
  /** Full-span soldiers whose gap is beyond `DASHBOARD.fairGapDays`. */
  readonly beyond: number
}

export interface DashboardTally {
  readonly counted: readonly CalendarDate[]
  readonly weeks: readonly (readonly CalendarDate[])[]
  readonly rows: readonly DashboardRow[]
  /** Over the full-span soldiers. */
  readonly spread: Spread | null
  readonly trend: readonly TrendDay[]
  /** The direct sub-units with rows, in the tree's order. */
  readonly subUnits: readonly SubUnitTally[]
  readonly distribution: readonly DistributionBin[]
  /** Largest first. */
  readonly homeByType: readonly HomeByType[]
  readonly upcoming: readonly UpcomingDay[]
  readonly figures: DashboardFigures
}

/** The counted days of a span: up to today, or the whole span under "כולל מתוכנן". */
export function countedDays(days: readonly CalendarDate[], today: CalendarDate, planned: boolean): CalendarDate[] {
  return planned ? [...days] : days.filter((day) => compareDates(day, today) <= 0)
}

const homeOf =
  (context: AvailabilityContext, soldier: Soldier) =>
  (day: CalendarDate): boolean =>
    !context.isAvailable(soldier.id, day, APPROVED_ONLY)

/** Equal bins of whole days from 0 to the most, at most `DASHBOARD.distributionBins` of them. */
export function distributionOf(values: readonly number[]): DistributionBin[] {
  if (values.length === 0) return []
  const most = Math.max(...values)
  const width = Math.max(1, Math.ceil((most + 1) / DASHBOARD.distributionBins))
  const count = Math.ceil((most + 1) / width)
  return Array.from({ length: count }, (_, index) => {
    const from = index * width
    const to = from + width - 1
    return { from, to, soldiers: values.filter((value) => value >= from && value <= to).length }
  })
}

function homeByTypeOf(
  input: DashboardTallyInput,
  context: AvailabilityContext,
  counted: readonly CalendarDate[],
): HomeByType[] {
  const leaves = new Map<LeaveId, Leave>(input.leaves.map((leave) => [leave.id, leave]))
  const types = new Map<LeaveTypeId, LeaveType>(input.types.map((type) => [type.id, type]))
  const rotationGroup = input.groups.find((group) => group.is_rotation_leave) ?? null
  const byType = new Map<LeaveTypeId, number>()
  for (const row of input.rows) {
    for (const day of counted) {
      if (!row.serves(day)) continue
      const covering = context
        .on(row.soldier.id, day, APPROVED_ONLY)
        .leaves.filter((leave) => leave.counted)
        .flatMap((leave): LeaveType[] => {
          const typeId = leaves.get(leave.leave_id)?.leave_type_id
          const type = typeId === undefined ? undefined : types.get(typeId)
          return type === undefined ? [] : [type]
        })
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      const first = covering[0]
      if (first !== undefined) byType.set(first.id, (byType.get(first.id) ?? 0) + 1)
    }
  }
  const result: HomeByType[] = []
  const grouped: LeaveType[] = []
  let groupDays = 0
  for (const [typeId, days] of byType) {
    const type = types.get(typeId)
    if (type === undefined) continue
    if (rotationGroup !== null && type.group_id === rotationGroup.id) {
      grouped.push(type)
      groupDays += days
    } else result.push({ kind: 'type', type, days })
  }
  if (rotationGroup !== null && groupDays > 0) result.push({ kind: 'group', group: rotationGroup, types: grouped, days: groupDays })
  return result.sort((a, b) => b.days - a.days)
}

function upcomingOf(input: DashboardTallyInput): UpcomingDay[] {
  const soldiers = new Map(input.rows.map((row) => [row.soldier.id, row.soldier]))
  const types = new Map<LeaveTypeId, LeaveType>(input.types.map((type) => [type.id, type]))
  const away = input.leaves
    .filter((leave) => leave.status === LeaveStatus.enum.approved || leave.status === LeaveStatus.enum.pending)
    .filter((leave) => effectiveEffect(leave, types.get(leave.leave_type_id)) === AvailabilityEffect.enum.unavailable)
    .flatMap((leave): UpcomingLeave[] => {
      const soldier = soldiers.get(leave.soldier_id)
      return soldier === undefined ? [] : [{ leave, soldier, pending: leave.status === LeaveStatus.enum.pending }]
    })
  return Array.from({ length: DASHBOARD.upcomingDays }, (_, offset) => {
    const date = addDays(input.today, offset)
    const before = addDays(date, -1)
    return {
      date,
      leaving: away.filter((item) => item.leave.start_date === date),
      returning: away.filter((item) => item.leave.end_date === before),
    }
  })
}

/** The tally of a scope (D-349). */
export function dashboardTally(input: DashboardTallyInput): DashboardTally {
  const { days, today, rows } = input
  const context = createAvailabilityContext({ leaves: input.leaves, leave_types: input.types })
  const counted = countedDays(days, today, input.planned)
  const weeks = weeksOf(counted, FIRST_DAY_OF_WEEK)
  const holdsToday = days.includes(today)
  const base = rows.map((row) => {
    const home = homeOf(context, row.soldier)
    const tally = daysTally(counted, row.serves, home)
    const servesToday = holdsToday && row.serves(today)
    return {
      row,
      tally,
      weeks: weeks.map((week) => daysTally(week, row.serves, home)),
      fullSpan: counted.length > 0 && tally.outside === 0,
      servesToday,
      homeToday: servesToday && home(today),
      home,
    }
  })
  const spread = spreadOf(base.filter((item) => item.fullSpan).map((item) => item.tally.home))
  const tallied: DashboardRow[] = base.map(({ row, tally, weeks: ofWeeks, fullSpan, servesToday, homeToday }) => {
    const gap = fullSpan && spread !== null ? tally.home - spread.median : null
    return {
      soldier: row.soldier,
      subUnitId: row.subUnitId,
      tally,
      weeks: ofWeeks,
      fullSpan,
      gap,
      beyond: gap !== null && Math.abs(gap) > DASHBOARD.fairGapDays,
      servesToday,
      homeToday,
    }
  })
  const trend = counted.map((date): TrendDay => {
    let serving = 0
    let present = 0
    for (const item of base) {
      if (!item.row.serves(date)) continue
      serving += 1
      if (!item.home(date)) present += 1
    }
    return { date, serving, present, future: compareDates(date, today) > 0 }
  })
  const subUnits = input.subUnitIds.flatMap((unitId): SubUnitTally[] => {
    const own = tallied.filter((row) => row.subUnitId === unitId)
    if (own.length === 0) return []
    return [
      {
        unitId,
        rows: own.length,
        spread: spreadOf(own.filter((row) => row.fullSpan).map((row) => row.tally.home)),
        servingToday: own.filter((row) => row.servesToday).length,
        presentToday: own.filter((row) => row.servesToday && !row.homeToday).length,
      },
    ]
  })
  const full = tallied.filter((row) => row.fullSpan)
  const servingToday = tallied.filter((row) => row.servesToday).length
  const homeToday = tallied.filter((row) => row.homeToday).length
  return {
    counted,
    weeks,
    rows: [...tallied].sort((a, b) => a.tally.home - b.tally.home || fullName(a.soldier).localeCompare(fullName(b.soldier))),
    spread,
    trend,
    subUnits,
    distribution: distributionOf(full.map((row) => row.tally.home)),
    homeByType: homeByTypeOf(input, context, counted),
    upcoming: upcomingOf(input),
    figures: {
      rows: rows.length,
      holdsToday,
      servingToday,
      presentToday: servingToday - homeToday,
      homeToday,
      fullSpan: full.length,
      meanHome: full.length === 0 ? null : full.reduce((sum, row) => sum + row.tally.home, 0) / full.length,
      beyond: full.filter((row) => row.beyond).length,
    },
  }
}

/** Planned against actual home days of one group: a direct sub-unit, or a soldier when the unit has none. */
export interface PlanGroup {
  /** The sub-unit; NULL for the unit itself, or for a soldier's group. */
  readonly unitId: UnitId | null
  /** The soldier, when the unit has no sub-unit with rows. */
  readonly soldier: Soldier | null
  readonly planned: number
  readonly actual: number
}

export interface PlanTally {
  readonly groups: readonly PlanGroup[]
  readonly planned: number
  readonly actual: number
}

export interface PlanTallyInput {
  readonly counted: readonly CalendarDate[]
  readonly rows: readonly DashboardRowInput[]
  readonly subUnitIds: readonly UnitId[]
  /** The rotation's leaves of the rows as they stood at the plan's instant (`planOf`). */
  readonly planned: readonly Leave[]
  /** The same leaves as they are now. */
  readonly actual: readonly Leave[]
  readonly types: readonly LeaveType[]
}

/** The plan against what happened over the counted days (D-349, P-9): both count home days the same way. */
export function planTally(input: PlanTallyInput): PlanTally {
  const planned = createAvailabilityContext({ leaves: input.planned, leave_types: input.types })
  const actual = createAvailabilityContext({ leaves: input.actual, leave_types: input.types })
  const figures = input.rows.map((row) => ({
    row,
    planned: daysTally(input.counted, row.serves, homeOf(planned, row.soldier)).home,
    actual: daysTally(input.counted, row.serves, homeOf(actual, row.soldier)).home,
  }))
  const bySubUnit = input.subUnitIds.some((unitId) => input.rows.some((row) => row.subUnitId === unitId))
  const groups: PlanGroup[] = bySubUnit
    ? [...input.subUnitIds, null].flatMap((unitId): PlanGroup[] => {
        const own = figures.filter((item) => item.row.subUnitId === unitId)
        if (own.length === 0) return []
        return [
          {
            unitId,
            soldier: null,
            planned: own.reduce((sum, item) => sum + item.planned, 0),
            actual: own.reduce((sum, item) => sum + item.actual, 0),
          },
        ]
      })
    : figures.map((item) => ({ unitId: null, soldier: item.row.soldier, planned: item.planned, actual: item.actual }))
  return {
    groups,
    planned: figures.reduce((sum, item) => sum + item.planned, 0),
    actual: figures.reduce((sum, item) => sum + item.actual, 0),
  }
}
