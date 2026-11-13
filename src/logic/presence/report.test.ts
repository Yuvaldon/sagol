import {
  DeploymentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type CalendarDate,
  type Leave,
  type LeaveType,
  type LeaveTypeGroup,
  type Soldier,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { DAY_REPORT } from '@config'
import { describe, expect, it } from 'vitest'
import type { FilterSource } from '../filters/source'
import { dayReport, isReportable, reportDays, steppedReportDay, type DayReportInput } from './report'
import { reportText, type ReportWords } from './reportText'

// Sample rows, test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const DAY = '2026-12-10'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

const COMPANY = UnitId.parse(uuid(10))
const SQUAD = UnitId.parse(uuid(11))

function unit(id: UnitId, name: string, parent: UnitId | null, sort = 0): Unit {
  return {
    id,
    organization_id: ORGANIZATION,
    name,
    code: null,
    parent_id: parent,
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    properties: {},
    sort_order: sort,
    ...audit,
  }
}

function soldier(n: number, last: string): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name: `F${n}`,
    last_name: last,
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
  }
}

function placed(n: number, unitId: UnitId): UnitMembership {
  return {
    id: UnitMembershipId.parse(uuid(500 + n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(n)),
    unit_id: unitId,
    membership_type: 'primary',
    valid_from: '2026-01-01',
    valid_to: null,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }
}

const HOME: LeaveType = {
  id: LeaveTypeId.parse(uuid(70)),
  organization_id: ORGANIZATION,
  group_id: null,
  name: 'בית',
  color_key: 'blue',
  icon_key: null,
  availability_effect: 'unavailable',
  requires_reason: false,
  sort_order: 0,
  ...audit,
}

let nextLeave = 100
function leave(soldierN: number, start: CalendarDate, end: CalendarDate, extra: Partial<Leave> = {}): Leave {
  nextLeave += 1
  return {
    id: LeaveId.parse(uuid(nextLeave)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    leave_type_id: HOME.id,
    batch_id: null,
    deployment_id: DeploymentId.parse(uuid(90)),
    start_date: start,
    end_date: end,
    status: 'approved',
    reason: null,
    availability_effect_override: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    ...extra,
  }
}

// The company holds 1 and 4, its squad holds 2, and 3 has no unit.
const source: FilterSource = {
  soldiers: [soldier(1, 'ב'), soldier(2, 'א'), soldier(3, 'ג'), soldier(4, 'א')],
  ranks: [],
  seniorityOverrides: [],
  units: [unit(COMPANY, 'פלוגה', null), unit(SQUAD, 'כיתה', COMPANY)],
  unitTree: [unit(COMPANY, 'פלוגה', null), unit(SQUAD, 'כיתה', COMPANY)],
  memberships: [placed(1, COMPANY), placed(2, SQUAD), placed(4, COMPANY)],
  soldierTags: [],
  propertyDefinitions: [],
}
const leaves = [
  leave(1, DAY, '2026-12-12', { reason: 'חתונה' }),
  leave(2, '2026-12-08', DAY),
  leave(4, DAY, DAY, { status: 'pending' }),
]

function input(overrides: Partial<DayReportInput> = {}): DayReportInput {
  return {
    source,
    filter: null,
    leaves,
    types: [HOME],
    groups: [],
    days: [DAY],
    scopeUnitId: null,
    rotations: [],
    readsLeavesOf: () => true,
    readsPlacements: () => true,
    ...overrides,
  }
}

const names = (entries: readonly { soldier: Soldier }[]) => entries.map((entry) => entry.soldier.first_name)

describe('the day report (D-193)', () => {
  const [day] = dayReport(input()).days
  if (day === undefined) throw new Error('no day')

  it('counts the population, who is present and absent, and who leaves and returns, approved leaves only', () => {
    expect(day.counts).toEqual({ total: 4, present: 2, absent: 2, leaving: 1, returning: 1 })
    expect(names(day.absent)).toEqual(['F2', 'F1'])
    expect(names(day.leaving)).toEqual(['F1'])
    expect(names(day.returning)).toEqual(['F2'])
    expect(names(day.present)).toEqual(['F4', 'F3'])
  })

  it('groups by unit in the tree’s order, then those with no unit, each with its own counts', () => {
    expect(day.units.map((section) => section.label)).toEqual([
      { kind: 'unit', path: ['פלוגה'] },
      { kind: 'unit', path: ['פלוגה', 'כיתה'] },
      { kind: 'none' },
    ])
    expect(day.units.map((section) => section.counts)).toEqual([
      { total: 2, present: 1, absent: 1, leaving: 1, returning: 0 },
      { total: 1, present: 0, absent: 1, leaving: 0, returning: 1 },
      { total: 1, present: 1, absent: 0, leaving: 0, returning: 0 },
    ])
  })

  it('carries the absence’s type and reason, and says whether any stands beside a name (D-194)', () => {
    const away = day.absent.find((entry) => entry.soldier.first_name === 'F1')
    expect(away?.absences.map((type) => type?.name)).toEqual(['בית'])
    expect(away?.reasons).toEqual(['חתונה'])
    expect(dayReport(input()).hasReasons).toBe(true)
    expect(dayReport(input({ types: [], leaves: leaves.map((row) => ({ ...row, reason: null })) })).hasReasons).toBe(false)
  })

  it('shows no reason of a leave of the built-in group, still counting the soldier absent (D-346)', () => {
    const rotation: LeaveTypeGroup = {
      id: LeaveTypeGroupId.parse(uuid(71)),
      organization_id: ORGANIZATION,
      name: 'סבב יציאות',
      is_rotation_leave: true,
      sort_order: 0,
      ...audit,
    }
    const [rotationDay] = dayReport(input({ types: [{ ...HOME, group_id: rotation.id }], groups: [rotation] })).days
    const away = rotationDay?.absent.find((entry) => entry.soldier.first_name === 'F1')
    expect(away?.reasons).toEqual([])
    expect(away?.absences.map((type) => type?.name)).toEqual(['בית'])
    expect(rotationDay?.counts.absent).toBe(2)
  })

  it('leaves out the soldiers whose leaves the viewer may not read (D-161), and starts paths below the scope', () => {
    const report = dayReport(input({ readsLeavesOf: (row) => row.first_name !== 'F1', scopeUnitId: COMPANY }))
    expect(report.days[0]?.counts.total).toBe(3)
    expect(report.days[0]?.units[1]?.label).toEqual({ kind: 'unit', path: ['כיתה'] })
  })

  it('follows the soldier filter, and holds one block per day of a span', () => {
    const inSquad = { where: { kind: 'unit' as const, unit_ids: [SQUAD], include_descendants: true } }
    expect(names(dayReport(input({ filter: inSquad })).days[0]?.absent ?? [])).toEqual(['F2'])
    const span = dayReport(input({ days: [DAY, '2026-12-11', '2026-12-12'] }))
    expect(span.days.map((row) => [row.date, row.counts.absent, row.counts.leaving, row.counts.returning])).toEqual([
      [DAY, 2, 1, 1],
      ['2026-12-11', 1, 0, 0],
      ['2026-12-12', 1, 0, 1],
    ])
  })
})

describe('the days a report runs on (D-193, D-211)', () => {
  const rotations = [
    { start_date: '2026-12-01', end_date: '2026-12-05' },
    { start_date: '2026-12-10', end_date: '2026-12-12' },
  ]

  it('reports only the days a rotation runs on; routine has no report (D-222)', () => {
    expect(isReportable([], DAY)).toBe(false)
    expect(isReportable(rotations, '2026-12-05')).toBe(true)
    expect(isReportable(rotations, '2026-12-07')).toBe(false)
    expect(isReportable([{ start_date: '2026-12-01', end_date: null }], '2027-06-01')).toBe(true)
  })

  it('steps over the gap between rotations, and stops past the first start and the last end', () => {
    expect(steppedReportDay([], DAY, 1)).toBeNull()
    expect(steppedReportDay(rotations, '2026-12-05', 1)).toBe('2026-12-10')
    expect(steppedReportDay(rotations, '2026-12-10', -1)).toBe('2026-12-05')
    expect(steppedReportDay(rotations, '2026-12-12', 1)).toBeNull()
    expect(steppedReportDay(rotations, '2026-12-01', -1)).toBeNull()
    expect(steppedReportDay([{ start_date: '2026-12-01', end_date: null }], '2027-01-01', 1)).toBe('2027-01-02')
  })

  it('spans from the day to the last one, the reportable days only, at most the cap of calendar days', () => {
    expect(reportDays([], DAY, null)).toEqual([])
    expect(reportDays([], DAY, '2026-12-01')).toEqual([])
    expect(reportDays(rotations, '2026-12-04', '2026-12-10')).toEqual(['2026-12-04', '2026-12-05', '2026-12-10'])
    expect(reportDays([{ start_date: DAY, end_date: null }], DAY, '2027-03-01')).toHaveLength(DAY_REPORT.maxSpanDays)
  })
})

describe('the report as text (D-195)', () => {
  const words: ReportWords = {
    heading: (date) => `יום ${date}`,
    rotations: (rows) => (rows.length === 0 ? null : `סבבים ${rows.length}`),
    count: (category, value) => `${category} ${value}`,
    list: (category, size) => `${category} (${size}):`,
    unit: (label) => (label.kind === 'unit' ? label.path.join(' / ') : label.kind),
    entry: (entry, withReasons) => `- ${entry.soldier.first_name}${withReasons && entry.reasons.length > 0 ? ` (${entry.reasons.join(', ')})` : ''}`,
    separator: ' | ',
  }
  const { lineStart, bold } = DAY_REPORT.text

  it('marks every line right to left, bolds the header and the units, and lists the names', () => {
    const text = reportText(dayReport(input()), words, false)
    const lines = text.split('\n')
    expect(lines.every((line) => line.startsWith(lineStart))).toBe(true)
    expect(lines[0]).toBe(`${lineStart}${bold}יום ${DAY}${bold}`)
    expect(text).toContain(`${bold}פלוגה / כיתה${bold}`)
    expect(text).toContain('- F1')
    expect(text).not.toContain('חתונה')
  })

  it('adds the reasons only when asked and the report has them', () => {
    expect(reportText(dayReport(input()), words, true)).toContain('- F1 (חתונה)')
  })

  it('separates the days of a span by a marked empty line', () => {
    const text = reportText(dayReport(input({ days: [DAY, '2026-12-11'] })), words, false)
    expect(text).toContain(`\n${lineStart}\n${lineStart}${bold}יום 2026-12-11${bold}`)
  })
})
