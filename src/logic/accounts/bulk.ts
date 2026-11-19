import { LinkReadiness, type AccountLinkRequest, type AppError, type LinkAssessment, type LinkReviewReason, type SoldierId } from '@contracts'
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
