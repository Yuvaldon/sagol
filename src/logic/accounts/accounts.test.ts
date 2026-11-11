import { AccountLinkRequestId, CommandRankId, SoldierId, UnitId, type LinkCandidate } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  linkRequestIssues,
  newSoldierFromRequestIssues,
  reviewFormError,
  toRequestLinkInput,
  toReviewLinkInput,
} from './forms'
import { candidateRows } from './review'
import type { SoldierRow } from '../roster/roster'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const REQUEST = { id: AccountLinkRequestId.parse(uuid(1)) }

describe('the request form', () => {
  it('sends blank optional text as NULL, with new ids each time (D-044, D-101)', () => {
    const values = { first_name: 'דנה', last_name: 'לוי', claimed_personal_id: '  ' }
    const input = toRequestLinkInput(values)
    expect(input).toMatchObject({ first_name: 'דנה', last_name: 'לוי', claimed_personal_id: null })
    expect(toRequestLinkInput(values).id).not.toBe(input.id)
    expect(toRequestLinkInput({ ...values, claimed_personal_id: ' 123 ' }).claimed_personal_id).toBe('123')
  })

  it('reports field codes at the names the form uses (D-068)', () => {
    expect(linkRequestIssues({ first_name: 'דנה', last_name: 'לוי', claimed_personal_id: '' })).toEqual([])
    expect(linkRequestIssues({ first_name: '', last_name: 'לוי', claimed_personal_id: '' })).toEqual([
      { path: ['first_name'], code: 'required' },
    ])
    expect(linkRequestIssues({ first_name: 'דנה', last_name: 'לוי', claimed_personal_id: 'x'.repeat(51) })).toEqual([
      { path: ['claimed_personal_id'], code: 'too_long' },
    ])
  })
})

describe('the review forms', () => {
  const unit = UnitId.parse(uuid(10))
  const rank = CommandRankId.parse(uuid(11))

  it('builds each resolution with its own ids', () => {
    const soldierId = SoldierId.parse(uuid(2))
    const link = toReviewLinkInput(REQUEST, { kind: 'link', soldierId })
    expect(link).toMatchObject({ id: REQUEST.id, resolution: { kind: 'link', soldier_id: soldierId } })
    expect(toReviewLinkInput(REQUEST, { kind: 'reject' }).resolution).toEqual({ kind: 'reject' })
    const create = toReviewLinkInput(REQUEST, {
      kind: 'create_soldier',
      values: { command_rank_id: rank, membership: { unit_id: unit, valid_from: '2026-11-01' } },
    })
    expect(create.resolution).toMatchObject({
      kind: 'create_soldier',
      command_rank_id: rank,
      membership: { unit_id: unit, valid_from: '2026-11-01' },
    })
    const noUnit = toReviewLinkInput(REQUEST, {
      kind: 'create_soldier',
      values: { command_rank_id: null, membership: { unit_id: null, valid_from: '' } },
    })
    expect(noUnit.resolution).toMatchObject({ kind: 'create_soldier', command_rank_id: null, membership: null })
  })

  it('names the fields of a new soldier without the resolution, as the adapter answer does', () => {
    expect(newSoldierFromRequestIssues(REQUEST, { command_rank_id: null, membership: { unit_id: null, valid_from: '' } })).toEqual([])
    expect(
      newSoldierFromRequestIssues(REQUEST, { command_rank_id: null, membership: { unit_id: unit, valid_from: '' } }).map(
        (issue) => issue.path,
      ),
    ).toEqual([['membership', 'valid_from']])
    expect(
      reviewFormError({ code: 'validation_failed', issues: [{ path: ['resolution', 'membership', 'unit_id'], code: 'reference_not_found' }] }),
    ).toEqual({ code: 'validation_failed', issues: [{ path: ['membership', 'unit_id'], code: 'reference_not_found' }] })
    expect(reviewFormError({ code: 'forbidden' })).toEqual({ code: 'forbidden' })
  })
})

describe('candidateRows', () => {
  it('pairs each candidate with the soldier the reviewer reads, keeping the adapter order', () => {
    const a = SoldierId.parse(uuid(3))
    const b = SoldierId.parse(uuid(4))
    const candidates: LinkCandidate[] = [
      { soldier_id: b, match: 'personal_id' },
      { soldier_id: a, match: 'name' },
    ]
    const row = { soldier: { id: a } } as unknown as SoldierRow
    expect(candidateRows(candidates, [row])).toEqual([
      { candidate: candidates[0], row: null },
      { candidate: candidates[1], row },
    ])
  })
})
