import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError } from '@contracts'
import { t } from '@i18n'
import { usePanel, useUnitLevels, useUnitPermissions, useUnits } from '@logic'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { UnitCreateForm, UnitEditForm } from './UnitForms'
import { UnitTree } from './UnitTree'
import type { Unit, UnitLevel } from '@contracts'

// The units panel: the tree, or the form the URL names (D-092).

function UnitsContent({ units, levels }: { readonly units: readonly Unit[]; readonly levels: readonly UnitLevel[] }) {
  const panel = usePanel()
  const permissions = useUnitPermissions(units)
  const [failure, setFailure] = useState<AppError | null>(null)
  const canCreateTop = permissions.createUnder(null)
  const newUnit = () => {
    setFailure(null)
    panel.open(PANEL_IDS.units, { entity: NEW_ENTITY })
  }

  // A deep link opens only what the actor may use; anything else reads as not found (D-076).
  const canCreate = canCreateTop || units.some((unit) => permissions.createUnder(unit.id))
  if (panel.entity === NEW_ENTITY && canCreate) {
    return (
      <UnitCreateForm
        units={units}
        levels={levels}
        parentId={panel.parent}
        allowedParent={permissions.createUnder}
      />
    )
  }
  if (panel.entity !== null) {
    const unit = units.find((candidate) => candidate.id === panel.entity)
    if (unit === undefined || !permissions.update(unit)) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('units.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.units)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <UnitEditForm key={unit.id} unit={unit} levels={levels} />
  }

  if (units.length === 0) {
    return (
      <EmptyNotice titleKey="units.emptyTitle" bodyKey={canCreateTop ? undefined : 'units.emptyReadOnly'}>
        {canCreateTop ? (
          <Button variant="primary" onPress={newUnit}>
            <Plus aria-hidden size={14} />
            {t('units.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      <UnitTree units={units} levels={levels} permissions={permissions} onFailure={setFailure} />
      {canCreateTop ? (
        <div>
          <Button onPress={newUnit}>
            <Plus aria-hidden size={14} />
            {t('units.new')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function UnitsModule() {
  const units = useUnits()
  const levels = useUnitLevels()
  if (units.status === 'failed') return <FailureNotice error={units.error} />
  if (levels.status === 'failed') return <FailureNotice error={levels.error} />
  if (units.status === 'loading' || levels.status === 'loading') return <LoadingNotice />
  return <UnitsContent units={units.value} levels={levels.value} />
}
