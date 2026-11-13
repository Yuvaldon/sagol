import { DRAG_ACTIVATION_PX, PANEL_IDS } from '@config'
import type { AppError, Unit, UnitId, UnitLevel } from '@contracts'
import { t } from '@i18n'
import {
  dropZoneAt,
  planUnitDrop,
  unitTreeRows,
  usePanel,
  useUnitCommands,
  type UnitDropZone,
  type UnitTreeRow,
} from '@logic'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { UnitActionsScope, UnitName, UnitSwatch, type UnitPermissions } from './UnitActions'

// The tree. A row has a handle, its color, its name and its menu. Dragging is one way to move a unit,
// and the menu is the same power without a pointer (D-092). Every drop goes to the adapter, which
// also refuses what would make a cycle.

interface DropTarget {
  readonly id: UnitId
  readonly zone: UnitDropZone
}

const DROP_LINE = 'pointer-events-none absolute inset-x-none h-2xs bg-marker'

function UnitRow({
  row,
  levelName,
  dropZone,
  isDragging,
  permissions,
  actions,
}: {
  readonly row: UnitTreeRow
  readonly levelName: string | null
  readonly dropZone: UnitDropZone | null
  readonly isDragging: boolean
  readonly permissions: UnitPermissions
  readonly actions: readonly RowAction[]
}) {
  const { unit, depth } = row
  const panel = usePanel()
  const canUpdate = permissions.update(unit)
  const { setNodeRef, setActivatorNodeRef, listeners } = useDraggable({
    id: unit.id,
    disabled: !canUpdate,
  })
  const depthLabel = `${t('units.depth')} ${String(depth + 1)}`

  const name = <UnitName unit={unit} levelName={levelName} />

  return (
    <li
      ref={setNodeRef}
      data-unit-id={unit.id}
      style={{
        paddingInlineStart: `calc(var(--spacing-lg) * ${String(depth)})`,
      }}
      className={`relative flex items-center gap-2xs border-b border-line ${isDragging ? 'opacity-60' : ''} ${dropZone === 'into' ? 'bg-inner' : ''}`}
    >
      {dropZone === 'before' ? <span aria-hidden className={`${DROP_LINE} top-none`} /> : null}
      {dropZone === 'after' ? <span aria-hidden className={`${DROP_LINE} bottom-none`} /> : null}
      {canUpdate ? (
        <span
          ref={setActivatorNodeRef}
          {...listeners}
          aria-hidden
          data-testid="drag-handle"
          className="flex min-h-touch min-w-touch shrink-0 cursor-grab touch-none items-center justify-center text-text-muted md:min-h-control md:min-w-control"
        >
          <GripVertical size={14} />
        </span>
      ) : null}
      <span className="sr-only">{depthLabel}</span>
      <UnitSwatch colorKey={unit.color_key} />
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.units, { entity: unit.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control px-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {name}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center px-xs md:min-h-control">{name}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

export function UnitTree({
  units,
  levels,
  permissions,
  onFailure,
}: {
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly permissions: UnitPermissions
  readonly onFailure: (error: AppError | null) => void
}) {
  const commands = useUnitCommands()
  const rows = useMemo(() => unitTreeRows(units), [units])
  const levelNames = useMemo(() => new Map(levels.map((level) => [level.id, level.name])), [levels])
  const [activeId, setActiveId] = useState<UnitId | null>(null)
  const [start, setStart] = useState<{
    readonly x: number
    readonly y: number
  } | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_PX },
    }),
  )

  const unitOf = (id: unknown) => units.find((unit) => unit.id === id) ?? null

  // The target comes from where the pointer really is and what is under it now. Measured rects go
  // stale when the list scrolls during a drag, by hand or by auto-scroll.
  useEffect(() => {
    if (start === null) return undefined
    let { x, y } = start
    const update = () => {
      const row = document
        .elementsFromPoint(x, y)
        .find((element) => element instanceof HTMLElement && element.dataset.unitId !== undefined)
      const over = row instanceof HTMLElement ? units.find((unit) => unit.id === row.dataset.unitId) : undefined
      if (row === undefined || over === undefined) {
        setTarget(null)
        return
      }
      const rect = row.getBoundingClientRect()
      const zone = dropZoneAt(y, rect.top, rect.height)
      // A zone the drop would refuse shows no indicator (OI-247).
      const allowed = activeId !== null && planUnitDrop(units, activeId, over.id, zone, permissions.moveTo) !== null
      setTarget(allowed ? { id: over.id, zone } : null)
    }
    const onMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      update()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', update, true)
    }
  }, [start, units, activeId, permissions])

  async function applyDrop(event: DragEndEvent) {
    const unit = unitOf(event.active.id)
    const dropped = target
    setActiveId(null)
    setStart(null)
    setTarget(null)
    if (unit === null || dropped === null) return
    const plan = planUnitDrop(units, unit.id, dropped.id, dropped.zone, permissions.moveTo)
    if (plan === null) return
    onFailure(null)
    const result = await commands.drop.run({ unit, plan })
    if (!result.ok) onFailure(result.error)
  }

  const activeUnit = unitOf(activeId)

  return (
    <UnitActionsScope units={units} permissions={permissions} onFailure={onFailure}>
      {(actionsOf) => (
        <DndContext
          sensors={sensors}
          onDragStart={(event: DragStartEvent) => {
            setActiveId(unitOf(event.active.id)?.id ?? null)
            const pressed = event.activatorEvent
            setStart(pressed instanceof MouseEvent ? { x: pressed.clientX, y: pressed.clientY } : null)
          }}
          onDragEnd={(event) => {
            void applyDrop(event)
          }}
          onDragCancel={() => {
            setActiveId(null)
            setStart(null)
            setTarget(null)
          }}
        >
          <ul aria-label={t('units.listLabel')} className="flex flex-col">
            {rows.map((row) => (
              <UnitRow
                key={row.unit.id}
                row={row}
                levelName={row.unit.unit_level_id === null ? null : (levelNames.get(row.unit.unit_level_id) ?? null)}
                dropZone={target?.id === row.unit.id ? target.zone : null}
                isDragging={activeId === row.unit.id}
                permissions={permissions}
                actions={actionsOf(row.unit)}
              />
            ))}
          </ul>
          {/* In a portal: the drawer's glass makes a containing block, which would misplace the overlay. */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeUnit === null ? null : (
                <div className="glass-menu w-fit rounded-pill px-md py-xs text-name font-semibold">
                  {activeUnit.name}
                </div>
              )}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}
    </UnitActionsScope>
  )
}
