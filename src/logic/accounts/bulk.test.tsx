import { AccountLinkRequest, AccountLinkRequestId, SoldierId, UnitId, type AppError, type LinkAssessment, type ReviewAccountLinkInput } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { joinGroups, useBulkLinkApproval, useJoinApproval } from './bulk'

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

describe('the page of "הצטרפות" (D-482)', () => {
  const request = (id: AccountLinkRequestId): AccountLinkRequest => AccountLinkRequest.parse({
    id,
    organization_id: uuid(90),
    auth_user_id: uuid(91),
    email: 'one@example.test',
    claimed_personal_id: null,
    first_name: 'א',
    last_name: 'ב',
    status: 'pending' as const,
    resolved_soldier_id: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-11-27T08:00:00Z',
  })
  const THIRD = AccountLinkRequestId.parse(uuid(3))

  it('groups the requests by readiness, in their order, and leaves out one not assessed yet', () => {
    const assessments: Record<string, LinkAssessment> = {
      [FIRST]: { readiness: 'needs_review', reason: 'several_candidates', candidates: [] },
      [SECOND]: { readiness: 'ready', candidates: [{ soldier_id: SOLDIER, match: 'name' }] },
    }
    const groups = joinGroups([request(FIRST), request(SECOND), request(THIRD)], assessments)
    expect(groups.ready.map((entry) => entry.request.id)).toEqual([SECOND])
    expect(groups.review.map((entry) => entry.request.id)).toEqual([FIRST])
    expect(groups.newSoldiers).toEqual([])
  })

  it('approves the ready ones and makes a new soldier of a placed one', async () => {
    const ready: LinkAssessment = { readiness: 'ready', candidates: [{ soldier_id: SOLDIER, match: 'name' }] }
    const reviews: ReviewAccountLinkInput[] = []
    const ports = fakePorts({
      repositories: { account_link_requests: { assessment: () => Promise.resolve({ ok: true, value: ready }) } },
      commands: {
        accounts: {
          reviewLink: (input: ReviewAccountLinkInput) => {
            reviews.push(input)
            return Promise.resolve({ ok: true, value: null })
          },
        },
      },
    })
    const { result } = renderHook(() => useJoinApproval(), { wrapper: wrapperOf(ports) })
    const UNIT = UnitId.parse(uuid(40))
    const answer = await act(() => result.current.run({ ready: [{ id: FIRST }], placed: [{ request: { id: SECOND }, unitId: UNIT }], today: '2026-11-27' }))
    expect(answer.ok && [...answer.value.keys()]).toEqual([FIRST, SECOND])
    expect(reviews.map((input) => input.resolution.kind)).toEqual(['link', 'create_soldier'])
    const created = reviews[1]?.resolution
    expect(created?.kind === 'create_soldier' && created.membership).toMatchObject({ unit_id: UNIT, valid_from: '2026-11-27' })
  })
})
