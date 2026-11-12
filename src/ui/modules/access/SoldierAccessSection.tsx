import type { AppError, Soldier } from '@contracts'
import { t } from '@i18n'
import { useGrantPermissionHints, useGrantRows, useSoldiers, useTimezone } from '@logic'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { GrantForm } from './GrantForm'
import { GrantRows } from './GrantRows'

// A soldier's access on their card (D-284): the levels granted to them in person, and granting or revoking one there.
// The section is there only when it holds something for this viewer: a grant they can see, or one they may give (D-076).

function Section({ soldier, soldiers, timezone }: { readonly soldier: Soldier; readonly soldiers: readonly Soldier[]; readonly timezone: string }) {
  const hints = useGrantPermissionHints(soldiers)
  const rows = useGrantRows(false)
  const [granting, setGranting] = useState(false)
  const [failure, setFailure] = useState<AppError | null>(null)
  const canGrant = hints.grantTo(soldier.id)
  if (rows.status === 'failed') return <FailureNotice error={rows.error} />
  if (rows.status === 'loading') return <LoadingNotice />
  const own = rows.value.filter((row) => row.grant.grantee_soldier_id === soldier.id)
  if (own.length === 0 && !canGrant) return null
  return (
    <section aria-labelledby={`access-${soldier.id}`} className="flex flex-col gap-md">
      <h3 id={`access-${soldier.id}`} className="text-body font-bold">
        {t('soldiers.accessTitle')}
      </h3>
      {failure === null ? null : <FailureNotice error={failure} />}
      {own.length === 0 ? (
        <p className="text-label text-text-muted">{t('soldiers.accessEmpty')}</p>
      ) : (
        <GrantRows rows={own} soldiers={soldiers} timezone={timezone} revokeOf={hints.revokeOf} onFailure={setFailure} withName={false} />
      )}
      {granting ? (
        <GrantForm
          soldiers={soldiers}
          timezone={timezone}
          grantTo={(candidate) => candidate.id === soldier.id}
          grantee={soldier.id}
          onDone={() => {
            setGranting(false)
          }}
        />
      ) : canGrant ? (
        <div>
          <Button
            onPress={() => {
              setFailure(null)
              setGranting(true)
            }}
          >
            <Plus aria-hidden size={14} />
            {t('grants.new')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export function SoldierAccessSection({ soldier }: { readonly soldier: Soldier }) {
  const soldiers = useSoldiers()
  const timezone = useTimezone()
  if (soldiers.status !== 'ready' || timezone === null) return null
  return <Section soldier={soldier} soldiers={soldiers.value} timezone={timezone} />
}
