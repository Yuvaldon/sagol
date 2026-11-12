import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AccessGrant, AppError, Soldier } from '@contracts'
import { t } from '@i18n'
import { useGrantPermissionHints, useGrantRows, usePanel, useSoldiers, useTimezone } from '@logic'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { SwitchField } from '../../primitives/SwitchField'
import { GrantForm } from './GrantForm'
import { GrantRows } from './GrantRows'

// Personal access grants (D-028, D-165, D-166): a role given to one soldier, in a scope, for a window of days. A grant
// is not edited; it is revoked and given again.

function GrantList({
  soldiers,
  timezone,
  canGrant,
  revokeOf,
}: {
  readonly soldiers: readonly Soldier[]
  readonly timezone: string
  readonly canGrant: boolean
  readonly revokeOf: (grant: AccessGrant) => boolean
}) {
  const panel = usePanel()
  const [showInactive, setShowInactive] = useState(false)
  const rows = useGrantRows(showInactive)
  const [failure, setFailure] = useState<AppError | null>(null)

  return (
    <div className="flex flex-col gap-md">
      <SwitchField labelKey="grants.showInactive" name="show_inactive" value={showInactive} onChange={setShowInactive} />
      {failure === null ? null : <FailureNotice error={failure} />}
      {rows.status === 'failed' ? (
        <FailureNotice error={rows.error} />
      ) : rows.status === 'loading' ? (
        <LoadingNotice />
      ) : rows.value.length === 0 ? (
        <EmptyNotice titleKey="grants.emptyTitle" bodyKey="grants.emptyBody" />
      ) : (
        <GrantRows rows={rows.value} soldiers={soldiers} timezone={timezone} revokeOf={revokeOf} onFailure={setFailure} />
      )}
      {canGrant ? (
        <div>
          <Button
            onPress={() => {
              setFailure(null)
              panel.open(PANEL_IDS.accessGrants, { entity: NEW_ENTITY })
            }}
          >
            <Plus aria-hidden size={14} />
            {t('grants.new')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function Grants({ soldiers, timezone }: { readonly soldiers: readonly Soldier[]; readonly timezone: string }) {
  const panel = usePanel()
  const hints = useGrantPermissionHints(soldiers)
  if (panel.entity === NEW_ENTITY) {
    if (!hints.any) return <EmptyNotice titleKey="grants.title" bodyKey="grants.noGrantees" />
    return (
      <GrantForm
        soldiers={soldiers}
        timezone={timezone}
        grantTo={(soldier) => hints.grantTo(soldier.id)}
        onDone={() => {
          panel.open(PANEL_IDS.accessGrants)
        }}
      />
    )
  }
  return <GrantList soldiers={soldiers} timezone={timezone} canGrant={hints.any} revokeOf={hints.revokeOf} />
}

export function GrantsModule() {
  const soldiers = useSoldiers()
  const timezone = useTimezone()
  if (soldiers.status === 'failed') return <FailureNotice error={soldiers.error} />
  if (soldiers.status === 'loading' || timezone === null) return <LoadingNotice />
  return <Grants soldiers={soldiers.value} timezone={timezone} />
}
