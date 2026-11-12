import {
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  type Leave,
  type LeaveQuery,
  type LeaveType,
  type LeaveTypeGroup,
  type PermissionCheck,
  type Result,
} from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LogicPorts } from '../ports'
import { fakePorts, organizationIn, wrapperOf } from '../testing/ports'
import { boardLeaves } from '../board/leaves'
import { WorkspaceSearch } from '../view-state/search'
import type { DateWindow } from '../view-state/window'
import { newLeaveIssues, newLeaveValues, optimisticLeave, toCreateLeaveInput } from './forms'
import { useCreateLeave, useLeaveCreation, useLeaves } from './hooks'
import { NEW_LEAVE_TYPE_VALUES, leaveTypeFormValues, leaveTypeSections, toUpdateLeaveTypeInput } from './leaveTypes'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const YAEL = SoldierId.parse(uuid(1))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

function group(n: number, sort_order: number, archived = false): LeaveTypeGroup {
  return { id: LeaveTypeGroupId.parse(uuid(n)), organization_id: ORGANIZATION, name: `G${n}`, sort_order, ...audit, archived_at: archived ? AT : null }
}

function type(n: number, groupN: number | null, sort_order: number, overrides: Partial<LeaveType> = {}): LeaveType {
  return {
    id: LeaveTypeId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    group_id: groupN === null ? null : LeaveTypeGroupId.parse(uuid(groupN)),
    name: `T${n}`,
    color_key: 'teal',
    icon_key: null,
    availability_effect: 'unavailable',
    requires_reason: false,
    sort_order,
    ...audit,
    ...overrides,
  }
}

function leave(n: number, typeN: number, start_date: string, end_date: string, overrides: Partial<Leave> = {}): Leave {
  return {
    id: LeaveId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: YAEL,
    leave_type_id: LeaveTypeId.parse(uuid(typeN)),
    batch_id: null,
    start_date,
    end_date,
    status: 'pending',
    availability_effect_override: null,
    reason: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: ACTOR,
    updated_at: AT,
    updated_by: ACTOR,
    version: 1,
    ...overrides,
  }
}

describe('leave type sections (D-113)', () => {
  it('lists live groups in order, each with its live types, then the types with no live group', () => {
    const groups = [group(20, 1), group(21, 0), group(22, 2, true)]
    const types = [
      type(30, 20, 1),
      type(31, 20, 0),
      type(32, 22, 0),
      type(33, null, 0),
      type(34, 21, 0, { archived_at: AT }),
    ]
    const sections = leaveTypeSections(groups, types)
    expect(sections.map((section) => [section.group?.name ?? null, section.types.map((row) => row.name)])).toEqual([
      ['G21', []],
      ['G20', ['T31', 'T30']],
      [null, ['T32', 'T33']],
    ])
  })

  it('has no section of loose types when every type has a live group', () => {
    expect(leaveTypeSections([group(20, 0)], [type(30, 20, 0)])).toHaveLength(1)
  })

  it('sends only what changed, and nothing when nothing did', () => {
    const stored = type(30, null, 0)
    expect(toUpdateLeaveTypeInput(stored, 1, leaveTypeFormValues(stored))).toBeNull()
    const values = { ...leaveTypeFormValues(stored), name: 'Course', requires_reason: true }
    expect(toUpdateLeaveTypeInput(stored, 3, values)).toEqual({
      id: stored.id,
      expected_version: 3,
      changes: { name: 'Course', requires_reason: true },
    })
  })

  it('starts a new type as an absence with no reason (D-032)', () => {
    expect(NEW_LEAVE_TYPE_VALUES).toMatchObject({ availability_effect: 'unavailable', requires_reason: false, color_key: null })
  })
})

describe('the new-leave form (D-115)', () => {
  const TODAY = '2026-11-08'

  it('starts on today, unapproved, with nothing chosen', () => {
    expect(newLeaveValues(TODAY)).toEqual({
      soldier_id: null,
      leave_type_id: null,
      start_date: TODAY,
      end_date: TODAY,
      reason: '',
      as_approved: false,
    })
  })

  it('answers the codes the command answers', () => {
    const blank = newLeaveIssues(newLeaveValues(TODAY), null)
    expect(blank).toEqual([
      { path: ['soldier_id'], code: 'required' },
      { path: ['leave_type_id'], code: 'required' },
    ])
    const chosen = { ...newLeaveValues(TODAY), soldier_id: YAEL, leave_type_id: type(30, null, 0).id }
    expect(newLeaveIssues({ ...chosen, end_date: '2026-11-07' }, null)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
    expect(newLeaveIssues({ ...chosen, reason: '  ' }, { requires_reason: true })).toEqual([
      { path: ['reason'], code: 'reason_required' },
    ])
    expect(newLeaveIssues({ ...chosen, reason: 'Wedding' }, { requires_reason: true })).toEqual([])
  })

  it('sends a blank reason as NULL (D-101)', () => {
    const chosen = { ...newLeaveValues(TODAY), soldier_id: YAEL, leave_type_id: type(30, null, 0).id, reason: ' ' }
    expect(toCreateLeaveInput(chosen).reason).toBeNull()
  })

  it('shows the leave as the command will write it', () => {
    const chosen = { ...newLeaveValues(TODAY), soldier_id: YAEL, leave_type_id: type(30, null, 0).id }
    const actor = { soldier_id: ACTOR, organization_id: ORGANIZATION }
    expect(optimisticLeave(toCreateLeaveInput(chosen), actor, AT)).toMatchObject({ status: 'pending', reviewed_by: null })
    const approved = optimisticLeave(toCreateLeaveInput({ ...chosen, as_approved: true }), actor, AT)
    expect(approved).toMatchObject({ status: 'approved', reviewed_by: ACTOR, reviewed_at: AT, created_by: ACTOR })
  })
})

describe('the leaves of a timeline row (D-111)', () => {
  it('orders by first day, and takes the effect of the override, the type, or the default', () => {
    const types = [type(30, null, 0), type(31, null, 0, { availability_effect: 'available' })]
    const leaves = [
      leave(2, 31, '2026-11-10', '2026-11-10'),
      leave(1, 30, '2026-11-08', '2026-11-09', { availability_effect_override: 'available' }),
      leave(3, 99, '2026-11-12', '2026-11-12'),
    ]
    const drawn = boardLeaves(leaves, types).get(YAEL) ?? []
    expect(drawn.map((row) => [row.start_date, row.effect, row.type?.name ?? null])).toEqual([
      ['2026-11-08', 'available', 'T30'],
      ['2026-11-10', 'available', 'T31'],
      ['2026-11-12', 'unavailable', null],
    ])
  })
})

// ------------------------------------------------------------ the optimistic create

describe('creating a leave with an optimistic update (D-115)', () => {
  const WINDOW: DateWindow = {
    from: '2026-11-08',
    to: '2026-11-14',
    days: [],
    followsToday: true,
    holdsToday: true,
  }
  const OTHER_WEEK: DateWindow = { ...WINDOW, from: '2026-12-06', to: '2026-12-12' }

  function portsWith(create: () => Promise<Result<Leave>>) {
    const list = vi.fn((_query: LeaveQuery) => Promise.resolve<Result<Leave[]>>({ ok: true, value: [] }))
    const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
    const ports = fakePorts({
      session: { current: () => Promise.resolve({ ok: true, value: session }) },
      repositories: { leaves: { list } },
      commands: { leaves: { create } },
      now: () => AT,
    })
    return { ports, list }
  }

  const values = {
    ...newLeaveValues('2026-11-09'),
    soldier_id: YAEL,
    leave_type_id: LeaveTypeId.parse(uuid(30)),
  }

  function render(ports: LogicPorts) {
    return renderHook(
      () => ({ week: useLeaves(WINDOW), other: useLeaves(OTHER_WEEK), create: useCreateLeave() }),
      { wrapper: wrapperOf(ports) },
    )
  }

  const idsOf = (state: ReturnType<typeof useLeaves>) => (state.status === 'ready' ? state.value.map((row) => row.status) : null)

  it('shows the leave in the windows it overlaps at once, and takes it back on a refusal', async () => {
    let answer: (result: Result<Leave>) => void = () => undefined
    const { ports } = portsWith(() => new Promise((resolve) => (answer = resolve)))
    const { result } = render(ports)
    await waitFor(() => {
      expect(idsOf(result.current.week)).toEqual([])
      expect(idsOf(result.current.other)).toEqual([])
    })
    let settled: Promise<unknown> = Promise.resolve()
    act(() => {
      settled = result.current.create.run(values)
    })
    await waitFor(() => {
      expect(idsOf(result.current.week)).toEqual(['pending'])
    })
    expect(idsOf(result.current.other)).toEqual([])
    await act(async () => {
      answer({ ok: false, error: { code: 'forbidden' } })
      await settled
    })
    await waitFor(() => {
      expect(idsOf(result.current.week)).toEqual([])
    })
  })

  it('asks the adapter again once the command answers', async () => {
    const { ports, list } = portsWith(() => Promise.resolve({ ok: true, value: leave(1, 30, '2026-11-09', '2026-11-09') }))
    const { result } = render(ports)
    await waitFor(() => {
      expect(idsOf(result.current.week)).toEqual([])
    })
    const before = list.mock.calls.length
    await act(async () => {
      await result.current.create.run(values)
    })
    expect(list.mock.calls.length).toBeGreaterThan(before)
  })
})

describe('the bar colors in the URL (D-112)', () => {
  it('keeps a known mode and counts anything else as absent', () => {
    expect(WorkspaceSearch.parse({ colors: 'uniform' }).colors).toBe('uniform')
    expect(WorkspaceSearch.parse({ colors: 'rainbow' }).colors).toBeUndefined()
  })
})

describe('an empty date on the new-leave form', () => {
  it('answers required, as the command would', () => {
    const values = { ...newLeaveValues('2026-11-08'), soldier_id: YAEL, leave_type_id: LeaveTypeId.parse(uuid(30)), end_date: '' as const }
    expect(newLeaveIssues(values, null)).toEqual([{ path: ['end_date'], code: 'required' }])
  })
})

describe('who the new-leave form offers (D-125, OI-078)', () => {
  it('offers active soldiers only, while approving still looks at everyone', async () => {
    const person = (n: number, status: 'active' | 'inactive') => ({
      id: SoldierId.parse(uuid(n)),
      organization_id: ORGANIZATION,
      first_name: `F${n}`,
      last_name: `L${n}`,
      nickname: null,
      command_rank_id: null,
      status,
      properties: {},
      ...audit,
    })
    const active = person(1, 'active')
    const inactive = person(2, 'inactive')
    // The actor may create a leave for both, and approve only the inactive one.
    const can = vi.fn((checks: readonly PermissionCheck[]) =>
      Promise.resolve<Result<boolean[]>>({
        ok: true,
        value: checks.map((check) => check.permission.action === 'create' || check.target.kind !== 'soldier' || check.target.soldier_id === inactive.id),
      }),
    )
    const ports = fakePorts({ session: { can }, repositories: { organizations: organizationIn() }, now: () => AT })
    const { result } = renderHook(() => useLeaveCreation([active, inactive]), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.approvesAny).toBe(true)
    })
    expect(result.current.soldiers.map((soldier) => soldier.id)).toEqual([active.id])
  })
})
