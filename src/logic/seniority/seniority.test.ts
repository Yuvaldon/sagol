import { OrganizationId, SeniorityOverrideId, SoldierId, type SeniorityOverride } from '@contracts'
import { describe, expect, it } from 'vitest'
import { currentOverride, newSeniorityOverrideValues, overridesOf, seniorityOverrideIssues, toCreateSeniorityOverrideInput } from './seniority'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const SOLDIER = SoldierId.parse(uuid(1))
const OTHER = SoldierId.parse(uuid(2))

const override = (n: number, overrides: Partial<SeniorityOverride> = {}): SeniorityOverride => ({
  id: SeniorityOverrideId.parse(uuid(n)),
  organization_id: OrganizationId.parse(uuid(900)),
  soldier_id: SOLDIER,
  seniority: 7,
  valid_from: '2026-11-01',
  valid_to: null,
  reason: null,
  created_at: AT,
  created_by: null,
  revoked_at: null,
  revoked_by: null,
  ...overrides,
})

describe('seniority overrides (D-029, D-179)', () => {
  it('asks for a whole number, and keeps the end open', () => {
    const values = newSeniorityOverrideValues('2026-11-12')
    expect(seniorityOverrideIssues(SOLDIER, values)).toEqual([{ path: ['seniority'], code: 'required' }])
    expect(seniorityOverrideIssues(SOLDIER, { ...values, seniority: '2.5' }).map((issue) => issue.path)).toEqual([['seniority']])
    expect(toCreateSeniorityOverrideInput(SOLDIER, { ...values, seniority: ' 4 ', reason: ' ' })).toMatchObject({
      soldier_id: SOLDIER,
      seniority: 4,
      valid_from: '2026-11-12',
      valid_to: null,
      reason: null,
    })
  })

  it('refuses an end before the start', () => {
    const values = { ...newSeniorityOverrideValues('2026-11-12'), seniority: '4', valid_to: '2026-11-01' as const }
    expect(seniorityOverrideIssues(SOLDIER, values)).toEqual([{ path: ['valid_to'], code: 'range_inverted' }])
  })

  it('finds the override in force today, never a revoked one', () => {
    const revoked = override(2, { valid_from: '2026-11-10', revoked_at: AT })
    const all = [override(1), revoked, override(3, { soldier_id: OTHER })]
    expect(overridesOf(all, SOLDIER).map((row) => row.id)).toEqual([override(1).id, revoked.id])
    expect(currentOverride(all, SOLDIER, '2026-11-12')?.id).toBe(override(1).id)
    expect(currentOverride(all, SOLDIER, '2026-10-01')).toBeNull()
  })
})
