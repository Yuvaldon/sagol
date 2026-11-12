import { CalendarDate, DeploymentId } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  deploymentMemberIssues,
  rotationCloseEnd,
  rotationOverlapIssues,
  spansCoverRange,
  wholeUnitRotationIssues,
} from './deployments'

const day = (value: string) => CalendarDate.parse(value)
const OPEN = { start_date: day('2026-12-01'), end_date: null }
const CLOSED = { start_date: day('2026-12-01'), end_date: day('2026-12-20') }

describe('deployment members (D-179)', () => {
  it('accepts the deployment dates, and own dates that narrow them', () => {
    expect(deploymentMemberIssues(CLOSED, { start_date: null, end_date: null })).toEqual([])
    expect(deploymentMemberIssues(CLOSED, { start_date: day('2026-12-01'), end_date: day('2026-12-20') })).toEqual([])
    expect(deploymentMemberIssues(OPEN, { start_date: day('2027-03-01'), end_date: day('2027-04-01') })).toEqual([])
  })

  it('refuses a date outside the deployment, on that date', () => {
    expect(deploymentMemberIssues(CLOSED, { start_date: day('2026-11-30'), end_date: null })).toEqual([
      { path: ['start_date'], code: 'invalid_value' },
    ])
    expect(deploymentMemberIssues(CLOSED, { start_date: null, end_date: day('2026-12-21') })).toEqual([
      { path: ['end_date'], code: 'invalid_value' },
    ])
    expect(deploymentMemberIssues(CLOSED, { start_date: day('2026-12-21'), end_date: day('2026-11-30') })).toEqual([
      { path: ['start_date'], code: 'invalid_value' },
      { path: ['end_date'], code: 'invalid_value' },
    ])
  })
})

const rotation = (n: number, start: string, end: string | null, archived = false) => ({
  id: DeploymentId.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`),
  start_date: day(start),
  end_date: end === null ? null : day(end),
  archived_at: archived ? '2026-11-01T00:00:00Z' : null,
})

describe('one rotation at a time (D-257, D-221)', () => {
  const past = rotation(1, '2026-10-01', '2026-10-31')
  it('refuses a rotation that shares a day with a live one, on its start', () => {
    expect(rotationOverlapIssues(rotation(2, '2026-10-31', null), [past])).toEqual([
      { path: ['start_date'], code: 'rotation_overlap' },
    ])
    expect(rotationOverlapIssues(rotation(2, '2026-09-01', null), [past])).toEqual([
      { path: ['start_date'], code: 'rotation_overlap' },
    ])
  })
  it('allows the next day, itself, and an archived one', () => {
    expect(rotationOverlapIssues(rotation(2, '2026-11-01', null), [past])).toEqual([])
    expect(rotationOverlapIssues(past, [past])).toEqual([])
    expect(rotationOverlapIssues(rotation(2, '2026-10-15', null), [rotation(1, '2026-10-01', null, true)])).toEqual([])
  })
})

describe('closing a rotation (D-258, D-221)', () => {
  const today = day('2026-11-12')
  it('ends an open rotation today, and keeps an end already past', () => {
    expect(rotationCloseEnd({ ...OPEN, start_date: day('2026-11-01'), closed_at: null }, today)).toEqual({ end_date: today })
    expect(rotationCloseEnd({ ...CLOSED, start_date: day('2026-10-01'), end_date: day('2026-11-05'), closed_at: null }, today)).toEqual({
      end_date: day('2026-11-05'),
    })
  })
  it('refuses one that ends after today, has not started, or is closed already', () => {
    expect(rotationCloseEnd({ ...CLOSED, closed_at: null }, today)).toEqual({ issues: [{ path: ['id'], code: 'rotation_not_ended' }] })
    expect(rotationCloseEnd({ ...OPEN, closed_at: null }, today)).toEqual({ issues: [{ path: ['id'], code: 'rotation_not_ended' }] })
    expect(rotationCloseEnd({ ...CLOSED, closed_at: '2026-11-12T08:00:00Z' }, today)).toEqual({
      issues: [{ path: ['id'], code: 'rotation_closed' }],
    })
  })
})

describe('the whole unit (D-221)', () => {
  const spans = [
    { valid_from: day('2026-12-01'), valid_to: day('2026-12-05') },
    { valid_from: day('2026-12-06'), valid_to: day('2026-12-10') },
  ]
  it('covers a request across adjacent memberships, and no further', () => {
    expect(spansCoverRange(spans, { start_date: day('2026-12-04'), end_date: day('2026-12-08') })).toBe(true)
    expect(spansCoverRange(spans, { start_date: day('2026-12-09'), end_date: day('2026-12-11') })).toBe(false)
    expect(spansCoverRange([{ valid_from: day('2026-12-01'), valid_to: null }], CLOSED)).toBe(true)
  })
  it('answers outside_rotation before not_a_member', () => {
    expect(wholeUnitRotationIssues(CLOSED, spans, { start_date: day('2026-11-30'), end_date: day('2026-12-02') })).toEqual([
      { path: ['start_date'], code: 'outside_rotation' },
    ])
    expect(wholeUnitRotationIssues(CLOSED, spans, { start_date: day('2026-12-10'), end_date: day('2026-12-12') })).toEqual([
      { path: ['soldier_id'], code: 'not_a_member' },
    ])
    expect(wholeUnitRotationIssues(CLOSED, spans, { start_date: day('2026-12-02'), end_date: day('2026-12-09') })).toEqual([])
  })
})
