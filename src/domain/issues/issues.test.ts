import { describe, expect, it } from 'vitest'
import {
  CreateLeaveBatchInput,
  CreateLeaveInput,
  CreateLeaveTypeInput,
  ReviewAccountLinkInput,
  UpdateLeaveInput,
  type Issue,
} from '@contracts'
import { issuesFromSchema, withPathPrefix, type SchemaIssueLike } from './index'

// The mapping is exercised with real contract schemas (Zod 4 issues), so a Zod upgrade
// that changes issue shapes fails here (OI-016, D-068). Test data only (iron rule 4).

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function issuesOf(schema: { safeParse(input: unknown): { success: boolean; error?: { issues: readonly SchemaIssueLike[] } } }, input: unknown): Issue[] {
  const result = schema.safeParse(input)
  if (result.success || result.error === undefined) throw new Error('expected a failed parse')
  return issuesFromSchema(result.error.issues, input)
}

const leaveType = {
  id: uuid(1),
  group_id: null,
  name: 'Vacation',
  color_key: 'blue',
  icon_key: null,
  availability_effect: 'unavailable',
  requires_reason: false,
  sort_order: 0,
}

const leave = {
  id: uuid(2),
  soldier_id: uuid(3),
  start_date: '2026-11-10',
  end_date: '2026-11-12',
  leave_type_id: uuid(1),
  availability_effect_override: null,
  reason: null,
  properties: {},
  as_approved: false,
  acknowledged_rule_ids: [],
  comment: null,
}

describe('issuesFromSchema', () => {
  it('the fixtures are valid', () => {
    expect(CreateLeaveTypeInput.safeParse(leaveType).success).toBe(true)
    expect(CreateLeaveInput.safeParse(leave).success).toBe(true)
  })

  it('a missing or NULL value is required', () => {
    const { name: _name, ...withoutName } = leaveType
    expect(issuesOf(CreateLeaveTypeInput, withoutName)).toEqual([{ path: ['name'], code: 'required' }])
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, color_key: null })).toEqual([
      { path: ['color_key'], code: 'required' },
    ])
    const { availability_effect: _effect, ...withoutEffect } = leaveType
    expect(issuesOf(CreateLeaveTypeInput, withoutEffect)).toEqual([{ path: ['availability_effect'], code: 'required' }])
  })

  it('a blank name is required; lengths and magnitudes have their own codes', () => {
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, name: '   ' })).toEqual([{ path: ['name'], code: 'required' }])
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, name: 'x'.repeat(101) })).toEqual([
      { path: ['name'], code: 'too_long' },
    ])
    expect(
      issuesOf(UpdateLeaveInput, { id: uuid(2), expected_version: 0, changes: { reason: 'x' }, acknowledged_rule_ids: [] }),
    ).toEqual([{ path: ['expected_version'], code: 'too_small' }])
    expect(
      issuesOf(CreateLeaveBatchInput, {
        batch: { id: uuid(4), name: 'Round 1', description: null },
        leaves: [],
        as_approved: false,
        acknowledged_rule_ids: [],
      }),
    ).toEqual([{ path: ['leaves'], code: 'too_short' }])
  })

  it('types, integers, formats and enum values', () => {
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, requires_reason: 'yes' })).toEqual([
      { path: ['requires_reason'], code: 'invalid_type' },
    ])
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, sort_order: 1.5 })).toEqual([
      { path: ['sort_order'], code: 'not_integer' },
    ])
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, id: 'not-a-uuid' })).toEqual([
      { path: ['id'], code: 'invalid_format' },
    ])
    expect(issuesOf(CreateLeaveInput, { ...leave, start_date: '2026-02-30', end_date: '2026-03-01' })).toEqual([
      { path: ['start_date'], code: 'invalid_format' },
    ])
    expect(issuesOf(CreateLeaveTypeInput, { ...leaveType, availability_effect: 'gone' })).toEqual([
      { path: ['availability_effect'], code: 'invalid_value' },
    ])
  })

  it('unknown keys answer unknown_field at their own path', () => {
    expect(issuesOf(CreateLeaveInput, { ...leave, status: 'approved', organization_id: uuid(9) })).toEqual([
      { path: ['status'], code: 'unknown_field' },
      { path: ['organization_id'], code: 'unknown_field' },
    ])
    expect(
      issuesOf(UpdateLeaveInput, { id: uuid(2), expected_version: 1, changes: { status: 'approved' }, acknowledged_rule_ids: [] }),
    ).toEqual([
      { path: ['changes', 'status'], code: 'unknown_field' },
      // The status changes only through a transition, so no updatable field was set.
      { path: ['changes'], code: 'no_changes' },
    ])
  })

  it('contract refinements keep their IssueCode', () => {
    expect(issuesOf(CreateLeaveInput, { ...leave, end_date: '2026-11-01' })).toEqual([
      { path: ['end_date'], code: 'range_inverted' },
    ])
    expect(
      issuesOf(UpdateLeaveInput, { id: uuid(2), expected_version: 1, changes: {}, acknowledged_rule_ids: [] }),
    ).toEqual([{ path: ['changes'], code: 'no_changes' }])
    expect(issuesOf(CreateLeaveInput, { ...leave, acknowledged_rule_ids: [uuid(5)], properties: { [uuid(6)]: 1, x: 2 } })).toEqual([
      { path: ['properties', 'x'], code: 'invalid_value' },
    ])
  })

  it('a wrong or missing discriminator', () => {
    expect(issuesOf(ReviewAccountLinkInput, { id: uuid(7), resolution: { kind: 'merge' } })).toEqual([
      { path: ['resolution', 'kind'], code: 'invalid_value' },
    ])
    expect(issuesOf(ReviewAccountLinkInput, { id: uuid(7), resolution: {} })).toEqual([
      { path: ['resolution', 'kind'], code: 'required' },
    ])
  })

  it('maps each (path, code) once, and does not read inherited keys as values', () => {
    const repeated: SchemaIssueLike[] = [
      { code: 'invalid_type', path: ['a'], message: 'x', expected: 'string' },
      { code: 'invalid_type', path: ['a'], message: 'y', expected: 'string' },
      { code: 'invalid_type', path: ['toString'], message: 'z', expected: 'string' },
      { code: 'custom', path: [], message: 'not a code' },
      { code: 'not_multiple_of', path: ['n'], message: 'x' },
    ]
    expect(issuesFromSchema(repeated, { a: 1, n: 3 })).toEqual([
      { path: ['a'], code: 'invalid_type' },
      { path: ['toString'], code: 'required' },
      { path: [], code: 'invalid_value' },
      { path: ['n'], code: 'invalid_value' },
    ])
  })
})

describe('withPathPrefix', () => {
  it('nests row-relative issues under the input field', () => {
    expect(withPathPrefix(['changes'], [{ path: ['properties', 'p'], code: 'property_required' }])).toEqual([
      { path: ['changes', 'properties', 'p'], code: 'property_required' },
    ])
  })
})
