import { z } from 'zod'
import { AccessGrantId, LeaveTypeGroupId, LeaveTypeId, RoleId, SoldierAccountId, UnitId, UnitMembershipId } from '../common/ids'
import { LeaveType, LeaveTypeGroup } from '../entities/leaves'
import { Organization } from '../entities/organization'
import { Role } from '../entities/permissions'
import { Soldier } from '../entities/soldiers'
import { ExpectedVersion, changesOf } from './common'

/**
 * `bootstrapOwner` (D-005): the first verified sign-in on an empty organization creates the
 * organization, its root unit (named as the organization, D-251), the owner soldier placed in it from today, the
 * account link, an owner role and its organization-scope grant, and the built-in "סבב יציאות" group with its one type
 * (D-345, D-346), atomically. Refused unless the identity's verified email
 * matches the server secret. The identity comes from the session, never from input.
 */
export const BootstrapOwnerInput = z.strictObject({
  organization: z.strictObject(Organization.pick({ id: true, name: true, timezone: true }).shape),
  root_unit_id: UnitId,
  soldier: z.strictObject(Soldier.pick({ id: true, first_name: true, last_name: true }).shape),
  /** The owner's primary membership in the root unit. */
  membership_id: UnitMembershipId,
  /** The role name is user data: the UI proposes it, the owner may rename it later. */
  owner_role: z.strictObject({ id: RoleId, name: Role.shape.name }),
  account_id: SoldierAccountId,
  access_grant_id: AccessGrantId,
  /** The built-in leave group and its first type (D-346). Their names are user data, proposed by the UI. */
  rotation_group: z.strictObject({ id: LeaveTypeGroupId, name: LeaveTypeGroup.shape.name }),
  rotation_type: z.strictObject({ id: LeaveTypeId, name: LeaveType.shape.name }),
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
