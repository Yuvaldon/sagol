import { z } from 'zod'
import { AccountLinkRequestId, CommandRankId, SoldierAccountId, SoldierId } from '../common/ids'
import { AccountLinkRequest, PushEndpoint, PushSubscriptionRecord } from '../entities/accounts'
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

/** `revokeAccountLink` (D-163): ends a link; the soldier and the identity can be linked again. */
export const RevokeAccountLinkInput = z.strictObject({ id: SoldierAccountId })
export type RevokeAccountLinkInput = z.infer<typeof RevokeAccountLinkInput>

export const AccountLinkResolution = z.enum(['link', 'create_soldier', 'reject'])
export type AccountLinkResolution = z.infer<typeof AccountLinkResolution>

/**
 * `reviewAccountLink` (D-030). Linking or creating fills missing soldier fields (names,
 * personal id) from the request.
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

/** The signed-in soldier's own preferences. `expected_version` is NULL while no row exists. */
export const UpdateMyPreferencesInput = z.strictObject({
  expected_version: ExpectedVersion.nullable(),
  preferences: SoldierPreferences,
})
export type UpdateMyPreferencesInput = z.infer<typeof UpdateMyPreferencesInput>

/**
 * `notifications.subscribe` (D-351): this browser install of the signed-in soldier agrees to phone notifications. An
 * endpoint stored before moves to the caller (a shared device changed hands). The row's id is the server's: the
 * endpoint is the browser's own key, and the caller never reads the row back.
 */
export const SubscribePushInput = z.strictObject(
  PushSubscriptionRecord.pick({ endpoint: true, p256dh: true, auth: true }).shape,
)
export type SubscribePushInput = z.infer<typeof SubscribePushInput>

/** `notifications.unsubscribe`: forgets this browser install, if it is the caller's; a missing row is success. */
export const UnsubscribePushInput = z.strictObject({ endpoint: PushEndpoint })
export type UnsubscribePushInput = z.infer<typeof UnsubscribePushInput>
