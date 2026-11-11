import type {
  AccountLinkRequest,
  AccountLinkRequestId,
  AccountLinkResult,
  Permission,
  PermissionCheck,
  PolicyTarget,
  Result,
  Unit,
  UnitId,
} from '@contracts'
import { ACCOUNT_REVIEW_PERMISSION, placementTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { toRequestLinkInput, toReviewLinkInput, type LinkRequestValues, type LinkReview } from './forms'

// Asking to link, withdrawing, and reviewing the requests (D-148, D-149, D-150).

const PENDING = { statuses: ['pending' as const] }

/** The identity asks. A `linked` answer makes the session a linked one, so the screen changes by itself. */
export function useRequestLink() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.onboarding, QUERY_KEYS.session],
    (values: LinkRequestValues): Promise<Result<AccountLinkResult>> => data.commands.accounts.requestLink(toRequestLinkInput(values)),
  )
}

/** The identity withdraws its own pending request. */
export function useCancelLinkRequest() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.onboarding], (request: Pick<AccountLinkRequest, 'id'>) =>
    data.commands.accounts.cancelLinkRequest({ id: request.id }),
  )
}

/** The pending requests the actor may review, oldest first. */
export function usePendingLinkRequests(): Loaded<readonly AccountLinkRequest[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.accountLinkRequests, PENDING],
      queryFn: () => unwrap(data.repositories.account_link_requests.list(PENDING)),
    }),
  )
}

/** The candidates of one request the actor may name (D-149). */
export function useLinkCandidates(id: AccountLinkRequestId) {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.accountLinkRequests, 'candidates', id],
      queryFn: () => unwrap(data.repositories.account_link_requests.candidates(id)),
    }),
  )
}

export function useLinkReviewCommands() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.accountLinkRequests, QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    ({ request, review }: { request: Pick<AccountLinkRequest, 'id'>; review: LinkReview }) =>
      data.commands.accounts.reviewLink(toReviewLinkInput(request, review)),
  )
}

const ORGANIZATION: PolicyTarget = { kind: 'organization' }
const REVIEW_AT_ORGANIZATION: PermissionCheck = checkOf(ACCOUNT_REVIEW_PERMISSION, ORGANIZATION)
const REVIEW_CHECKS: readonly PermissionCheck[] = [REVIEW_AT_ORGANIZATION]

/**
 * Whether the account-links button is for this actor, and how many requests wait for them (D-150): who holds
 * `accounts:approve` at organization scope, or reads at least one pending request. A hint: the adapter filters again.
 */
export function useLinkReviewAccess(): { readonly allowed: boolean; readonly pending: number } {
  const can = useCan(REVIEW_CHECKS)
  const requests = usePendingLinkRequests()
  const pending = requests.status === 'ready' ? requests.value.length : 0
  return { allowed: can(REVIEW_AT_ORGANIZATION) || pending > 0, pending }
}

const P = {
  create: { resource: 'soldiers', action: 'create' },
  placement: { resource: 'memberships', action: 'update' },
} as const satisfies Record<string, Permission>

/** Where a new soldier made from a request may be placed: the same rights as a new soldier, and approval there (D-149). */
export function useLinkPlacements(units: readonly Unit[]) {
  const checks = useMemo(
    () => [
      checkOf(P.create, placementTarget(null)),
      checkOf(ACCOUNT_REVIEW_PERMISSION, placementTarget(null)),
      ...units.flatMap((unit) => [
        checkOf(P.create, placementTarget(unit.id)),
        checkOf(ACCOUNT_REVIEW_PERMISSION, placementTarget(unit.id)),
        checkOf(P.placement, { kind: 'unit' as const, unit_id: unit.id }),
      ]),
    ],
    [units],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const placeIn = (unitId: UnitId) =>
      can(checkOf(P.create, placementTarget(unitId))) &&
      can(checkOf(ACCOUNT_REVIEW_PERMISSION, placementTarget(unitId))) &&
      can(checkOf(P.placement, { kind: 'unit', unit_id: unitId }))
    const withoutUnit = can(checkOf(P.create, placementTarget(null))) && can(checkOf(ACCOUNT_REVIEW_PERMISSION, placementTarget(null)))
    return { placeIn, withoutUnit, any: withoutUnit || units.some((unit) => placeIn(unit.id)) }
  }, [can, units])
}
