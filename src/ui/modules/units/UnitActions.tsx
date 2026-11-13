import { NEW_ENTITY, PALETTE_KEYS, PANEL_IDS, type PaletteKey } from '@config'
import type { AppError, Unit, UnitId } from '@contracts'
import { moveCandidates, siblingsUnder, usePanel, useUnitCommands, useUnitPermissions } from '@logic'
import { Archive, ArrowDown, ArrowUp, CornerDownLeft, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { PALETTE_SWATCHES } from '../../theme/palette'

// What a unit offers wherever the tree is drawn, as a list or as a chart (D-320): its color, its name and level,
// and the menu of add a child, move, a step up or down, and archive, each behind its own permission, with the
// dialogs the menu opens.

export type UnitPermissions = ReturnType<typeof useUnitPermissions>

const TOP_LEVEL = 'top'

/** The unit's color as a dot; nothing when it has none. */
export function UnitSwatch({ colorKey }: { readonly colorKey: string | null }) {
  const key = PALETTE_KEYS.find((candidate: PaletteKey) => candidate === colorKey)
  return key === undefined ? null : <span aria-hidden className={`size-dot shrink-0 rounded-pill ${PALETTE_SWATCHES[key].className}`} />
}

/** The unit's name over its level's name. */
export function UnitName({ unit, levelName }: { readonly unit: Unit; readonly levelName: string | null }) {
  return (
    <span className="flex min-w-none flex-col">
      <span className="truncate text-name font-semibold">{unit.name}</span>
      {levelName === null ? null : <span className="truncate text-micro text-text-muted">{levelName}</span>}
    </span>
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

/** Gives `children` each unit's actions, and holds the move and archive dialogs they open. */
export function UnitActionsScope({
  units,
  permissions,
  onFailure,
  children,
}: {
  readonly units: readonly Unit[]
  readonly permissions: UnitPermissions
  readonly onFailure: (error: AppError | null) => void
  readonly children: (actionsOf: (unit: Unit) => RowAction[]) => ReactNode
}) {
  const panel = usePanel()
  const commands = useUnitCommands()
  const [moving, setMoving] = useState<Unit | null>(null)
  const [archiving, setArchiving] = useState<Unit | null>(null)

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

  return (
    <>
      {children(actionsOf)}
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
    </>
  )
}
