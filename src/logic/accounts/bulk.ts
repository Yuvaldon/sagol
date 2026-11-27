import { LinkReadiness, type AccountLinkRequest, type AppError, type CalendarDate, type LinkAssessment, type LinkReviewReason, type SoldierId, type UnitId } from '@contracts'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { toReviewLinkInput } from './forms'

// Approving several join requests (D-283, D-448): every `ready` request is linked, by the single review command, one
// after the other. There is no bulk command.

/** The soldier a request links to in bulk: the best candidate of a `ready` request (D-447). Otherwise none. */
export function readyCandidate(assessment: LinkAssessment): SoldierId | null {
  const [best] = assessment.candidates
  return assessment.readiness === LinkReadiness.enum.ready && best !== undefined ? best.soldier_id : null
}

/** Why a request was left for its own review: the assessment's reason, NULL when nothing matched (D-448). */
function reviewReason(assessment: LinkAssessment): LinkReviewReason | null {
  return assessment.readiness === LinkReadiness.enum.needs_review ? assessment.reason : null
}

/** A chosen request's outcome: linked, refused with the command's reason, or left for its own review. */
export type BulkLinkAnswer =
  | { readonly kind: 'linked' }
  | { readonly kind: 'refused'; readonly error: AppError }
  | { readonly kind: 'needs_review'; readonly reason: LinkReviewReason | null }

export type BulkLinkAnswers = ReadonlyMap<AccountLinkRequest['id'], BulkLinkAnswer>

/**
 * Links each chosen `ready` request, in order; every other one is left for its own review, with the reason. The
 * assessment is read again at the run, so the decision uses what the adapter says now. A refusal does not stop the
 * rest. The answer is always a result, so the list refreshes for the requests that were linked.
 */
export function useBulkLinkApproval() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.accountLinkRequests, QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    async (requests: readonly Pick<AccountLinkRequest, 'id'>[]) => {
      const answers = new Map<AccountLinkRequest['id'], BulkLinkAnswer>()
      for (const request of requests) {
        const assessment = await data.repositories.account_link_requests.assessment(request.id)
        if (!assessment.ok) {
          answers.set(request.id, { kind: 'refused', error: assessment.error })
          continue
        }
        const soldierId = readyCandidate(assessment.value)
        if (soldierId === null) {
          answers.set(request.id, { kind: 'needs_review', reason: reviewReason(assessment.value) })
          continue
        }
        const result = await data.commands.accounts.reviewLink(toReviewLinkInput(request, { kind: 'link', soldierId }))
        answers.set(request.id, result.ok ? { kind: 'linked' } : { kind: 'refused', error: result.error })
      }
      const answer: { ok: true; value: BulkLinkAnswers } = { ok: true, value: answers }
      return answer
    },
  )
}

/**
 * A pending join request with its readiness (D-447), as the page of "הצטרפות" lists it (D-482): ready, to review with
 * the reason, or with no candidate, which only a new soldier answers.
 */
export interface JoinEntry {
  readonly request: AccountLinkRequest
  readonly assessment: LinkAssessment
}

export interface JoinGroups {
  readonly ready: readonly JoinEntry[]
  readonly review: readonly JoinEntry[]
  readonly newSoldiers: readonly JoinEntry[]
}

/** The requests in the page's groups, each in the order the adapter gave (oldest first). A request still assessed is in none. */
export function joinGroups(requests: readonly AccountLinkRequest[], assessments: Readonly<Record<string, LinkAssessment>>): JoinGroups {
  const entries = requests.flatMap((request) => {
    const assessment = assessments[request.id]
    return assessment === undefined ? [] : [{ request, assessment }]
  })
  return {
    ready: entries.filter((entry) => entry.assessment.readiness === LinkReadiness.enum.ready),
    review: entries.filter((entry) => entry.assessment.readiness === LinkReadiness.enum.needs_review),
    newSoldiers: entries.filter((entry) => entry.assessment.readiness === LinkReadiness.enum.no_match),
  }
}

/** A request with no candidate, and the unit its new soldier goes to from today (the handoff's "מחלקה" chip). */
export interface JoinPlacement {
  readonly request: Pick<AccountLinkRequest, 'id'>
  readonly unitId: UnitId
}

/**
 * "אישור N" (D-482): every chosen `ready` request is linked, as `useBulkLinkApproval` links them, and every request with
 * no candidate that has its unit becomes a new soldier there from `today`, linked to it. One after another; a refusal
 * does not stop the rest.
 */
export function useJoinApproval() {
  const { data } = usePorts()
  const link = useBulkLinkApproval()
  return useCommand(
    [QUERY_KEYS.accountLinkRequests, QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    async ({ ready, placed, today }: { ready: readonly Pick<AccountLinkRequest, 'id'>[]; placed: readonly JoinPlacement[]; today: CalendarDate }) => {
      const linked = ready.length === 0 ? null : await link.run(ready)
      const answers = new Map<AccountLinkRequest['id'], BulkLinkAnswer>(linked?.ok === true ? linked.value : [])
      for (const { request, unitId } of placed) {
        const values = { command_rank_id: null, membership: { unit_id: unitId, valid_from: today } }
        const result = await data.commands.accounts.reviewLink(toReviewLinkInput(request, { kind: 'create_soldier', values }))
        answers.set(request.id, result.ok ? { kind: 'linked' } : { kind: 'refused', error: result.error })
      }
      const answer: { ok: true; value: BulkLinkAnswers } = { ok: true, value: answers }
      return answer
    },
  )
}
