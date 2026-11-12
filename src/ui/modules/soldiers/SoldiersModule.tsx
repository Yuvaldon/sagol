import { NEW_ENTITY, PANEL_IDS, QUICK_ENTRY } from '@config'
import type { AppError, CalendarDate, CommandRank, Soldier, Unit, UnitId, UnitMembership } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  matchesName,
  soldierRows,
  useCommandRanks,
  useMemberships,
  usePanel,
  useRosterPermissions,
  useSoldierCommands,
  useSoldiers,
  useToday,
  useUnitsWithArchived,
  type SoldierRow,
} from '@logic'
import { Archive, Plus, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { unitStateLabel } from '../../patterns/units'
import { VirtualList } from '../../patterns/VirtualList'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'
import { swatchClassOf } from '../../theme/palette'
import { SoldierCreateForm } from './SoldierForms'
import { QuickEntry } from './QuickEntry'
import { SoldierPage } from './SoldierPage'

// The soldiers panel: a searchable list, a new soldier's form, or one soldier's page (D-094).

function SoldierRowView({ row, actions }: { readonly row: SoldierRow; readonly actions: readonly RowAction[] }) {
  const panel = usePanel()
  const color = swatchClassOf(row.rank?.color_key ?? null)
  return (
    <div className="flex items-center gap-2xs border-b border-line bg-surface">
      {color === null ? null : <span aria-hidden className={`ms-xs size-dot shrink-0 rounded-pill ${color}`} />}
      <AriaButton
        onPress={() => {
          panel.open(PANEL_IDS.soldiers, { entity: row.soldier.id })
        }}
        className="flex min-h-touch min-w-none flex-1 cursor-pointer flex-col items-start justify-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        <span className="max-w-full truncate text-name font-semibold">{fullName(row.soldier)}</span>
        <span className="flex max-w-full gap-sm truncate text-micro text-text-muted">
          {row.rank === null ? null : <span>{row.rank.title}</span>}
          <span>{unitStateLabel(row.unitState)}</span>
          {row.soldier.status === 'inactive' ? <span>{t('soldiers.statusInactive')}</span> : null}
        </span>
      </AriaButton>
      <ActionMenu labelKey="common.actions" actions={actions} />
    </div>
  )
}

function SoldiersContent({
  soldiers,
  ranks,
  units,
  memberships,
  today,
}: {
  readonly soldiers: readonly Soldier[]
  readonly ranks: readonly CommandRank[]
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly today: CalendarDate | null
}) {
  const panel = usePanel()
  const liveUnits = useMemo(() => units.filter((unit) => unit.archived_at === null), [units])
  const permissions = useRosterPermissions(soldiers, liveUnits)
  const commands = useSoldierCommands()
  const [query, setQuery] = useState('')
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Soldier | null>(null)
  const { readsPlacements } = permissions
  const rows = useMemo(
    () => soldierRows(soldiers, ranks, units, memberships, today, readsPlacements),
    [soldiers, ranks, units, memberships, today, readsPlacements],
  )
  const shown = useMemo(() => rows.filter((row) => matchesName(row.soldier, query)), [rows, query])

  const newSoldier = () => {
    setFailure(null)
    panel.open(PANEL_IDS.soldiers, { entity: NEW_ENTITY })
  }
  // The quick entry places every row with its private details (D-282, D-223): only units that allow both are offered.
  const quickUnit = (unitId: UnitId) => permissions.placeIn(unitId) && permissions.privateOnCreate(unitId)
  const quickEntry = today !== null && liveUnits.some((unit) => quickUnit(unit.id))
  const openQuickEntry = () => {
    setFailure(null)
    panel.open(PANEL_IDS.soldiers, { entity: QUICK_ENTRY })
  }
  const quickButton = quickEntry ? (
    <Button onPress={openQuickEntry}>
      <Rows3 aria-hidden size={14} />
      {t('soldiers.quick.open')}
    </Button>
  ) : null

  // A deep link opens only what the actor may use; anything else reads as not found (D-076).
  if (panel.entity === NEW_ENTITY && permissions.create) {
    return (
      <SoldierCreateForm
        ranks={ranks}
        units={liveUnits}
        today={today}
        allowedUnit={permissions.placeIn}
        allowNoUnit={permissions.createWithoutUnit}
        allowPrivate={permissions.privateOnCreate}
      />
    )
  }
  if (panel.entity === QUICK_ENTRY && quickEntry && today !== null) {
    return <QuickEntry units={liveUnits} today={today} allowedUnit={quickUnit} />
  }
  if (panel.entity !== null) {
    const soldier = soldiers.find((candidate) => candidate.id === panel.entity)
    if (soldier === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('soldiers.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.soldiers)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <SoldierPage key={soldier.id} soldier={soldier} ranks={ranks} units={units} memberships={memberships} today={today} />
  }

  if (rows.length === 0) {
    return (
      <EmptyNotice titleKey="soldiers.emptyTitle" bodyKey={permissions.create ? undefined : 'soldiers.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newSoldier}>
            <Plus aria-hidden size={14} />
            {t('soldiers.new')}
          </Button>
        ) : null}
        {quickButton}
      </EmptyNotice>
    )
  }

  const actionsOf = (soldier: Soldier): RowAction[] =>
    permissions.archive(soldier)
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive',
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(soldier)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-end gap-sm">
        <div className="min-w-none flex-1">
          <TextField labelKey="soldiers.search" name="search" value={query} onChange={setQuery} error={null} />
        </div>
        {permissions.create ? (
          <Button onPress={newSoldier}>
            <Plus aria-hidden size={14} />
            {t('soldiers.new')}
          </Button>
        ) : null}
        {quickButton}
      </div>
      {failure === null ? null : <FailureNotice error={failure} />}
      {shown.length === 0 ? (
        <p role="status" className="py-lg text-center text-name text-text-muted">
          {t('soldiers.noResults')}
        </p>
      ) : (
        <VirtualList
          labelKey="soldiers.listLabel"
          items={shown}
          keyOf={(row) => row.soldier.id}
          renderRow={(row) => <SoldierRowView row={row} actions={actionsOf(row.soldier)} />}
        />
      )}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="soldiers.archiveTitle"
          hintKey="soldiers.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}

export function SoldiersModule() {
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnitsWithArchived()
  const memberships = useMemberships()
  const today = useToday()
  const reads = [soldiers, ranks, units, memberships]
  const failed = reads.find((read) => read.status === 'failed')
  if (failed?.status === 'failed') return <FailureNotice error={failed.error} />
  if (soldiers.status !== 'ready' || ranks.status !== 'ready' || units.status !== 'ready' || memberships.status !== 'ready') {
    return <LoadingNotice />
  }
  return (
    <SoldiersContent
      soldiers={soldiers.value}
      ranks={ranks.value}
      units={units.value}
      memberships={memberships.value}
      today={today}
    />
  )
}
