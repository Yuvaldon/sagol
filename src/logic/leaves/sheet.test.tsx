import { LEAVE_SHEET } from '@config'
import { DeploymentId, LeaveTypeId, OrganizationId, SoldierId, type CreateLeavesInput, type Leave, type LeaveQuery, type Result } from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import type { DateWindow } from '../view-state/window'
import { useCreateLeaves, useLeaves } from './hooks'
import type { RequestRotation } from './rotation'
import {
  leaveSheetIssues,
  newLeaveSheetValues,
  newSheetRow,
  sheetCandidates,
  sheetDays,
  toCreateLeavesInput,
  type LeaveSheetRow,
  type LeaveSheetValues,
  type RotationOf,
} from './sheet'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const YAEL = SoldierId.parse(uuid(1))
const HOME = LeaveTypeId.parse(uuid(30))
const ROTATION = DeploymentId.parse(uuid(70))
const SECOND = DeploymentId.parse(uuid(71))
const AT = '2026-11-08T10:00:00.000Z'

/** Two rotations: November in the first, December on in the second. */
const rotationOf: RotationOf = (_soldiers, dates): RequestRotation =>
  dates.start_date !== '' && dates.start_date >= '2026-12-01' ? { deployment_id: SECOND, issues: [] } : { deployment_id: ROTATION, issues: [] }

const row = (overrides: Partial<LeaveSheetRow> = {}): LeaveSheetRow => ({
  ...newSheetRow('2026-11-09', '2026-11-10'),
  leave_type_id: HOME,
  ...overrides,
})
const sheet = (...rows: LeaveSheetRow[]): LeaveSheetValues => ({ soldier_id: YAEL, rows, as_approved: false })

describe('the request sheet (D-275)', () => {
  it('starts with one row, filled from a drag', () => {
    const values = newLeaveSheetValues('2026-11-08', true, { soldier_id: YAEL, start_date: '2026-11-09', end_date: '2026-11-11' })
    expect(values).toMatchObject({ soldier_id: YAEL, as_approved: true })
    expect(values.rows).toHaveLength(1)
    expect(values.rows[0]).toMatchObject({ start_date: '2026-11-09', end_date: '2026-11-11', repeats: false, every_days: String(LEAVE_SHEET.defaultEveryDays) })
    expect(newLeaveSheetValues('2026-11-08').rows[0]).toMatchObject({ start_date: '2026-11-08', end_date: '2026-11-08' })
  })

  it('expands a recurring row every so many days up to its last date, each leave as long as the first', () => {
    const days = sheetDays(sheet(row({ repeats: true, every_days: '14', until: '2026-12-07' }), row({ start_date: '2026-11-20', end_date: '2026-11-20' })))
    expect(days.map((day) => [day.row, day.start_date, day.end_date])).toEqual([
      [0, '2026-11-09', '2026-11-10'],
      [0, '2026-11-23', '2026-11-24'],
      [0, '2026-12-07', '2026-12-08'],
      [1, '2026-11-20', '2026-11-20'],
    ])
  })

  it('keeps a repetition that is not valid to its own days, and says why on the row', () => {
    const values = sheet(row(), row({ repeats: true, every_days: '1', until: '' }))
    expect(sheetDays(values)).toHaveLength(2)
    expect(leaveSheetIssues(values, () => null, rotationOf)).toEqual([
      { path: ['rows', 1, 'every_days'], code: 'too_small' },
      { path: ['rows', 1, 'until'], code: 'required' },
    ])
    expect(leaveSheetIssues(sheet(row({ repeats: true, until: '2026-11-01' })), () => null, rotationOf)).toEqual([
      { path: ['rows', 0, 'until'], code: 'too_small' },
    ])
    expect(leaveSheetIssues(sheet(row({ repeats: true, every_days: '1.5', until: '2026-12-01' })), () => null, rotationOf)).toEqual([
      { path: ['rows', 0, 'every_days'], code: 'not_integer' },
    ])
    expect(leaveSheetIssues(sheet(row({ repeats: true, every_days: ' ', until: '2026-12-01' })), () => null, rotationOf)).toEqual([
      { path: ['rows', 0, 'every_days'], code: 'required' },
    ])
  })

  it('answers each row on its own fields: the schema, a reason the type requires, the rotation', () => {
    const outside: RotationOf = (_soldiers, dates) =>
      dates.start_date === '2026-11-23' ? { deployment_id: null, issues: [{ path: ['start_date'], code: 'outside_rotation' }] } : { deployment_id: ROTATION, issues: [] }
    const values = sheet(row({ reason: '' }), row({ leave_type_id: null }), row({ repeats: true, every_days: '14', until: '2026-11-23' }))
    expect(leaveSheetIssues(values, (id) => (id === null ? null : { requires_reason: true }), outside)).toEqual([
      { path: ['rows', 1, 'leave_type_id'], code: 'required' },
      { path: ['rows', 0, 'reason'], code: 'reason_required' },
      { path: ['rows', 2, 'reason'], code: 'reason_required' },
      { path: ['rows', 2, 'start_date'], code: 'outside_rotation' },
    ])
    expect(leaveSheetIssues({ ...sheet(row({ end_date: '' })), soldier_id: null }, () => null, rotationOf)).toEqual([
      { path: ['soldier_id'], code: 'required' },
      { path: ['rows', 0, 'end_date'], code: 'required' },
    ])
  })

  it('stops past the sheet\'s limit, on the row that reaches it', () => {
    const endless = sheet(row({ start_date: '2026-11-01', end_date: '2026-11-01', repeats: true, every_days: '1', until: '2027-12-31' }))
    expect(sheetDays(endless)).toHaveLength(LEAVE_SHEET.maxLeaves + 1)
    expect(leaveSheetIssues(endless, () => null, rotationOf)).toContainEqual({ path: ['rows', 0, 'until'], code: 'too_big' })
    expect(sheetCandidates(endless)).toHaveLength(LEAVE_SHEET.maxLeaves)
  })

  it('sends one command, each leave with its own id and rotation, a blank reason as NULL', () => {
    const values = { ...sheet(row({ reason: ' ', repeats: true, every_days: '28', until: '2026-12-07' })), as_approved: true }
    const { input, days } = toCreateLeavesInput(values, rotationOf, [])
    expect(days).toHaveLength(2)
    expect(input).toMatchObject({ soldier_id: YAEL, as_approved: true, acknowledged_rule_ids: [] })
    expect(input.leaves.map((leave) => [leave.deployment_id, leave.start_date, leave.reason])).toEqual([
      [ROTATION, '2026-11-09', null],
      [SECOND, '2026-12-07', null],
    ])
    expect(new Set(input.leaves.map((leave) => leave.id)).size).toBe(2)
  })

  it('judges every leave the sheet would create, each with an id no row has', () => {
    const values = sheet(row({ repeats: true, every_days: '14', until: '2026-11-23' }), row({ leave_type_id: null }))
    const candidates = sheetCandidates(values)
    expect(candidates.map((leave) => [leave.start_date, leave.status])).toEqual([
      ['2026-11-09', 'pending'],
      ['2026-11-23', 'pending'],
    ])
    expect(new Set(candidates.map((leave) => leave.id)).size).toBe(2)
    expect(sheetCandidates({ ...values, soldier_id: null })).toEqual([])
  })
})

describe('sending the sheet with an optimistic update (D-275)', () => {
  const WINDOW: DateWindow = { kind: 'week', rotationId: null, from: '2026-11-08', to: '2026-11-30', days: [], followsToday: true, holdsToday: true }

  function render(createMany: (input: CreateLeavesInput) => Promise<Result<Leave[]>>) {
    const list = vi.fn((_query: LeaveQuery) => Promise.resolve<Result<Leave[]>>({ ok: true, value: [] }))
    const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
    const ports = fakePorts({
      session: { current: () => Promise.resolve({ ok: true, value: session }) },
      repositories: { leaves: { list } },
      commands: { leaves: { createMany } },
      now: () => AT,
    })
    return renderHook(() => ({ week: useLeaves(WINDOW), create: useCreateLeaves() }), { wrapper: wrapperOf(ports) })
  }

  const datesOf = (state: ReturnType<typeof useLeaves>) => (state.status === 'ready' ? state.value.map((leave) => leave.start_date).sort() : null)
  const values = sheet(row({ repeats: true, every_days: '14', until: '2026-11-23' }))

  it('shows every leave at once, and takes them all back on a refusal', async () => {
    let answer: (result: Result<Leave[]>) => void = () => undefined
    const { result } = render(() => new Promise((resolve) => (answer = resolve)))
    await waitFor(() => {
      expect(datesOf(result.current.week)).toEqual([])
    })
    let settled: Promise<unknown> = Promise.resolve()
    act(() => {
      settled = result.current.create.run(values, rotationOf)
    })
    await waitFor(() => {
      expect(datesOf(result.current.week)).toEqual(['2026-11-09', '2026-11-23'])
    })
    await act(async () => {
      answer({ ok: false, error: { code: 'forbidden' } })
      await settled
    })
    await waitFor(() => {
      expect(datesOf(result.current.week)).toEqual([])
    })
  })

  it('puts the answer\'s issues on the rows the leaves came from', async () => {
    const { result } = render(() =>
      Promise.resolve({
        ok: false,
        error: {
          code: 'validation_failed',
          issues: [
            { path: ['leaves', 1, 'start_date'], code: 'outside_rotation' },
            { path: ['leaves', 0, 'soldier_id'], code: 'not_a_member' },
          ],
        },
      }),
    )
    let answer: Result<Leave[]> | null = null
    await act(async () => {
      answer = await result.current.create.run(sheet(row(), row({ start_date: '2026-11-20', end_date: '2026-11-20' })), rotationOf)
    })
    expect(answer).toEqual({
      ok: false,
      error: {
        code: 'validation_failed',
        issues: [
          { path: ['rows', 1, 'start_date'], code: 'outside_rotation' },
          { path: ['soldier_id'], code: 'not_a_member' },
        ],
      },
    })
  })
})
