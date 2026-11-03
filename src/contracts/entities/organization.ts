import { z } from 'zod'
import { OrganizationId, RoleId } from '../common/ids'
import { Timestamp, Version, label, varchar } from '../common/scalars'
import { OrganizationSettings } from '../settings'

/** `organizations`: the tenant (D-011). */
export const Organization = z.object({
  id: OrganizationId,
  name: label(100),
  /** IANA time zone; defines "today" for the organization. */
  timezone: varchar(64).min(1),
  baseline_role_id: RoleId.nullable(),
  settings: OrganizationSettings,
  created_at: Timestamp,
  updated_at: Timestamp,
  version: Version,
})
export type Organization = z.infer<typeof Organization>
