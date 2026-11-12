import { AccountLinkRequestId, SoldierId, type AppError, type LinkCandidate, type ReviewAccountLinkInput } from '@contracts'
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

describe('approving in bulk, run (D-283, OI-252)', () => {
  it('links the first of two requests with the same single candidate, and reports the second refused', async () => {
    const candidate: LinkCandidate = { soldier_id: SOLDIER, match: 'personal_id' }
    const linked = new Set<SoldierId>()
    const reviews: ReviewAccountLinkInput[] = []
    const ports = fakePorts({
      repositories: {
        account_link_requests: { candidates: () => Promise.resolve({ ok: true, value: [candidate] }) },
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
