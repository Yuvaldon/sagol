import type { AppError } from '@contracts'
import { t } from '@i18n'
import type { BulkLinkAnswers } from '@logic'

// What "אישור N" did (D-484), in one line: how many were approved, how many were left for their own review, and the
// first refusal, said beside them.

const SEPARATOR = ' · '
const WORD = ' '

export function joinOutcome(answers: BulkLinkAnswers): { readonly done: string; readonly refusal: AppError | null } {
  const all = [...answers.values()]
  const linked = all.filter((answer) => answer.kind === 'linked').length
  const review = all.filter((answer) => answer.kind === 'needs_review').length
  const refused = all.find((answer) => answer.kind === 'refused')
  const done = [
    [String(linked), t('manage.joins.linkedMany')].join(WORD),
    ...(review === 0 ? [] : [[String(review), t('manage.joins.leftForReview')].join(WORD)]),
  ].join(SEPARATOR)
  return { done, refusal: refused?.kind === 'refused' ? refused.error : null }
}
