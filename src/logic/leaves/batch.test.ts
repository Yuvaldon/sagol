import { LeaveId, LeaveTypeId, OrganizationId, SoldierId, type Leave } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  duplicateLeaveIssues,
  leaveBatchIssues,
  newDuplicateValues,
  newLeaveBatchValues,
  toCreateLeaveBatchInput,
  toDuplicateLeaveInput,
} from './batch'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const TYPE = LeaveTypeId.parse(uuid(30))
const DANA = SoldierId.parse(uuid(1))
const ELI = SoldierId.parse(uuid(2))

describe('a collective leave (D-012, D-179)', () => {
  const filled = { ...newLeaveBatchValues('2026-11-12'), name: ' שבת ', soldier_ids: [DANA, ELI], leave_type_id: TYPE }

  it('asks for a name, soldiers and a type, each once on its field', () => {
    expect(leaveBatchIssues(newLeaveBatchValues('2026-11-12'), null).map((issue) => issue.path)).toEqual([['name'], ['soldier_ids']])
    const noType = { ...filled, leave_type_id: null }
    expect(leaveBatchIssues(noType, null)).toEqual([{ path: ['leave_type_id'], code: 'required' }])
    expect(leaveBatchIssues({ ...filled, end_date: '2026-11-01' }, null)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
  })

  it('asks for a reason the type requires', () => {
    expect(leaveBatchIssues(filled, { requires_reason: true }).map((issue) => issue.path)).toEqual([['reason']])
  })

  it('creates one leave for each soldier, with the same fields', () => {
    const input = toCreateLeaveBatchInput(filled)
    expect(input.batch).toMatchObject({ name: 'שבת', description: null })
    expect(input.leaves.map((leave) => leave.soldier_id)).toEqual([DANA, ELI])
    expect(new Set(input.leaves.map((leave) => leave.id)).size).toBe(2)
    expect(input.leaves[1]).toMatchObject({ leave_type_id: TYPE, start_date: '2026-11-12', end_date: '2026-11-12', reason: null })
  })
})

describe('duplicating a leave (D-049, D-179)', () => {
  const source: Leave = {
    id: LeaveId.parse(uuid(80)),
    organization_id: OrganizationId.parse(uuid(900)),
    soldier_id: DANA,
    leave_type_id: TYPE,
    batch_id: null,
    start_date: '2026-11-20',
    end_date: '2026-11-22',
    status: 'approved',
    reviewed_at: AT,
    reviewed_by: null,
    availability_effect_override: null,
    reason: null,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }

  it('starts from the source dates, and asks for a soldier', () => {
    const values = newDuplicateValues(source)
    expect(values).toMatchObject({ start_date: '2026-11-20', end_date: '2026-11-22', soldier_ids: [] })
    expect(duplicateLeaveIssues(source, values)).toEqual([{ path: ['soldier_ids'], code: 'too_short' }])
  })

  it('makes one copy for each soldier', () => {
    const input = toDuplicateLeaveInput(source, { ...newDuplicateValues(source), soldier_ids: [ELI, DANA], start_date: '2026-12-01', end_date: '2026-12-02' })
    expect(input.leave_id).toBe(source.id)
    expect(input.copies.map((copy) => [copy.soldier_id, copy.start_date, copy.end_date])).toEqual([
      [ELI, '2026-12-01', '2026-12-02'],
      [DANA, '2026-12-01', '2026-12-02'],
    ])
  })
})
