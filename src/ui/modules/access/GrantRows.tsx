import type { AccessGrant, AppError, Soldier } from '@contracts'
import { t } from '@i18n'
import { fullName, useGrantCommands, useRoles, type GrantRow } from '@logic'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { grantDaysText } from './grantText'
import { GRANT_STATE_KEYS } from './labels'
import { scopeText } from './scopeText'
import { useScopeNames } from './useScopeNames'

// Grants as rows (D-028): who, its state, the role, the scope and the days, and revoking it for who may. The module
// lists every grant; a soldier's card lists that soldier's own, without the name (D-284).

const PART_SEPARATOR = ' · '

export function GrantRows({
  rows,
  soldiers,
  timezone,
  revokeOf,
  onFailure,
  withName = true,
}: {
  readonly rows: readonly GrantRow[]
  readonly soldiers: readonly Soldier[]
  readonly timezone: string
  readonly revokeOf: (grant: AccessGrant) => boolean
  readonly onFailure: (error: AppError | null) => void
  readonly withName?: boolean
}) {
  const roles = useRoles()
  const names = useScopeNames()
  const { revoke } = useGrantCommands(timezone)
  const [revoking, setRevoking] = useState<AccessGrant | null>(null)

  const nameOf = (row: GrantRow) => {
    const soldier = soldiers.find((candidate) => candidate.id === row.grant.grantee_soldier_id)
    return soldier === undefined ? '' : fullName(soldier)
  }
  const roleOf = (row: GrantRow) =>
    roles.status === 'ready' ? (roles.value.find((role) => role.id === row.grant.role_id)?.name ?? '') : ''
  const actionsOf = (row: GrantRow): RowAction[] =>
    row.state !== 'revoked' && row.state !== 'expired' && revokeOf(row.grant)
      ? [
          {
            id: 'revoke',
            labelKey: 'grants.revoke',
            icon: <Ban aria-hidden size={14} />,
            onAction: () => {
              onFailure(null)
              setRevoking(row.grant)
            },
          },
        ]
      : []

  return (
    <>
      <ul aria-label={t('grants.listLabel')} className="flex flex-col">
        {rows.map((row) => (
          <li key={row.grant.id} className="flex items-center gap-2xs border-b border-line bg-surface">
            <span className="flex min-h-touch min-w-none flex-1 flex-col justify-center p-xs md:min-h-control">
              <span className="flex items-center gap-xs">
                <span className="truncate text-name font-semibold">{withName ? nameOf(row) : roleOf(row)}</span>
                <span className="shrink-0 rounded-pill bg-inner px-xs text-micro">{t(GRANT_STATE_KEYS[row.state])}</span>
              </span>
              <span className="truncate text-micro text-text-muted">
                {[...(withName ? [roleOf(row)] : []), scopeText(row.grant, names), grantDaysText(row.grant, timezone)].join(
                  PART_SEPARATOR,
                )}
              </span>
            </span>
            <ActionMenu labelKey="common.actions" actions={actionsOf(row)} />
          </li>
        ))}
      </ul>
      {revoking === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="grants.revokeTitle"
          hintKey="grants.revokeBody"
          confirmKey="grants.revokeConfirm"
          isPending={revoke.isPending}
          onCancel={() => {
            setRevoking(null)
          }}
          onConfirm={() => {
            void revoke.run(revoking).then((result) => {
              setRevoking(null)
              if (!result.ok) onFailure(result.error)
            })
          }}
        />
      )}
    </>
  )
}
