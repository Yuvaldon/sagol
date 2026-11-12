import {
  AccessGrantId,
  UnitId,
  UnitMembershipId,
  BootstrapOwnerInput,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  type Issue,
} from '@contracts'
import { timeZoneIssues, withPathPrefix } from '@domain'
import { formIssues } from '../forms/issues'

// Claiming an empty organization (D-005). Ids are generated here, by the caller (D-044).

/** What the claim form edits. Field names follow `BootstrapOwnerInput`. */
export interface ClaimOrganizationValues {
  readonly organization: { readonly name: string; readonly timezone: string }
  readonly soldier: { readonly first_name: string; readonly last_name: string }
  /** The UI proposes it, and the owner may rename the role later. */
  readonly owner_role_name: string
}

export function toBootstrapInput(values: ClaimOrganizationValues): BootstrapOwnerInput {
  return {
    organization: { id: OrganizationId.parse(crypto.randomUUID()), ...values.organization },
    soldier: { id: SoldierId.parse(crypto.randomUUID()), ...values.soldier },
    owner_role: { id: RoleId.parse(crypto.randomUUID()), name: values.owner_role_name },
    account_id: SoldierAccountId.parse(crypto.randomUUID()),
    access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
    root_unit_id: UnitId.parse(crypto.randomUUID()),
    membership_id: UnitMembershipId.parse(crypto.randomUUID()),
  }
}

/** The same answer the adapter gives, including the time zone (D-084). */
export function claimIssues(values: ClaimOrganizationValues): Issue[] {
  const schemaIssues = formIssues(BootstrapOwnerInput, toBootstrapInput(values))
  if (schemaIssues.length > 0) return schemaIssues
  return withPathPrefix(['organization'], timeZoneIssues(values.organization.timezone))
}

/** The zones the claim form offers, starting from the device's zone (D-086). */
export function timeZoneChoices(): { readonly device: string; readonly zones: readonly string[] } {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone
  return { device, zones: [...new Set([device, ...Intl.supportedValuesOf('timeZone')])] }
}
