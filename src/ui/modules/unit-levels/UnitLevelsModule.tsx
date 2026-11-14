import { DRAG_ACTIVATION_PX, NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, UnitLevel } from '@contracts'
import { t } from '@i18n'
import {
  archivedRows,
  liveLevels,
  steppedOrder,
  unitLevelFormIssues,
  usePanel,
  useUnitLevelCommands,
  useUnitLevelPermissions,
  useUnitLevels,
} from '@logic'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { ArchivedSection } from '../../patterns/ArchivedSection'
import { SmallDialog } from '../../patterns/Dialogs'
import { CreateInPlace } from '../../patterns/CreateInPlace'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'

// The levels panel: an ordered list. A level has only a name, and its position is the display order.

const LEVEL_FIELDS: readonly string[] = ['name']

function LevelForm({
  level,
  levels,
  onReload,
  onDone,
}: {
  readonly level: UnitLevel | null
  readonly levels: readonly UnitLevel[]
  readonly onReload?: () => void
  /** Made in place (D-285): gets what was saved, or null when left; the panel stays where it is. */
  readonly onDone?: (saved: UnitLevel | null) => void
}) {
  const panel = usePanel()
  const { create, update } = useUnitLevelCommands()
  const [opened] = useState(level)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    if (onDone === undefined) panel.open(PANEL_IDS.unitLevels)
    else onDone(null)
  }

  const form = useForm({
    defaultValues: { name: opened?.name ?? '' },
    validators: { onSubmit: ({ value }) => validatorResult(unitLevelFormIssues(value.name)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      if (opened !== null && value.name === opened.name) {
        backToList()
        return
      }
      const result =
        opened === null
          ? await create.run({ name: value.name, existing: levels })
          : await update.run({ id: opened.id, expected_version: opened.version, changes: { name: value.name } })
      if (result.ok) {
        if (onDone === undefined) backToList()
        else onDone(result.value)
      } else setState(formStateOf(result.error, LEVEL_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'unitLevels.newTitle' : 'unitLevels.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="unitLevels.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
    </EntityForm>
  )
}

function LevelEditor({ level, levels }: { readonly level: UnitLevel | null; readonly levels: readonly UnitLevel[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <LevelForm
      key={generation}
      level={level}
      levels={levels}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function LevelRow({
  level,
  canUpdate,
  canReorder,
  actions,
}: {
  readonly level: UnitLevel
  readonly canUpdate: boolean
  readonly canReorder: boolean
  readonly actions: readonly RowAction[]
}) {
  const panel = usePanel()
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: level.id,
    disabled: !canReorder,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2xs border-b border-line bg-surface ${isDragging ? 'opacity-60' : ''}`}
    >
      {canReorder ? (
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
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.unitLevels, { entity: level.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control px-xs text-start text-name font-semibold outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          <span className="truncate">{level.name}</span>
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center truncate px-xs text-name font-semibold md:min-h-control">
          {level.name}
        </span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

function LevelList({ levels, onFailure }: { readonly levels: readonly UnitLevel[]; readonly onFailure: (error: AppError | null) => void }) {
  const permissions = useUnitLevelPermissions()
  const commands = useUnitLevelCommands()
  const [archiving, setArchiving] = useState<UnitLevel | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }))

  async function reorder(order: readonly UnitLevel[]) {
    onFailure(null)
    const result = await commands.reorder.run(order)
    if (!result.ok) onFailure(result.error)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const from = levels.findIndex((level) => level.id === active.id)
    const to = levels.findIndex((level) => level.id === over?.id)
    if (from < 0 || to < 0 || from === to) return
    void reorder(arrayMove([...levels], from, to))
  }

  function actionsOf(level: UnitLevel, position: number): RowAction[] {
    const step = (direction: -1 | 1) => {
      const order = steppedOrder(levels, level.id, direction)
      if (order !== null) void reorder(order)
    }
    const actions: (RowAction | false)[] = [
      permissions.update && position > 0 && {
        id: 'up',
        labelKey: 'common.stepUp',
        icon: <ArrowUp aria-hidden size={14} />,
        onAction: () => {
          step(-1)
        },
      },
      permissions.update && position < levels.length - 1 && {
        id: 'down',
        labelKey: 'common.stepDown',
        icon: <ArrowDown aria-hidden size={14} />,
        onAction: () => {
          step(1)
        },
      },
      permissions.archive && {
        id: 'archive',
        labelKey: 'common.archive',
        icon: <Archive aria-hidden size={14} />,
        onAction: () => {
          onFailure(null)
          setArchiving(level)
        },
      },
    ]
    return actions.filter((action) => action !== false)
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={levels.map((level) => level.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label={t('unitLevels.listLabel')} className="flex flex-col">
            {levels.map((level, position) => (
              <LevelRow
                key={level.id}
                level={level}
                canUpdate={permissions.update}
                canReorder={permissions.update}
                actions={actionsOf(level, position)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="unitLevels.archiveTitle"
          hintKey="unitLevels.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) onFailure(result.error)
            })
          }}
        />
      )}
    </>
  )
}

export function UnitLevelsModule() {
  const panel = usePanel()
  const levels = useUnitLevels()
  const permissions = useUnitLevelPermissions()
  const { restore } = useUnitLevelCommands()
  const [failure, setFailure] = useState<AppError | null>(null)

  if (levels.status === 'failed') return <FailureNotice error={levels.error} />
  if (levels.status === 'loading') return <LoadingNotice />

  const live = liveLevels(levels.value)
  // Restoring is the reverse of archiving, under the same permission (D-371).
  const archived = (
    <ArchivedSection
      rows={permissions.archive ? archivedRows(levels.value) : []}
      nameOf={(level) => level.name}
      restore={restore}
    />
  )
  const newLevel = () => {
    setFailure(null)
    panel.open(PANEL_IDS.unitLevels, { entity: NEW_ENTITY })
  }

  // A deep link opens only what the actor may use; anything else reads as not found (D-076).
  if (panel.entity === NEW_ENTITY && permissions.create) return <LevelEditor level={null} levels={levels.value} />
  if (panel.entity !== null) {
    const level = live.find((candidate) => candidate.id === panel.entity)
    if (level === undefined || !permissions.update) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('unitLevels.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.unitLevels)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <LevelEditor key={level.id} level={level} levels={levels.value} />
  }

  if (live.length === 0) {
    return (
      <div className="flex flex-col gap-md">
        <EmptyNotice titleKey="unitLevels.emptyTitle" bodyKey={permissions.create ? undefined : 'unitLevels.emptyReadOnly'}>
          {permissions.create ? (
            <Button variant="primary" onPress={newLevel}>
              <Plus aria-hidden size={14} />
              {t('unitLevels.new')}
            </Button>
          ) : null}
        </EmptyNotice>
        {archived}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      <LevelList levels={live} onFailure={setFailure} />
      {permissions.create ? (
        <div>
          <Button onPress={newLevel}>
            <Plus aria-hidden size={14} />
            {t('unitLevels.new')}
          </Button>
        </div>
      ) : null}
      {archived}
    </div>
  )
}

/** A unit type made from another form's field (D-285): the module's own form and command over the drawer. The field takes
 * what was saved; who may not create one reads that it is missing. */
export function UnitLevelInPlace({
  isMissing,
  onCreated,
}: {
  readonly isMissing: boolean
  readonly onCreated: (level: UnitLevel) => void
}) {
  const permissions = useUnitLevelPermissions()
  const levels = useUnitLevels()
  return (
    <CreateInPlace labelKey="unitLevels.new" canCreate={permissions.create} isMissing={isMissing}>
      {(close) =>
        levels.status === 'ready' ? (
          <LevelForm
            level={null}
            levels={levels.value}
            onDone={(saved) => {
              close()
              if (saved !== null) onCreated(saved)
            }}
          />
        ) : levels.status === 'failed' ? (
          <FailureNotice error={levels.error} />
        ) : (
          <LoadingNotice />
        )
      }
    </CreateInPlace>
  )
}
