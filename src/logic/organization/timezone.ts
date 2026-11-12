import type { Organization, PermissionCheck, PolicyTarget, Result } from '@contracts'
import { checkOf } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'

// The organization's time zone after the claim (D-262): the claim takes it from the device, so the root unit's form
// shows it and lets it change. It is the organization's own field, saved by `organizations.update` alone.

const ORGANIZATION: PolicyTarget = { kind: 'organization' }
const UPDATE: PermissionCheck = checkOf({ resource: 'organization', action: 'update' }, ORGANIZATION)
const CHECKS: readonly PermissionCheck[] = [UPDATE]

/** Whether the actor may change the organization's time zone. */
export function useCanSetTimezone(): boolean {
  return useCan(CHECKS)(UPDATE)
}

/** `organizations.update` of the time zone alone. The same zone saves nothing. */
export function useSetOrganizationTimezone() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.organization],
    async ({ organization, timezone }: { organization: Organization; timezone: string }) => {
      const unchanged: Result<Organization> = { ok: true, value: organization }
      return timezone === organization.timezone
        ? unchanged
        : data.commands.organizations.update({ expected_version: organization.version, changes: { timezone } })
    },
  )
}
