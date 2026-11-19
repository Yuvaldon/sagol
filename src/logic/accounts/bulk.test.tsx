import { AccountLinkRequestId, SoldierId, type AppError, type LinkAssessment, type ReviewAccountLinkInput } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { useBulkLinkApproval } from './bulk'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const FIRST = AccountLinkRequestId.parse(uuid(1))
const SECOND = AccountLinkRequestId.parse(uuid(2))
const SOLDIER = SoldierId.parse(uuid(30))
const TAKEN: AppError = { code: 'validation_failed', issues: [{ path: ['resolution', 'soldier_id'], code: 'already_linked' }] }

describe('approving in bulk, run (D-283, D-448, OI-252)', () => {
  it('links the first of two requests with the same single candidate, and reports the second refused', async () => {
    const ready: LinkAssessment = { readiness: 'ready', candidates: [{ soldier_id: SOLDIER, match: 'name' }] }
    const linked = new Set<SoldierId>()
    const reviews: ReviewAccountLinkInput[] = []
    const ports = fakePorts({
      repositories: {
        account_link_requests: { assessment: () => Promise.resolve({ ok: true, value: ready }) },
      },
      commands: {
        accounts: {
          reviewLink: (input: ReviewAccountLinkInput) => {
            reviews.push(input)
            const resolution = input.resolution
            if (resolution.kind !== 'link') return Promise.resolve({ ok: false, error: { code: 'internal' } })
            if (linked.has(resolution.soldier_id)) return Promise.resolve({ ok: false, error: TAKEN })
            linked.add(resolution.soldier_id)
            return Promise.resolve({ ok: true, value: null })
          },
        },
      },
    })
    const { result } = renderHook(() => useBulkLinkApproval(), { wrapper: wrapperOf(ports) })
    const answer = await act(() => result.current.run([{ id: FIRST }, { id: SECOND }]))
    expect(answer.ok && [...answer.value]).toEqual([
      [FIRST, { kind: 'linked' }],
      [SECOND, { kind: 'refused', error: TAKEN }],
    ])
    expect(reviews.map((review) => review.id)).toEqual([FIRST, SECOND])
  })
})

describe('approving in bulk, a request that needs its own review (D-448)', () => {
  it('runs no review and answers with the reason, NULL when nothing matched', async () => {
    const assessments: Record<string, LinkAssessment> = {
      [FIRST]: { readiness: 'needs_review', reason: 'email_and_id_differ', candidates: [] },
      [SECOND]: { readiness: 'no_match', candidates: [] },
    }
    const reviews: ReviewAccountLinkInput[] = []
    const ports = fakePorts({
      repositories: {
        account_link_requests: {
          assessment: (id: AccountLinkRequestId) => {
            const value = assessments[id]
            return Promise.resolve(value === undefined ? { ok: false, error: { code: 'not_found' } } : { ok: true, value })
          },
        },
      },
      commands: {
        accounts: {
          reviewLink: (input: ReviewAccountLinkInput) => {
            reviews.push(input)
            return Promise.resolve({ ok: true, value: null })
          },
        },
      },
    })
    const { result } = renderHook(() => useBulkLinkApproval(), { wrapper: wrapperOf(ports) })
    const answer = await act(() => result.current.run([{ id: FIRST }, { id: SECOND }]))
    expect(answer.ok && [...answer.value]).toEqual([
      [FIRST, { kind: 'needs_review', reason: 'email_and_id_differ' }],
      [SECOND, { kind: 'needs_review', reason: null }],
    ])
    expect(reviews).toEqual([])
  })
})
