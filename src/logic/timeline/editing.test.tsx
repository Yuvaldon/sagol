import {
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  UpdateLeaveInput,
  type Leave,
  type PermissionCheck,
  type Result,
  type Soldier,
} from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { newLeaveValues } from '../leaves/forms'
import { toUpdateLeaveInput } from '../leaves/workflow'
import { fakePorts, wrapperOf } from '../testing/ports'
import { NewLeaveDraft } from '../view-state/draft'
import { WorkspaceSearch } from '../view-state/search'
import { dateWindowOf } from '../view-state/window'
import { datesOfRange, dayRangeOf, movedLeaveValues, newLeaveDraft, sameDates, useTimelineEditing } from './editing'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const YAEL = SoldierId.parse(uuid(1))
const DAN = SoldierId.parse(uuid(2))
const TYPE = LeaveTypeId.parse(uuid(30))
const AT = '2026-11-08T10:00:00.000Z'
const WINDOW = dateWindowOf({}, '2026-11-11')

function leave(n: number, overrides: Partial<Leave> = {}): Leave {
  return {
    id: LeaveId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: YAEL,
    leave_type_id: TYPE,
    batch_id: null,
    start_date: '2026-11-09',
    end_date: '2026-11-10',
    status: 'pending',
    availability_effect_override: null,
    reason: 'Wedding',
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: ACTOR,
    updated_at: AT,
    updated_by: ACTOR,
    version: 3,
    ...overrides,
  }
}

function soldier(id: SoldierId, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id,
    organization_id: ORGANIZATION,
    first_name: 'A',
    last_name: 'B',
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    archived_at: null,
    ...overrides,
  }
}

describe('the days of a drag (D-143)', () => {
  it('counts a leave in offsets from the window, also days outside it', () => {
    expect(dayRangeOf('2026-11-08', { start_date: '2026-11-06', end_date: '2026-11-10' })).toEqual({ start: -2, end: 2 })
    expect(datesOfRange('2026-11-08', { start: -2, end: 9 })).toEqual({ start_date: '2026-11-06', end_date: '2026-11-17' })
    expect(sameDates({ start_date: '2026-11-08', end_date: '2026-11-09' }, { start_date: '2026-11-08', end_date: '2026-11-09' })).toBe(true)
  })

  it('sends the dates only, whatever else the leave holds (D-123)', () => {
    const stored = leave(1)
    const values = movedLeaveValues(stored, { start_date: '2026-11-11', end_date: '2026-11-12' })
    expect(toUpdateLeaveInput(stored, values)).toEqual({
      id: stored.id,
      expected_version: 3,
      changes: { start_date: '2026-11-11', end_date: '2026-11-12' },
      acknowledged_rule_ids: [],
    })
    expect(UpdateLeaveInput.safeParse(toUpdateLeaveInput(stored, values)).success).toBe(true)
    // A drop on the same days sends nothing.
    expect(toUpdateLeaveInput(stored, movedLeaveValues(stored, stored))).toBeNull()
  })
})

describe('a new leave from a drag (D-143)', () => {
  const draft = newLeaveDraft(YAEL, { start_date: '2026-11-10', end_date: '2026-11-12' })

  it('fills the soldier and the days of the form, and leaves the type to choose', () => {
    expect(newLeaveValues('2026-11-08', true, draft)).toEqual({
      soldier_id: YAEL,
      leave_type_id: null,
      start_date: '2026-11-10',
      end_date: '2026-11-12',
      reason: '',
      as_approved: true,
    })
    expect(newLeaveValues('2026-11-08')).toMatchObject({ soldier_id: null, start_date: '2026-11-08', end_date: '2026-11-08' })
  })

  it('lives in the URL, and days in the wrong order count as absent', () => {
    expect(WorkspaceSearch.parse({ panel: 'leaves', entity: 'new', draft })).toMatchObject({ draft })
    expect(NewLeaveDraft.safeParse({ ...draft, end_date: '2026-11-01' }).success).toBe(false)
    expect(WorkspaceSearch.parse({ draft: { ...draft, end_date: '2026-11-01' } })).toEqual({})
  })
})

describe('what a drag may do (D-143)', () => {
  interface Fakes {
    readonly stored: readonly Leave[]
    readonly allowed?: (check: PermissionCheck) => boolean
    readonly policy?: 'keep_if_can_approve' | 'always_pending'
  }

  function render(fakes: Fakes, soldiers: readonly Soldier[]) {
    const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
    const allowed = fakes.allowed ?? (() => true)
    const organization = { id: ORGANIZATION, timezone: 'Asia/Jerusalem', settings: { reschedule_policy: fakes.policy ?? 'keep_if_can_approve' } }
    const ports = fakePorts({
      session: {
        current: () => Promise.resolve({ ok: true, value: session }),
        can: (checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(allowed) }),
      },
      repositories: {
        leaves: { list: () => Promise.resolve<Result<readonly Leave[]>>({ ok: true, value: fakes.stored }) },
        organizations: { current: () => Promise.resolve({ ok: true, value: organization }) },
      },
      now: () => AT,
    })
    return renderHook(() => useTimelineEditing(WINDOW, soldiers), { wrapper: wrapperOf(ports) })
  }

  const isUpdateOn = (soldierId: SoldierId) => (check: PermissionCheck) =>
    check.permission.action !== 'update' || (check.target.kind === 'soldier' && check.target.soldier_id === soldierId)

  it('moves an editable leave the actor may update, and marks a new leave only for who they may create one for', async () => {
    const pending = leave(1)
    const ofDan = leave(2, { soldier_id: DAN })
    const rejected = leave(3, { status: 'rejected' })
    const { result } = render(
      { stored: [pending, ofDan, rejected], allowed: (check) => isUpdateOn(YAEL)(check) && !(check.permission.action === 'create' && check.target.kind === 'soldier' && check.target.soldier_id === DAN) },
      [soldier(YAEL), soldier(DAN)],
    )
    await waitFor(() => {
      expect(result.current.leaveOf(pending.id)).toEqual(pending)
      expect(result.current.canMove(pending)).toBe(true)
    })
    expect(result.current.canMove(ofDan)).toBe(false)
    expect(result.current.canMove(rejected)).toBe(false)
    expect(result.current.canCreate(YAEL)).toBe(true)
    expect(result.current.canCreate(DAN)).toBe(false)
    expect(result.current.leaveOf(uuid(99))).toBeNull()
  })

  it('never moves a leave of an archived soldier, nor marks one on an inactive soldier (D-124, D-125)', async () => {
    const stored = leave(1)
    const { result } = render({ stored: [stored] }, [soldier(YAEL, { archived_at: AT, status: 'inactive' })])
    await waitFor(() => {
      expect(result.current.leaveOf(stored.id)).not.toBeNull()
    })
    expect(result.current.canMove(stored)).toBe(false)
    expect(result.current.canCreate(YAEL)).toBe(false)
  })

  it('says when a move returns an approved leave to pending, and judges the leave as it would be (D-064, D-142)', async () => {
    const stored = leave(1, { status: 'approved', reviewed_by: DAN, reviewed_at: AT })
    const dates = { start_date: '2026-11-11', end_date: '2026-11-12' } as const
    const keeps = render({ stored: [stored] }, [soldier(YAEL)])
    await waitFor(() => {
      expect(keeps.result.current.leaveOf(stored.id)).not.toBeNull()
      expect(keeps.result.current.move(stored, dates).candidate).toMatchObject({ status: 'approved', ...dates })
    })
    expect(keeps.result.current.move(stored, dates).returnsToPending).toBe(false)

    const resets = render({ stored: [stored], policy: 'always_pending' }, [soldier(YAEL)])
    await waitFor(() => {
      expect(resets.result.current.move(stored, dates).returnsToPending).toBe(true)
    })
    expect(resets.result.current.move(stored, dates).candidate).toMatchObject({ status: 'pending', ...dates })
  })
})
