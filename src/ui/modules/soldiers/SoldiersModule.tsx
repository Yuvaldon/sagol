import { NEW_ENTITY } from '@config'
import { t } from '@i18n'
import { useCommandRanks, usePanel, useRosterPermissions, useToday, useUnitsWithArchived } from '@logic'
import { useMemo } from 'react'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { SoldierCreateForm } from './SoldierForms'

// The full form of one new soldier (D-094): rank, unit or none, private details and the soldier's own fields. The list
// is the page "חיילים" and a soldier is their person card (D-482); "הוספת חיילים" opens this form for whoever needs more
// than names and numbers.

const NO_SOLDIERS: readonly never[] = []

export function SoldiersModule() {
  const panel = usePanel()
  const ranks = useCommandRanks()
  const units = useUnitsWithArchived()
  const today = useToday()
  const liveUnits = useMemo(() => (units.status === 'ready' ? units.value.filter((unit) => unit.archived_at === null) : []), [units])
  const permissions = useRosterPermissions(NO_SOLDIERS, liveUnits)
  for (const read of [ranks, units]) {
    if (read.status === 'failed') return <FailureNotice error={read.error} />
  }
  if (ranks.status !== 'ready' || units.status !== 'ready') return <LoadingNotice />
  // A deep link opens only what the actor may use; anything else reads as not found (D-076).
  if (panel.entity !== NEW_ENTITY || !permissions.create) return <p className="py-xl text-center text-name text-text-muted">{t('soldiers.notFound')}</p>
  return (
    <SoldierCreateForm
      ranks={ranks.value}
      units={liveUnits}
      today={today}
      allowedUnit={permissions.placeIn}
      allowNoUnit={permissions.createWithoutUnit}
      allowPrivate={permissions.privateOnCreate}
    />
  )
}
