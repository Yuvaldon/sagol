import { LEAVE_TYPE_PALETTE_KEYS, NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, AvailabilityEffect, LeaveType, LeaveTypeGroup, LeaveTypeGroupId } from '@contracts'
import { t } from '@i18n'
import {
  NEW_LEAVE_TYPE_VALUES,
  leaveTypeFormIssues,
  leaveTypeFormValues,
  leaveTypeSections,
  liveGroups,
  typesOfGroup,
  useLeaveTypeCommands,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  useLeaveTypes,
  usePanel,
  type LeaveTypeSection,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button as AriaButton, Heading } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { CreateInPlace } from '../../patterns/CreateInPlace'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { ColorField } from '../../primitives/ColorField'
import { IconField } from '../../primitives/IconField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextField } from '../../primitives/fields'
import { glyphOf } from '../../theme/icons'
import { leaveTypeToneOf } from '../../theme/palette'

// The types section of the leave types drawer (D-113): types under their groups, each with the color and icon
// the board shows. Up and down in the row menu order a type inside its group.

const TYPE_FIELDS: readonly string[] = ['name', 'group_id', 'color_key', 'icon_key', 'availability_effect', 'requires_reason']

const EFFECT_OPTIONS: readonly SelectOption<AvailabilityEffect>[] = [
  { key: 'unavailable', label: { key: 'leaveTypes.effectUnavailable' }, value: 'unavailable' },
  { key: 'available', label: { key: 'leaveTypes.effectAvailable' }, value: 'available' },
]

const NO_GROUP_KEY = 'none'

function groupOptions(groups: readonly LeaveTypeGroup[]): SelectOption<LeaveTypeGroupId | null>[] {
  return [
    { key: NO_GROUP_KEY, label: { key: 'leaveTypes.noGroup' }, value: null },
    ...liveGroups(groups).map((group) => ({ key: group.id, label: { text: group.name }, value: group.id })),
  ]
}

function TypeForm({
  type,
  groups,
  types,
  onReload,
  onDone,
}: {
  readonly type: LeaveType | null
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
  readonly onReload?: () => void
  /** Made in place (D-285): gets what was saved, or null when left; the panel stays where it is. */
  readonly onDone?: (saved: LeaveType | null) => void
}) {
  const panel = usePanel()
  const { create, update } = useLeaveTypeCommands()
  const [opened] = useState(type)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    if (onDone === undefined) panel.open(PANEL_IDS.leaveTypes)
    else onDone(null)
  }

  const form = useForm({
    defaultValues: opened === null ? NEW_LEAVE_TYPE_VALUES : leaveTypeFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(leaveTypeFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run({ values: value, all: types })
          : await update.run({ type: opened, openedVersion: opened.version, values: value })
      if (result.ok) {
        if (onDone === undefined) backToList()
        else onDone(result.value)
      } else setState(formStateOf(result.error, TYPE_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'leaveTypes.newTitle' : 'leaveTypes.editTitle'}
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
            labelKey="leaveTypes.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="group_id">
        {(field) => (
          <SelectField
            labelKey="leaveTypes.group"
            name={field.name}
            value={field.state.value}
            options={groupOptions(groups)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="availability_effect">
        {(field) => (
          <SelectField
            labelKey="leaveTypes.effect"
            name={field.name}
            value={field.state.value}
            options={EFFECT_OPTIONS}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <p className="text-name text-text-muted">{t('leaveTypes.effectHint')}</p>
      <form.Field name="requires_reason">
        {(field) => (
          <SwitchField labelKey="leaveTypes.requiresReason" name={field.name} value={field.state.value} onChange={field.handleChange} />
        )}
      </form.Field>
      <form.Field name="color_key">
        {(field) => (
          <ColorField
            labelKey="palette.label"
            name={field.name}
            keys={LEAVE_TYPE_PALETTE_KEYS}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="icon_key">
        {(field) => (
          <IconField
            labelKey="icons.label"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
    </EntityForm>
  )
}

function TypeEditor(props: {
  readonly type: LeaveType | null
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
}) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <TypeForm
      key={generation}
      {...props}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

/** The type's look on the board: a round swatch in its color, with its icon. */
function TypeSwatch({ type }: { readonly type: LeaveType }) {
  const glyph = glyphOf(type.icon_key)
  return (
    <span aria-hidden className={`ms-xs flex size-icon shrink-0 items-center justify-center rounded-pill text-on-action ${leaveTypeToneOf(type.color_key).fill}`}>
      {glyph === null ? null : <glyph.Icon size={10} strokeWidth={2.6} />}
    </span>
  )
}

function TypeRow({ type, canUpdate, actions }: { readonly type: LeaveType; readonly canUpdate: boolean; readonly actions: readonly RowAction[] }) {
  const panel = usePanel()
  const notes = [
    ...(type.availability_effect === 'available' ? [t('leaveTypes.marker')] : []),
    ...(type.requires_reason ? [t('leaveTypes.requiresReason')] : []),
  ]
  const text = (
    <span className="flex min-w-none flex-col">
      <span className="truncate text-name font-semibold">{type.name}</span>
      {notes.length === 0 ? null : <span className="truncate text-micro text-text-muted">{notes.join(' · ')}</span>}
    </span>
  )
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      <TypeSwatch type={type} />
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.leaveTypes, { entity: type.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {text}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

/** One group's types, a list named by the group's heading. */
function TypeSection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const headingId = useId()
  return (
    <section className="flex flex-col">
      <Heading id={headingId} level={3} className="px-xs pb-xs text-label font-semibold text-text-muted">
        {title}
      </Heading>
      <ul aria-labelledby={headingId} className="flex flex-col">
        {children}
      </ul>
    </section>
  )
}

export function LeaveTypesModule() {
  const panel = usePanel()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const permissions = useLeaveTypePermissions()
  const commands = useLeaveTypeCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<LeaveType | null>(null)

  if (types.status === 'failed') return <FailureNotice error={types.error} />
  if (groups.status === 'failed') return <FailureNotice error={groups.error} />
  if (types.status === 'loading' || groups.status === 'loading') return <LoadingNotice />

  const all = types.value
  const sections = leaveTypeSections(groups.value, all)
  const live = sections.flatMap((section) => section.types)
  const newType = () => {
    setFailure(null)
    panel.open(PANEL_IDS.leaveTypes, { entity: NEW_ENTITY })
  }

  if (panel.entity === NEW_ENTITY) return <TypeEditor type={null} groups={groups.value} types={all} />
  if (panel.entity !== null) {
    const type = live.find((candidate) => candidate.id === panel.entity)
    if (type === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('leaveTypes.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.leaveTypes)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <TypeEditor key={type.id} type={type} groups={groups.value} types={all} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="leaveTypes.emptyTitle" bodyKey={permissions.create ? undefined : 'leaveTypes.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newType}>
            <Plus aria-hidden size={14} />
            {t('leaveTypes.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const step = (type: LeaveType, direction: -1 | 1) => {
    setFailure(null)
    void commands.step.run({ type, direction, all }).then((result) => {
      if (!result.ok) setFailure(result.error)
    })
  }

  const actionsOf = (type: LeaveType): RowAction[] => {
    const siblings = typesOfGroup(all, type.group_id)
    const index = siblings.findIndex((row) => row.id === type.id)
    return [
      ...(permissions.update && index > 0
        ? [{ id: 'up', labelKey: 'common.stepUp' as const, icon: <ArrowUp aria-hidden size={14} />, onAction: () => { step(type, -1) } }]
        : []),
      ...(permissions.update && index >= 0 && index < siblings.length - 1
        ? [{ id: 'down', labelKey: 'common.stepDown' as const, icon: <ArrowDown aria-hidden size={14} />, onAction: () => { step(type, 1) } }]
        : []),
      ...(permissions.archive
        ? [
            {
              id: 'archive',
              labelKey: 'common.archive' as const,
              icon: <Archive aria-hidden size={14} />,
              onAction: () => {
                setFailure(null)
                setArchiving(type)
              },
            },
          ]
        : []),
    ]
  }

  const sectionTitle = (section: LeaveTypeSection) => section.group?.name ?? t('leaveTypes.noGroup')

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      {sections
        .filter((section) => section.types.length > 0)
        .map((section) => (
          <TypeSection key={section.group?.id ?? NO_GROUP_KEY} title={sectionTitle(section)}>
            {section.types.map((type) => (
              <TypeRow key={type.id} type={type} canUpdate={permissions.update} actions={actionsOf(type)} />
            ))}
          </TypeSection>
        ))}
      {permissions.create ? (
        <div>
          <Button onPress={newType}>
            <Plus aria-hidden size={14} />
            {t('leaveTypes.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="leaveTypes.archiveTitle"
          hintKey="leaveTypes.archiveBody"
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

/** An absence type made from another form's field (D-285): the module's own form and command over the drawer. The field takes
 * what was saved; who may not create one reads that it is missing. */
export function LeaveTypeInPlace({
  isMissing,
  onCreated,
}: {
  readonly isMissing: boolean
  readonly onCreated: (type: LeaveType) => void
}) {
  const permissions = useLeaveTypePermissions()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  return (
    <CreateInPlace labelKey="leaveTypes.new" canCreate={permissions.create} isMissing={isMissing}>
      {(close) =>
        types.status === 'ready' && groups.status === 'ready' ? (
          <TypeForm
            type={null}
            groups={groups.value}
            types={types.value}
            onDone={(saved) => {
              close()
              if (saved !== null) onCreated(saved)
            }}
          />
        ) : types.status === 'failed' ? (
          <FailureNotice error={types.error} />
        ) : groups.status === 'failed' ? (
          <FailureNotice error={groups.error} />
        ) : (
          <LoadingNotice />
        )
      }
    </CreateInPlace>
  )
}
