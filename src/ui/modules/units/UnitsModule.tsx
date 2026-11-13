import { DEVICE_KEYS, NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError } from '@contracts'
import { t } from '@i18n'
import {
  archivedRows,
  useDeviceFlag,
  usePanel,
  useUnitCommands,
  useUnitLevels,
  useUnitPermissions,
  useUnits,
  useUnitsWithArchived,
} from '@logic'
import { List, Network, Plus } from 'lucide-react'
import { useState } from 'react'
import { ArchivedSection } from '../../patterns/ArchivedSection'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { useWideDrawer } from '../../patterns/drawerWidth'
import { Button } from '../../primitives/Button'
import { Segmented } from '../../primitives/Segmented'
import { UnitChart } from './UnitChart'
import { UnitCreateForm, UnitEditForm } from './UnitForms'
import { UnitTree } from './UnitTree'
import type { Unit, UnitLevel } from '@contracts'

// The units panel: the tree, or the form the URL names (D-092). The tree reads as a list or as a chart, a choice this
// device remembers (D-318); the chart takes the whole width.

type UnitsView = 'list' | 'chart'

function UnitsContent({
  units,
  archivedUnits,
  levels,
}: {
  readonly units: readonly Unit[]
  readonly archivedUnits: readonly Unit[]
  readonly levels: readonly UnitLevel[]
}) {
  const panel = usePanel()
  const permissions = useUnitPermissions(units)
  // Their own checks: an archived root must not count as the live one (D-251).
  const archivedPermissions = useUnitPermissions(archivedUnits)
  const { restore } = useUnitCommands()
  // Archived units come back from a quiet section under the tree, for whoever may archive them (D-371).
  const archived = (
    <ArchivedSection
      rows={archivedUnits.filter((unit) => archivedPermissions.archive(unit))}
      nameOf={(unit) => unit.name}
      restore={restore}
    />
  )
  const [failure, setFailure] = useState<AppError | null>(null)
  const chartFlag = useDeviceFlag(DEVICE_KEYS.unitsChart)
  const view: UnitsView = chartFlag.value ? 'chart' : 'list'
  useWideDrawer(view === 'chart' && panel.entity === null && units.length > 0)
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
      <div className="flex flex-col gap-md">
        <EmptyNotice titleKey="units.emptyTitle" bodyKey={canCreateTop ? undefined : 'units.emptyReadOnly'}>
          {canCreateTop ? (
            <Button variant="primary" onPress={newUnit}>
              <Plus aria-hidden size={14} />
              {t('units.new')}
            </Button>
          ) : null}
        </EmptyNotice>
        {archived}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      <Segmented<UnitsView>
        labelKey="units.viewLabel"
        options={[
          { id: 'list', labelKey: 'units.viewList', icon: <List aria-hidden size={14} /> },
          { id: 'chart', labelKey: 'units.viewChart', icon: <Network aria-hidden size={14} /> },
        ]}
        value={view}
        onChange={(next) => {
          chartFlag.set(next === 'chart')
        }}
      />
      {failure === null ? null : <FailureNotice error={failure} />}
      {view === 'chart' ? (
        <UnitChart units={units} levels={levels} permissions={permissions} onFailure={setFailure} />
      ) : (
        <UnitTree units={units} levels={levels} permissions={permissions} onFailure={setFailure} />
      )}
      {canCreateTop ? (
        <div>
          <Button onPress={newUnit}>
            <Plus aria-hidden size={14} />
            {t('units.new')}
          </Button>
        </div>
      ) : null}
      {archived}
    </div>
  )
}

export function UnitsModule() {
  const units = useUnits()
  const withArchived = useUnitsWithArchived()
  const levels = useUnitLevels()
  if (units.status === 'failed') return <FailureNotice error={units.error} />
  if (withArchived.status === 'failed') return <FailureNotice error={withArchived.error} />
  if (levels.status === 'failed') return <FailureNotice error={levels.error} />
  if (units.status === 'loading' || withArchived.status === 'loading' || levels.status === 'loading') return <LoadingNotice />
  return <UnitsContent units={units.value} archivedUnits={archivedRows(withArchived.value)} levels={levels.value} />
}
