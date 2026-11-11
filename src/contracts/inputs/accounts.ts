import { z } from 'zod'
import { AccountLinkRequestId, CommandRankId, SoldierAccountId, SoldierId } from '../common/ids'
import { AccountLinkRequest } from '../entities/accounts'
import { SoldierPreferences } from '../settings'
import { ExpectedVersion } from './common'
import { MembershipPlacement } from './soldiers'

/**
 * `requestAccountLink` (D-005, D-030). Auth user id and email come from the session.
 * Auto-links only on personal id + verified invite email; otherwise a pending request.
 */
export const RequestAccountLinkInput = z.strictObject({
  id: AccountLinkRequestId,
  ...AccountLinkRequest.pick({ claimed_personal_id: true, first_name: true, last_name: true }).shape,
  /** Used only when the request auto-links. */
  account_id: SoldierAccountId,
})
export type RequestAccountLinkInput = z.infer<typeof RequestAccountLinkInput>

/** Both outcomes look the same to anyone probing for personal ids: no match is ever revealed. */
export const AccountLinkOutcome = z.enum(['linked', 'pending_review'])
export type AccountLinkOutcome = z.infer<typeof AccountLinkOutcome>

export const AccountLinkResult = z.object({ outcome: AccountLinkOutcome })
export type AccountLinkResult = z.infer<typeof AccountLinkResult>

/** The requester withdraws their own pending request. */
export const CancelAccountLinkRequestInput = z.strictObject({ id: AccountLinkRequestId })
export type CancelAccountLinkRequestInput = z.infer<typeof CancelAccountLinkRequestInput>

export const AccountLinkResolution = z.enum(['link', 'create_soldier', 'reject'])
export type AccountLinkResolution = z.infer<typeof AccountLinkResolution>

/**
 * `reviewAccountLink` (D-030, D-156). `link` names one of the request's candidates, over which the
 * reviewer holds `accounts:approve`; `create_soldier` also needs `soldiers:create` over the placement.
 * Linking fills the soldier's missing personal id from the request (D-066).
 */
export const ReviewAccountLinkInput = z.strictObject({
  id: AccountLinkRequestId,
  resolution: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('link'), account_id: SoldierAccountId, soldier_id: SoldierId }),
    z.strictObject({
      kind: z.literal('create_soldier'),
      account_id: SoldierAccountId,
      soldier_id: SoldierId,
      command_rank_id: CommandRankId.nullable(),
      membership: MembershipPlacement.nullable(),
    }),
    z.strictObject({ kind: z.literal('reject') }),
  ]),
})
export type ReviewAccountLinkInput = z.infer<typeof ReviewAccountLinkInput>

/**
 * `revokeLink` (D-156): ends a soldier's account link. Needs `accounts:approve` over the soldier;
 * nobody revokes their own account. The row stays as history.
 */
export const RevokeAccountLinkInput = z.strictObject({ id: SoldierAccountId })
export type RevokeAccountLinkInput = z.infer<typeof RevokeAccountLinkInput>

/** The signed-in soldier's own preferences. `expected_version` is NULL while no row exists. */
export const UpdateMyPreferencesInput = z.strictObject({
  expected_version: ExpectedVersion.nullable(),
  preferences: SoldierPreferences,
})
export type UpdateMyPreferencesInput = z.infer<typeof UpdateMyPreferencesInput>
