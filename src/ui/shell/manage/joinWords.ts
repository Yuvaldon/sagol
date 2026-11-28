import type { LinkReviewReason } from '@contracts'
import type { I18nKey } from '@i18n'

// Why a join request waits for its own review (D-447), as the page's chip says it and the drawer's block explains it
// (D-482, OI-382).

export const REASON_CHIPS: Readonly<Record<LinkReviewReason, I18nKey>> = {
  personal_id_differs: 'manage.joins.reasons.personal_id_differs',
  several_candidates: 'manage.joins.reasons.several_candidates',
  email_and_id_differ: 'manage.joins.reasons.email_and_id_differ',
  invite_email_differs: 'manage.joins.reasons.invite_email_differs',
  name_differs: 'manage.joins.reasons.name_differs',
  previously_unlinked: 'manage.joins.reasons.previously_unlinked',
}
