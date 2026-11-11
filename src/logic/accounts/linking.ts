import {
  AccountLinkRequestId,
  RequestAccountLinkInput,
  SoldierAccountId,
  SoldierId,
  UnitMembershipId,
  type AccountLinkRequest,
  type AppError,
  type CalendarDate,
  type Issue,
  type ReviewAccountLinkInput,
  type SoldierAccount,
  type UnitId,
} from '@contracts'
import { optionalText } from '@domain'
import { formIssues } from '../forms/issues'

// Between the linking screens and the account commands (D-030, D-156). Ids are generated here (D-044).

/** What the onboarding request form edits. The personal id is optional: names alone reach review. */
export interface LinkRequestValues {
  readonly first_name: string
  readonly last_name: string
  readonly personal_id: string
}

function requestInput(values: LinkRequestValues): RequestAccountLinkInput {
  return {
    id: AccountLinkRequestId.parse(crypto.randomUUID()),
    claimed_personal_id: optionalText(values.personal_id),
    first_name: values.first_name,
    last_name: values.last_name,
    account_id: SoldierAccountId.parse(crypto.randomUUID()),
  }
}

function asFormIssue(issue: Issue): Issue {
  return issue.path[0] === 'claimed_personal_id' ? { ...issue, path: ['personal_id', ...issue.path.slice(1)] } : issue
}

/** Field issues, named as the form names them (`personal_id`, not `claimed_personal_id`). */
export function linkRequestIssues(values: LinkRequestValues): Issue[] {
  return formIssues(RequestAccountLinkInput, requestInput(values)).map(asFormIssue)
}

/** A refusal of the request, its issues named as the form names them. */
export function asLinkRequestFormError(error: AppError): AppError {
  return error.code === 'validation_failed' ? { ...error, issues: error.issues.map(asFormIssue) } : error
}

export function toRequestLinkInput(values: LinkRequestValues): RequestAccountLinkInput {
  return RequestAccountLinkInput.parse(requestInput(values))
}

/** What a reviewer decides about one request. */
export type LinkReviewChoice =
  | { readonly kind: 'link'; readonly soldier_id: SoldierId }
  | {
      readonly kind: 'create_soldier'
      /** Where the new soldier is placed from which day, or nowhere yet. */
      readonly placement: { readonly unit_id: UnitId; readonly valid_from: CalendarDate } | null
    }
  | { readonly kind: 'reject' }

export function toReviewLinkInput(request: AccountLinkRequest, choice: LinkReviewChoice): ReviewAccountLinkInput {
  switch (choice.kind) {
    case 'link':
      return {
        id: request.id,
        resolution: { kind: 'link', account_id: SoldierAccountId.parse(crypto.randomUUID()), soldier_id: choice.soldier_id },
      }
    case 'create_soldier':
      return {
        id: request.id,
        resolution: {
          kind: 'create_soldier',
          account_id: SoldierAccountId.parse(crypto.randomUUID()),
          soldier_id: SoldierId.parse(crypto.randomUUID()),
          command_rank_id: null,
          membership: choice.placement === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), ...choice.placement },
        },
      }
    case 'reject':
      return { id: request.id, resolution: { kind: 'reject' } }
    default:
      return choice satisfies never
  }
}

/** The link in force, if any: at most one account of a soldier is not revoked (D-005). */
export function activeAccountOf(accounts: readonly SoldierAccount[]): SoldierAccount | null {
  return accounts.find((account) => account.revoked_at === null) ?? null
}
