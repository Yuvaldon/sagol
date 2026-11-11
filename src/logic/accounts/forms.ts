import {
  AccountLinkRequestId,
  CommandRankId,
  RequestAccountLinkInput,
  ReviewAccountLinkInput,
  SoldierAccountId,
  SoldierId,
  UnitMembershipId,
  type AccountLinkRequest,
  type AppError,
  type CalendarDate,
  type Issue,
  type UnitId,
} from '@contracts'
import { optionalText } from '@domain'
import { formIssues } from '../forms/issues'

// Between the account-link forms and their command inputs (D-148, D-149). Ids are generated here, by the caller (D-044).
// Optional text holds '' on screen and NULL in a row (D-101).

// ------------------------------------------------------------------- asking

/** What the onboarding form edits. Field names follow `RequestAccountLinkInput`. */
export interface LinkRequestValues {
  readonly first_name: string
  readonly last_name: string
  readonly claimed_personal_id: string
}

export const NEW_LINK_REQUEST_VALUES: LinkRequestValues = { first_name: '', last_name: '', claimed_personal_id: '' }

function requestInput(values: LinkRequestValues) {
  return {
    id: AccountLinkRequestId.parse(crypto.randomUUID()),
    account_id: SoldierAccountId.parse(crypto.randomUUID()),
    first_name: values.first_name,
    last_name: values.last_name,
    claimed_personal_id: optionalText(values.claimed_personal_id.trim()),
  }
}

export function linkRequestIssues(values: LinkRequestValues): Issue[] {
  return formIssues(RequestAccountLinkInput, requestInput(values))
}

export function toRequestLinkInput(values: LinkRequestValues): RequestAccountLinkInput {
  return RequestAccountLinkInput.parse(requestInput(values))
}

// ------------------------------------------------------------------ reviewing

/** The form of a new soldier made from a request: the names come from the request (D-149). */
export interface NewSoldierFromRequestValues {
  readonly command_rank_id: CommandRankId | null
  readonly membership: { readonly unit_id: UnitId | null; readonly valid_from: CalendarDate }
}

/** What a review does to a request. */
export type LinkReview =
  | { readonly kind: 'link'; readonly soldierId: SoldierId }
  | { readonly kind: 'create_soldier'; readonly values: NewSoldierFromRequestValues }
  | { readonly kind: 'reject' }

function resolutionOf(review: LinkReview): ReviewAccountLinkInput['resolution'] {
  if (review.kind === 'reject') return { kind: 'reject' }
  const account_id = SoldierAccountId.parse(crypto.randomUUID())
  if (review.kind === 'link') return { kind: 'link', account_id, soldier_id: review.soldierId }
  const { membership } = review.values
  return {
    kind: 'create_soldier',
    account_id,
    soldier_id: SoldierId.parse(crypto.randomUUID()),
    command_rank_id: review.values.command_rank_id,
    membership:
      membership.unit_id === null
        ? null
        : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: membership.unit_id, valid_from: membership.valid_from },
  }
}

export function toReviewLinkInput(request: Pick<AccountLinkRequest, 'id'>, review: LinkReview): ReviewAccountLinkInput {
  return ReviewAccountLinkInput.parse({ id: request.id, resolution: resolutionOf(review) })
}

/** A form names its fields without the `resolution` the command's input puts them under. */
function withoutResolution(issue: Issue): Issue {
  return issue.path[0] === 'resolution' ? { path: issue.path.slice(1), code: issue.code } : issue
}

export function newSoldierFromRequestIssues(request: Pick<AccountLinkRequest, 'id'>, values: NewSoldierFromRequestValues): Issue[] {
  return formIssues(ReviewAccountLinkInput, { id: request.id, resolution: resolutionOf({ kind: 'create_soldier', values }) }).map(
    withoutResolution,
  )
}

/** The adapter's answer to a review, with its field paths named as the form names them. */
export function reviewFormError(error: AppError): AppError {
  return error.code === 'validation_failed' ? { code: 'validation_failed', issues: error.issues.map(withoutResolution) } : error
}
