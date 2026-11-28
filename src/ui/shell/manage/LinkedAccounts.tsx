import type { AppError, SoldierAccount } from '@contracts'
import { t } from '@i18n'
import { fullName, useRevokeLink, useRevokeLinkHints, useSoldierAccounts, useSoldiers, useTimezone } from '@logic'
import { useMemo, useState } from 'react'
import { StopDrawer } from '../../kit/StopDrawer'
import { formatInstant } from '../../patterns/dates'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { useNotices } from '../notices'

// The linked accounts (OI-404, D-491): every live link between a sign-in and a soldier the actor reads, the soldier's
// name where the actor sees them and "חייל" where not, the address and when it was linked. "ניתוק" shows for who may
// review that soldier's links, never on the actor's own (D-163), also for a soldier the actor does not see: the server
// answers who may. Unlinking asks first, by name, and has no "ביטול": a new link is a new request (D-451).
// `panel=account_links&entity=linked`, from the capsule of "הצטרפות".

const NO_ACCOUNTS: readonly SoldierAccount[] = []
const WORD = ' '

export function LinkedAccountsDrawer({ onClose }: { readonly onClose: () => void }) {
  const notices = useNotices()
  const accounts = useSoldierAccounts()
  const soldiers = useSoldiers()
  const timezone = useTimezone()
  const live = useMemo(() => (accounts.status === 'ready' ? accounts.value.filter((account) => account.revoked_at === null) : NO_ACCOUNTS), [accounts])
  const canRevoke = useRevokeLinkHints(live)
  const revoke = useRevokeLink()
  const [revoking, setRevoking] = useState<SoldierAccount | null>(null)
  // A refusal shows in the drawer, which stands over the toast.
  const [failure, setFailure] = useState<AppError | null>(null)
  const nameOf = (account: SoldierAccount) => {
    const soldier = soldiers.status === 'ready' ? soldiers.value.find((candidate) => candidate.id === account.soldier_id) : undefined
    return soldier === undefined ? t('accountLinks.unknownSoldier') : fullName(soldier)
  }
  return (
    <StopDrawer inUrl title={t('accountLinks.linkedTitle')} detail={[String(live.length), t('accountLinks.linkedCount')].join(WORD)} opensAt="full" onClose={onClose}>
      <div className="flex flex-col gap-md">
        {failure === null ? null : <FailureNotice error={failure} />}
        {accounts.status === 'failed' ? (
          <FailureNotice error={accounts.error} />
        ) : accounts.status === 'loading' ? (
          <LoadingNotice />
        ) : live.length === 0 ? (
          <EmptyNotice titleKey="accountLinks.linkedEmpty" bodyKey="accountLinks.linkedEmptyBody" headingLevel={3} />
        ) : (
          <ul aria-label={t('accountLinks.linkedTitle')} className="flex flex-col overflow-hidden rounded-card bg-surface">
            {live.map((account) => (
              <li key={account.id} className="flex min-h-touch items-center gap-sm border-b border-divider-strong px-lg py-xs last:border-b-0">
                <span className="flex min-w-none flex-1 flex-col">
                  <span className="truncate text-body font-semibold">{nameOf(account)}</span>
                  <span dir="ltr" className="truncate text-start text-small text-text-muted">
                    {account.email}
                  </span>
                  {timezone === null ? null : (
                    <span className="truncate text-small text-text-muted">{[t('accountLinks.linkedAt'), formatInstant(account.linked_at, timezone)].join(WORD)}</span>
                  )}
                </span>
                {canRevoke(account) ? (
                  <Button
                    onPress={() => {
                      setFailure(null)
                      setRevoking(account)
                    }}
                  >
                    {t('accountLinks.unlink')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {revoking === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="accountLinks.unlinkTitle"
          hintKey="accountLinks.unlinkHint"
          confirmKey="accountLinks.unlinkConfirm"
          tone="danger"
          isPending={revoke.isPending}
          onCancel={() => {
            setRevoking(null)
          }}
          onConfirm={() => {
            const name = nameOf(revoking)
            void revoke.run(revoking).then((result) => {
              setRevoking(null)
              if (!result.ok) {
                setFailure(result.error)
                return
              }
              notices.say([name, t('accountLinks.unlinked')].join(WORD))
            })
          }}
        >
          <p className="text-body font-semibold">{nameOf(revoking)}</p>
        </SmallDialog>
      )}
    </StopDrawer>
  )
}
