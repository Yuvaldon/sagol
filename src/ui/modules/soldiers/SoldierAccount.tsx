import type { AppError, Soldier, SoldierAccount } from '@contracts'
import { t } from '@i18n'
import { activeAccountOf, useAccountPermissions, useCurrentOrganization, useRevokeLink, useSoldierAccounts } from '@logic'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { Button } from '../../primitives/Button'

// The soldier's login account (D-156): who reads accounts sees the link, and who may approve links may revoke it,
// except on their own account. Linking itself happens from the requests, or by the invite email.

function LinkedAccount({ account, canRevoke }: { readonly account: SoldierAccount; readonly canRevoke: boolean }) {
  const organization = useCurrentOrganization()
  const timezone = organization.status === 'ready' && organization.value !== null ? organization.value.timezone : null
  const revoke = useRevokeLink()
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<AppError | null>(null)
  return (
    <>
      <dl className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <dt className="text-label font-semibold text-text-muted">{t('accounts.email')}</dt>
          <dd className="text-control" dir="ltr">
            {account.email ?? t('soldiers.emptyValue')}
          </dd>
        </div>
        {timezone === null ? null : (
          <div className="flex flex-col gap-xs">
            <dt className="text-label font-semibold text-text-muted">{t('accounts.linkedAt')}</dt>
            <dd className="text-control tabular-nums">{formatInstant(account.linked_at, timezone)}</dd>
          </div>
        )}
      </dl>
      {failure === null ? null : <FailureNotice error={failure} />}
      {canRevoke ? (
        <div>
          <Button
            onPress={() => {
              setFailure(null)
              setConfirming(true)
            }}
          >
            {t('accounts.revoke')}
          </Button>
        </div>
      ) : null}
      {confirming ? (
        <SmallDialog
          role="alertdialog"
          titleKey="accounts.revokeTitle"
          hintKey="accounts.revokeBody"
          confirmKey="accounts.revoke"
          isPending={revoke.isPending}
          onCancel={() => {
            setConfirming(false)
          }}
          onConfirm={() => {
            void revoke.run(account).then((result) => {
              setConfirming(false)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      ) : null}
    </>
  )
}

function AccountContent({ soldier, canRevoke }: { readonly soldier: Soldier; readonly canRevoke: boolean }) {
  const accounts = useSoldierAccounts(soldier.id, true)
  if (accounts.status === 'failed') return <FailureNotice error={accounts.error} />
  if (accounts.status === 'loading') return <LoadingNotice />
  const active = activeAccountOf(accounts.value)
  if (active === null) return <p className="text-name text-text-muted">{t('accounts.notLinked')}</p>
  return <LinkedAccount key={active.id} account={active} canRevoke={canRevoke} />
}

export function SoldierAccountSection({ soldier }: { readonly soldier: Soldier }) {
  const permissions = useAccountPermissions(soldier)
  if (!permissions.view) return null
  return (
    <section className="flex flex-col gap-md">
      <h3 className="text-body font-bold">{t('accounts.sectionTitle')}</h3>
      <AccountContent soldier={soldier} canRevoke={permissions.revoke} />
    </section>
  )
}
