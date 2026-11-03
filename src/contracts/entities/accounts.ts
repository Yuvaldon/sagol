import { z } from 'zod'
import {
  AccountLinkRequestId,
  AuthUserId,
  OrganizationId,
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
