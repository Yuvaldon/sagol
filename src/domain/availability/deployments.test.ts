import { CalendarDate } from '@contracts'
import { describe, expect, it } from 'vitest'
import { deploymentMemberIssues } from './deployments'

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
