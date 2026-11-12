import {
  DeploymentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  type Leave,
  type LeaveType,
  type LeaveTypeGroup,
  type PermissionCheck,
  type Result,
} from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, organizationIn, wrapperOf } from '../testing/ports'
import { boardLeaves } from '../board/leaves'
import { WorkspaceSearch } from '../view-state/search'
import { useLeaveCreation } from './hooks'
import { NEW_LEAVE_TYPE_VALUES, leaveTypeFormValues, leaveTypeSections, toUpdateLeaveTypeInput } from './leaveTypes'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const YAEL = SoldierId.parse(uuid(1))
const AT = '2026-11-08T10:00:00.000Z'
const ROTATION = DeploymentId.parse(uuid(70))
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
    deployment_id: ROTATION,
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
describe('the bar colors in the URL (D-112)', () => {
  it('keeps a known mode and counts anything else as absent', () => {
    expect(WorkspaceSearch.parse({ colors: 'uniform' }).colors).toBe('uniform')
    expect(WorkspaceSearch.parse({ colors: 'rainbow' }).colors).toBeUndefined()
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
