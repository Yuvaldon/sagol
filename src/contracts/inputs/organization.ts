import { z } from 'zod'
import { AccessGrantId, RoleId, SoldierAccountId } from '../common/ids'
import { Organization } from '../entities/organization'
import { Role } from '../entities/permissions'
import { Soldier } from '../entities/soldiers'
import { ExpectedVersion, changesOf } from './common'

/**
 * `bootstrapOwner` (D-005): the first verified sign-in on an empty organization creates the
 * organization, the owner soldier, the account link, an owner role and its
 * organization-scope grant, atomically. Refused unless the identity's verified email
 * matches the server secret. The identity comes from the session, never from input.
 */
export const BootstrapOwnerInput = z.strictObject({
  organization: z.strictObject(Organization.pick({ id: true, name: true, timezone: true }).shape),
  soldier: z.strictObject(Soldier.pick({ id: true, first_name: true, last_name: true }).shape),
  /** The role name is user data: the UI proposes it, the owner may rename it later. */
  owner_role: z.strictObject({ id: RoleId, name: Role.shape.name }),
  account_id: SoldierAccountId,
  access_grant_id: AccessGrantId,
})
export type BootstrapOwnerInput = z.infer<typeof BootstrapOwnerInput>

/** Update of the session's organization (D-045: the organization is never input). */
export const UpdateOrganizationInput = z.strictObject({
  expected_version: ExpectedVersion,
  changes: changesOf(
    Organization.pick({ name: true, timezone: true, baseline_role_id: true, settings: true }).shape,
  ),
})
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>
