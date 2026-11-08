import { DRAG_ACTIVATION_PX, PALETTE_KEYS, NEW_ENTITY, PANEL_IDS, type PaletteKey } from '@config'
import type { AppError, Unit, UnitId, UnitLevel } from '@contracts'
import { t } from '@i18n'
import {
  dropZoneAt,
  moveCandidates,
  planUnitDrop,
  siblingsUnder,
  unitTreeRows,
  usePanel,
  useUnitCommands,
  useUnitPermissions,
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
import { Archive, ArrowDown, ArrowUp, CornerDownLeft, GripVertical, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { PALETTE_SWATCHES } from '../../theme/palette'

// The tree. A row has a handle, its color, its name and its menu. Dragging is one way to move a unit,
// and the menu is the same power without a pointer (D-092). Every drop goes to the adapter, which
// also refuses what would make a cycle.

type UnitPermissions = ReturnType<typeof useUnitPermissions>

interface DropTarget {
  readonly id: UnitId
  readonly zone: UnitDropZone
}

const TOP_LEVEL = 'top'

function swatchClass(colorKey: string | null): string | null {
  const key = PALETTE_KEYS.find((candidate: PaletteKey) => candidate === colorKey)
  return key === undefined ? null : PALETTE_SWATCHES[key].className
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
  const { setNodeRef, setActivatorNodeRef, listeners } = useDraggable({ id: unit.id, disabled: !canUpdate })
  const color = swatchClass(unit.color_key)
  const depthLabel = `${t('units.depth')} ${String(depth + 1)}`

  const name = (
    <span className="flex min-w-none flex-col">
      <span className="truncate text-name font-semibold">{unit.name}</span>
      {levelName === null ? null : <span className="truncate text-micro text-text-muted">{levelName}</span>}
    </span>
  )

  return (
    <li
      ref={setNodeRef}
      data-unit-id={unit.id}
      style={{ paddingInlineStart: `calc(var(--spacing-lg) * ${String(depth)})` }}
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
      {color === null ? null : <span aria-hidden className={`size-dot shrink-0 rounded-pill ${color}`} />}
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

function MoveDialog({
  unit,
  units,
  permissions,
  isPending,
  onMove,
  onCancel,
}: {
  readonly unit: Unit
  readonly units: readonly Unit[]
  readonly permissions: UnitPermissions
  readonly isPending: boolean
  readonly onMove: (parentId: UnitId | null) => void
  readonly onCancel: () => void
}) {
  const options = useMemo(() => {
    const top: SelectOption<UnitId | null>[] = permissions.moveTo(null)
      ? [{ key: TOP_LEVEL, label: { key: 'units.parentTop' }, value: null }]
      : []
    return [
      ...top,
      ...moveCandidates(units, unit)
        .filter((row) => permissions.moveTo(row.unit.id))
        .map((row) => ({ key: row.unit.id, label: { text: row.unit.name }, value: row.unit.id, depth: row.depth })),
    ].filter((option) => option.value !== unit.parent_id)
  }, [permissions, unit, units])
  const [parentId, setParentId] = useState<UnitId | null | undefined>(options[0]?.value)

  return (
    <SmallDialog
      titleKey="units.moveTitle"
      hintKey="units.moveHint"
      confirmKey="units.moveSubmit"
      isPending={isPending || parentId === undefined}
      onConfirm={() => {
        if (parentId !== undefined) onMove(parentId)
      }}
      onCancel={onCancel}
    >
      <SelectField
        labelKey="units.parent"
        name="parent_id"
        value={parentId}
        options={options}
        onChange={setParentId}
        error={null}
      />
    </SmallDialog>
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
  const panel = usePanel()
  const commands = useUnitCommands()
  const rows = useMemo(() => unitTreeRows(units), [units])
  const levelNames = useMemo(() => new Map(levels.map((level) => [level.id, level.name])), [levels])
  const [activeId, setActiveId] = useState<UnitId | null>(null)
  const [start, setStart] = useState<{ readonly x: number; readonly y: number } | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const [moving, setMoving] = useState<Unit | null>(null)
  const [archiving, setArchiving] = useState<Unit | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }))

  const unitOf = (id: unknown) => units.find((unit) => unit.id === id) ?? null

  // The target comes from where the pointer really is and what is under it now. Measured rects go
  // stale when the list scrolls during a drag, by hand or by auto-scroll.
  useEffect(() => {
    if (start === null) return undefined
    let { x, y } = start
    const update = () => {
      const row = document.elementsFromPoint(x, y).find((element) => element instanceof HTMLElement && element.dataset.unitId !== undefined)
      const over = row instanceof HTMLElement ? units.find((unit) => unit.id === row.dataset.unitId) : undefined
      if (row === undefined || over === undefined) {
        setTarget(null)
        return
      }
      const rect = row.getBoundingClientRect()
      setTarget({ id: over.id, zone: dropZoneAt(y, rect.top, rect.height) })
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
  }, [start, units])

  async function applyDrop(event: DragEndEvent) {
    const unit = unitOf(event.active.id)
    const dropped = target
    setActiveId(null)
    setStart(null)
    setTarget(null)
    if (unit === null || dropped === null) return
    const plan = planUnitDrop(units, unit.id, dropped.id, dropped.zone)
    if (plan === null) return
    onFailure(null)
    const result = await commands.drop.run({ unit, plan })
    if (!result.ok) onFailure(result.error)
  }

  async function step(unit: Unit, direction: -1 | 1) {
    onFailure(null)
    const result = await commands.step.run({ unit, direction, all: units })
    if (!result.ok) onFailure(result.error)
  }

  function actionsOf(unit: Unit): RowAction[] {
    const siblings = siblingsUnder(units, unit.parent_id)
    const position = siblings.findIndex((sibling) => sibling.id === unit.id)
    const reorderable = permissions.reorderAround(unit)
    const actions: (RowAction | false)[] = [
      permissions.createUnder(unit.id) && {
        id: 'add-child',
        labelKey: 'units.addChild',
        icon: <Plus aria-hidden size={14} />,
        onAction: () => {
          panel.open(PANEL_IDS.units, { entity: NEW_ENTITY, parent: unit.id })
        },
      },
      permissions.update(unit) && {
        id: 'move',
        labelKey: 'units.moveTo',
        icon: <CornerDownLeft aria-hidden size={14} />,
        onAction: () => {
          onFailure(null)
          setMoving(unit)
        },
      },
      reorderable && position > 0 && {
        id: 'up',
        labelKey: 'common.stepUp',
        icon: <ArrowUp aria-hidden size={14} />,
        onAction: () => {
          void step(unit, -1)
        },
      },
      reorderable && position < siblings.length - 1 && {
        id: 'down',
        labelKey: 'common.stepDown',
        icon: <ArrowDown aria-hidden size={14} />,
        onAction: () => {
          void step(unit, 1)
        },
      },
      permissions.archive(unit) && {
        id: 'archive',
        labelKey: 'common.archive',
        icon: <Archive aria-hidden size={14} />,
        onAction: () => {
          onFailure(null)
          setArchiving(unit)
        },
      },
    ]
    return actions.filter((action) => action !== false)
  }

  const activeUnit = unitOf(activeId)

  return (
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
            <div className="glass-menu w-fit rounded-pill px-md py-xs text-name font-semibold">{activeUnit.name}</div>
          )}
        </DragOverlay>,
        document.body,
      )}
      {moving === null ? null : (
        <MoveDialog
          unit={moving}
          units={units}
          permissions={permissions}
          isPending={commands.move.isPending}
          onCancel={() => {
            setMoving(null)
          }}
          onMove={(parentId) => {
            void commands.move.run({ unit: moving, parentId }).then((result) => {
              setMoving(null)
              if (!result.ok) onFailure(result.error)
            })
          }}
        />
      )}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="units.archiveTitle"
          hintKey="units.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run({ unit: archiving, openedVersion: archiving.version }).then((result) => {
              setArchiving(null)
              if (!result.ok) onFailure(result.error)
            })
          }}
        />
      )}
    </DndContext>
  )
}
