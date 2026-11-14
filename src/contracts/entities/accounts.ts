import { z } from 'zod'
import {
  AccountLinkRequestId,
  AuthUserId,
  OrganizationId,
  PushSubscriptionId,
  SoldierAccountId,
  SoldierId,
} from '../common/ids'
import { Email, Timestamp, Version, label, varchar } from '../common/scalars'
import { AccountLinkRequestStatus, IdentityProvider } from '../enums'
import { SoldierPreferences } from '../settings'

/** `soldier_accounts`: link between a provider identity and a soldier (D-005). */
export const SoldierAccount = z.object({
  id: SoldierAccountId,
  organization_id: OrganizationId,
  auth_user_id: AuthUserId,
  soldier_id: SoldierId,
  provider: IdentityProvider,
  /** Verified by the provider. */
  email: Email,
  linked_at: Timestamp,
  /** NULL for verified auto-link and bootstrap. */
  linked_by: SoldierId.nullable(),
  revoked_at: Timestamp.nullable(),
  revoked_by: SoldierId.nullable(),
})
export type SoldierAccount = z.infer<typeof SoldierAccount>

/** `account_link_requests`: onboarding claims reviewed by a commander (D-030). */
export const AccountLinkRequest = z.object({
  id: AccountLinkRequestId,
  organization_id: OrganizationId,
  auth_user_id: AuthUserId,
  email: Email,
  claimed_personal_id: varchar(50).min(1).nullable(),
  first_name: label(50),
  last_name: label(50),
  status: AccountLinkRequestStatus,
  resolved_soldier_id: SoldierId.nullable(),
  reviewed_by: SoldierId.nullable(),
  reviewed_at: Timestamp.nullable(),
  created_at: Timestamp,
})
export type AccountLinkRequest = z.infer<typeof AccountLinkRequest>

/** `soldier_preferences`. Named "record" because `SoldierPreferences` is the JSON value. */
export const SoldierPreferencesRecord = z.object({
  soldier_id: SoldierId,
  organization_id: OrganizationId,
  preferences: SoldierPreferences,
  updated_at: Timestamp,
  version: Version,
})
export type SoldierPreferencesRecord = z.infer<typeof SoldierPreferencesRecord>

/** A push key of the browser (base64url): `p256dh` is its public key, `auth` its secret. */
export function pushKey(max: number) {
  return varchar(max).regex(/^[A-Za-z0-9_-]+=*$/)
}

/**
 * The push services the browsers use (D-351): exact hosts, and parent domains whose every host is the service's.
 * The server posts to an endpoint, so one elsewhere is refused.
 */
export const PUSH_SERVICE_HOSTS = {
  exact: ['fcm.googleapis.com', 'updates.push.services.mozilla.com'],
  parents: ['push.apple.com', 'notify.windows.com'],
} as const

function onPushService(url: string): boolean {
  // Zod runs a refine after a failed format check too: a non-URL must fail here, not throw (OI-350).
  if (!URL.canParse(url)) return false
  const { hostname, port, username, password } = new URL(url)
  // The default https port only, and no credentials: the server posts to the service itself, nowhere else (D-411).
  if (port !== '' || username !== '' || password !== '') return false
  return (
    PUSH_SERVICE_HOSTS.exact.some((host) => hostname === host) ||
    PUSH_SERVICE_HOSTS.parents.some((parent) => hostname.endsWith(`.${parent}`))
  )
}

/** The push service URL of one browser install: https on its default port, no credentials, on a known push service (D-351, D-411). */
export const PushEndpoint = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine(onPushService, { message: 'not a browser push service' })
export type PushEndpoint = z.infer<typeof PushEndpoint>

/**
 * `push_subscriptions`: one browser install of a soldier that agreed to phone notifications (D-351). Device data:
 * never exported, deleted with the soldier's link or archive (D-358), and by a push service that no longer knows it.
 */
export const PushSubscriptionRecord = z.object({
  id: PushSubscriptionId,
  organization_id: OrganizationId,
  soldier_id: SoldierId,
  endpoint: PushEndpoint,
  p256dh: pushKey(200),
  auth: pushKey(100),
  created_at: Timestamp,
})
export type PushSubscriptionRecord = z.infer<typeof PushSubscriptionRecord>
