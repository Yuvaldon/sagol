import type {
  AccountLinkRequest,
  AccountLinkRequestId,
  AccountLinkRequestQuery,
  LinkCandidate,
  Permission,
  PermissionCheck,
  PolicyTarget,
  Soldier,
  SoldierAccount,
  SoldierId,
  Unit,
  UnitId,
} from '@contracts'
import { placementTarget, soldierTarget } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { useRosterPermissions } from '../roster/hooks'
import { usePorts } from '../runtime/context'
import { useSession } from '../session/hooks'
import { asLinkRequestFormError, toRequestLinkInput, toReviewLinkInput, type LinkRequestValues, type LinkReviewChoice } from './linking'

// Linking an identity to a soldier (D-005, D-030, D-156): the requester's side, the reviewer's side, and the
// link on a soldier's page. The adapter filters every read; these hooks only ask.

const PENDING: AccountLinkRequestQuery = { statuses: ['pending'] }

/** The unlinked identity files a request; the answer never says whether a soldier matched (D-066). */
export function useRequestLink() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.onboarding, QUERY_KEYS.session], async (values: LinkRequestValues) => {
    const result = await data.commands.accounts.requestLink(toRequestLinkInput(values))
    return result.ok ? result : { ok: false as const, error: asLinkRequestFormError(result.error) }
  })
}

export function useCancelLinkRequest() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.onboarding], (request: AccountLinkRequest) =>
    data.commands.accounts.cancelLinkRequest({ id: request.id }),
  )
}

/** Pending requests the actor may review, oldest first. */
export function useLinkRequests(): Loaded<readonly AccountLinkRequest[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.accountLinkRequests, PENDING],
      queryFn: () => unwrap(data.repositories.account_link_requests.list(PENDING)),
    }),
  )
}

/** The soldiers this request may link to, among those the actor may link (D-066, D-156). */
export function useLinkCandidates(id: AccountLinkRequestId): Loaded<readonly LinkCandidate[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      // Candidates read the roster and its private fields, so they live under the requests and refresh with them.
      queryKey: [...QUERY_KEYS.accountLinkRequests, 'candidates', id],
      queryFn: () => unwrap(data.repositories.account_link_requests.candidates(id)),
    }),
  )
}

export function useReviewLink() {
  const { data } = usePorts()
  return useCommand(
    [
      QUERY_KEYS.accountLinkRequests,
      QUERY_KEYS.soldierAccounts,
      QUERY_KEYS.soldiers,
      QUERY_KEYS.soldierPrivate,
      QUERY_KEYS.unitMemberships,
    ],
    ({ request, choice }: { request: AccountLinkRequest; choice: LinkReviewChoice }) =>
      data.commands.accounts.reviewLink(toReviewLinkInput(request, choice)),
  )
}

/** A soldier's accounts, revoked ones too, newest link last. Asks only when the actor may read them. */
export function useSoldierAccounts(soldierId: SoldierId, enabled: boolean): Loaded<readonly SoldierAccount[]> {
  const { data } = usePorts()
  const query = { soldier_ids: [soldierId] }
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldierAccounts, query],
      queryFn: () => unwrap(data.repositories.soldier_accounts.list(query)),
      enabled,
    }),
  )
}

export function useRevokeLink() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.soldierAccounts, QUERY_KEYS.accountLinkRequests], (account: SoldierAccount) =>
    data.commands.accounts.revokeLink({ id: account.id }),
  )
}

// ---------------------------------------------------------------------- hints

const VIEW: Permission = { resource: 'accounts', action: 'view' }
const APPROVE: Permission = { resource: 'accounts', action: 'approve' }
const ORGANIZATION: PolicyTarget = { kind: 'organization' }

/** What a soldier's page shows of their link: read with `accounts:view`, revoke as D-156 says. */
export function useAccountPermissions(soldier: Soldier) {
  const session = useSession()
  const target = useMemo(() => soldierTarget(soldier.id), [soldier.id])
  const checks = useMemo(() => [checkOf(VIEW, target), checkOf(APPROVE, target)], [target])
  const can = useCan(checks)
  const self = session.status === 'ready' && session.value.status === 'linked' && session.value.soldier_id === soldier.id
  return { view: can(checkOf(VIEW, target)), revoke: !self && can(checkOf(APPROVE, target)) }
}

/**
 * Whether the account requests module is for this actor: `accounts:approve` over the organization or over a
 * unit they see (D-157). A hint: the list holds only the requests they may review.
 */
export function useLinkReviewAccess(units: readonly Unit[]): boolean {
  const checks = useMemo<PermissionCheck[]>(
    () => [checkOf(APPROVE, ORGANIZATION), ...units.map((unit) => checkOf(APPROVE, { kind: 'unit', unit_id: unit.id }))],
    [units],
  )
  const can = useCan(checks)
  return checks.some((check) => can(check))
}

/**
 * Where a reviewer may make a soldier from a request: where they may create and place one, and approve accounts
 * too (D-157). `any` is false when there is nowhere, and the choice is not offered.
 */
export function useLinkCreatePlacements(soldiers: readonly Soldier[], units: readonly Unit[]) {
  const roster = useRosterPermissions(soldiers, units)
  const checks = useMemo<PermissionCheck[]>(
    () => [checkOf(APPROVE, placementTarget(null)), ...units.map((unit) => checkOf(APPROVE, placementTarget(unit.id)))],
    [units],
  )
  const can = useCan(checks)
  return useMemo(() => {
    const withoutUnit = roster.createWithoutUnit && can(checkOf(APPROVE, placementTarget(null)))
    const placeIn = (unitId: UnitId) => roster.placeIn(unitId) && can(checkOf(APPROVE, placementTarget(unitId)))
    return { withoutUnit, placeIn, any: withoutUnit || units.some((unit) => placeIn(unit.id)) }
  }, [roster, can, units])
}
