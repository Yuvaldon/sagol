import type { AccountLinkRequest, AppError, LinkCandidate, SoldierId } from '@contracts'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { toReviewLinkInput } from './forms'

// Approving several join requests (D-283): only a request whose soldier is certain is linked, by the single review
// command, one after the other. There is no bulk command.

/** The soldier a request links to in bulk: its one candidate, matched by personal number. Otherwise none. */
export function certainCandidate(candidates: readonly LinkCandidate[]): SoldierId | null {
  const [only] = candidates
  return candidates.length === 1 && only !== undefined && only.match === 'personal_id' ? only.soldier_id : null
}

/** A chosen request's outcome: linked, refused with the command's reason, or left for its own review. */
export type BulkLinkAnswer =
  | { readonly kind: 'linked' }
  | { readonly kind: 'refused'; readonly error: AppError }
  | { readonly kind: 'needs_review' }

export type BulkLinkAnswers = ReadonlyMap<AccountLinkRequest['id'], BulkLinkAnswer>

/**
 * Links each chosen request with a certain candidate, in order; every other one is left for its own review. The
 * candidates are read again at the run, so the decision uses what the adapter says now. A refusal does not stop the
 * rest. The answer is always a result, so the list refreshes for the requests that were linked.
 */
export function useBulkLinkApproval() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.accountLinkRequests, QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    async (requests: readonly Pick<AccountLinkRequest, 'id'>[]) => {
      const answers = new Map<AccountLinkRequest['id'], BulkLinkAnswer>()
      for (const request of requests) {
        const candidates = await data.repositories.account_link_requests.candidates(request.id)
        if (!candidates.ok) {
          answers.set(request.id, { kind: 'refused', error: candidates.error })
          continue
        }
        const soldierId = certainCandidate(candidates.value)
        if (soldierId === null) {
          answers.set(request.id, { kind: 'needs_review' })
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
