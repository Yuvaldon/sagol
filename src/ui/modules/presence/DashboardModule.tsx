import type { DashboardTemplateId, UnitId } from '@contracts'
import { t } from '@i18n'
import {
  addableModules,
  moduleState,
  useChangeDashboardScope,
  useDashboard,
  useLeaveTypes,
  useOverlayLayer,
  type Dashboard,
  type DashboardLayoutState,
} from '@logic'
import { CalendarRange, ClipboardList, Gauge, Pencil, RotateCcw, SlidersHorizontal, Check } from 'lucide-react'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { Segmented, type SegmentedOption } from '../../primitives/Segmented'
import { SelectField } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { WindowNavigator } from '../../shell/WindowNavigator'
import { AddMenu } from './dashboard/AddMenu'
import { BoardCards } from './dashboard/Board'
import { spanText } from './dashboard/figures'
import { TEMPLATE_KEYS } from './dashboard/moduleWords'

// The command board "דשבורד" (D-349): the unit and span it counts, the template or the actor's own list, and in edit
// mode the way to change that list. Every card reads the same tally, so the cards never disagree.

type TemplateChoice = DashboardTemplateId | 'custom'

const ICON = 16
const TEMPLATE_OPTIONS: readonly SegmentedOption<DashboardTemplateId>[] = [
  { id: 'leaves', labelKey: TEMPLATE_KEYS.leaves, icon: <CalendarRange aria-hidden size={ICON} /> },
  { id: 'control', labelKey: TEMPLATE_KEYS.control, icon: <Gauge aria-hidden size={ICON} /> },
  { id: 'report', labelKey: TEMPLATE_KEYS.report, icon: <ClipboardList aria-hidden size={ICON} /> },
]
const CUSTOM_OPTION: SegmentedOption<'custom'> = {
  id: 'custom',
  labelKey: 'dashboard.templateCustom',
  icon: <SlidersHorizontal aria-hidden size={ICON} />,
}

function Head({
  dashboard,
  layout,
  editing,
  onEdit,
  onChoose,
}: {
  readonly dashboard: Dashboard
  readonly layout: DashboardLayoutState
  readonly editing: boolean
  readonly onEdit: () => void
  readonly onChoose: (template: DashboardTemplateId) => void
}) {
  const { scope } = dashboard
  const { setUnit, setPlanned } = useChangeDashboardScope()
  const unitOptions = scope.units.map((unit) => ({ key: unit.id, label: { text: unit.name }, value: unit.id }))
  const options: readonly SegmentedOption<TemplateChoice>[] = layout.template === null ? [...TEMPLATE_OPTIONS, CUSTOM_OPTION] : TEMPLATE_OPTIONS
  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-end gap-md">
        {unitOptions.length > 1 ? (
          <SelectField<UnitId> labelKey="dashboard.unit" name="unit" value={scope.unitId} options={unitOptions} onChange={setUnit} error={null} />
        ) : null}
        <WindowNavigator />
        <SwitchField labelKey="dashboard.planned" name="planned" value={scope.planned} onChange={setPlanned} />
      </div>
      <p className="text-name text-text-muted">{spanText(dashboard)}</p>
      <div className="flex flex-wrap items-center gap-sm">
        <Segmented<TemplateChoice>
          labelKey="dashboard.template"
          options={options}
          value={layout.template ?? 'custom'}
          onChange={(choice) => {
            if (choice !== 'custom') onChoose(choice)
          }}
        />
        {editing ? null : (
          <Button onPress={onEdit}>
            <Pencil aria-hidden size={ICON} />
            {t('dashboard.edit')}
          </Button>
        )}
      </div>
    </div>
  )
}

function EditBar({
  dashboard,
  layout,
  onDone,
  onReset,
}: {
  readonly dashboard: Dashboard
  readonly layout: DashboardLayoutState
  readonly onDone: (() => void) | null
  readonly onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-sm">
      <AddMenu addable={addableModules(layout.modules, dashboard)} onAdd={layout.add} />
      {layout.isDefault ? null : (
        <Button onPress={onReset}>
          <RotateCcw aria-hidden size={ICON} />
          {t('dashboard.reset')}
        </Button>
      )}
      {onDone === null ? null : (
        <Button variant="primary" onPress={onDone}>
          <Check aria-hidden size={ICON} />
          {t('dashboard.done')}
        </Button>
      )}
    </div>
  )
}

function Board({ dashboard, layout }: { readonly dashboard: Dashboard; readonly layout: DashboardLayoutState }) {
  const [editing, setEditing] = useState(false)
  // Leaving the actor's own list for a template drops it, so it asks first (D-349).
  const [leaving, setLeaving] = useState<(() => void) | null>(null)
  const types = useLeaveTypes()
  const { setUnit } = useChangeDashboardScope()
  useOverlayLayer(editing, () => {
    setEditing(false)
  })
  const guarded = (change: () => void) => {
    if (layout.template === null && layout.modules.length > 0) setLeaving(() => change)
    else change()
  }
  const { modules } = layout
  const drawn = modules.filter((module) => moduleState(module, dashboard) !== 'hidden')
  const body = (() => {
    if (modules.length === 0) {
      return (
        <EmptyNotice titleKey="dashboard.emptyBoard">
          <EditBar dashboard={dashboard} layout={layout} onDone={editing ? () => setEditing(false) : null} onReset={() => guarded(layout.reset)} />
        </EmptyNotice>
      )
    }
    // Before the first counted day the cards about past days stay hidden; the rest still show, under the reason (D-404).
    const notCounted = dashboard.tally.counted.length === 0 && !editing
    if (notCounted && drawn.length === 0) return <EmptyNotice titleKey="dashboard.emptySpan" />
    if (drawn.length === 0 && !editing) {
      return (
        <EmptyNotice titleKey="dashboard.emptyScope">
          {layout.isDefault ? null : (
            <Button onPress={() => guarded(layout.reset)}>
              <RotateCcw aria-hidden size={ICON} />
              {t('dashboard.reset')}
            </Button>
          )}
        </EmptyNotice>
      )
    }
    return (
      <>
        {notCounted ? <p className="text-name text-text-muted">{t('dashboard.emptySpan')}</p> : null}
        <BoardCards
          modules={modules}
          dashboard={dashboard}
          types={types.status === 'ready' ? types.value : []}
          onUnit={setUnit}
          editing={editing}
          onMove={layout.move}
          onRemove={layout.remove}
        />
      </>
    )
  })()
  return (
    <div className="flex flex-col gap-md">
      <Head
        dashboard={dashboard}
        layout={layout}
        editing={editing}
        onEdit={() => setEditing(true)}
        onChoose={(template) => guarded(() => layout.chooseTemplate(template))}
      />
      {editing && modules.length > 0 ? (
        <EditBar dashboard={dashboard} layout={layout} onDone={() => setEditing(false)} onReset={() => guarded(layout.reset)} />
      ) : null}
      {body}
      {leaving === null ? null : (
        <SmallDialog
          titleKey="dashboard.leaveCustom"
          confirmKey="dashboard.leaveCustomConfirm"
          isPending={false}
          role="alertdialog"
          onConfirm={() => {
            leaving()
            setLeaving(null)
          }}
          onCancel={() => setLeaving(null)}
        />
      )}
    </div>
  )
}

export function DashboardModule() {
  const board = useDashboard()
  if (board === null) return <EmptyNotice titleKey="dashboard.noUnit" bodyKey="dashboard.noUnitBody" />
  if (board.status === 'loading') return <LoadingNotice />
  if (board.status === 'failed') return <FailureNotice error={board.error} />
  return <Board dashboard={board.value.dashboard} layout={board.value.layout} />
}
