import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, LeaveTypeGroup } from '@contracts'
import { t } from '@i18n'
import {
  leaveTypeGroupFormIssues,
  liveGroups,
  useLeaveTypeGroupCommands,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  usePanel,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'

// The groups section of the leave types drawer (D-113): an ordered list of names. Up and down in the row menu
// set the order.

const GROUP_FIELDS: readonly string[] = ['name']

function GroupForm({
  group,
  groups,
  onReload,
}: {
  readonly group: LeaveTypeGroup | null
  readonly groups: readonly LeaveTypeGroup[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, rename } = useLeaveTypeGroupCommands()
  const [opened] = useState(group)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.leaveTypeGroups)
  }

  const form = useForm({
    defaultValues: { name: opened?.name ?? '' },
    validators: { onSubmit: ({ value }) => validatorResult(leaveTypeGroupFormIssues(value.name)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run({ name: value.name, all: groups })
          : await rename.run({ group: opened, openedVersion: opened.version, name: value.name })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, GROUP_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'leaveTypeGroups.newTitle' : 'leaveTypeGroups.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || rename.isPending}
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
            labelKey="leaveTypeGroups.name"
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

function GroupEditor({ group, groups }: { readonly group: LeaveTypeGroup | null; readonly groups: readonly LeaveTypeGroup[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <GroupForm
      key={generation}
      group={group}
      groups={groups}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

export function LeaveTypeGroupsModule() {
  const panel = usePanel()
  const groups = useLeaveTypeGroups()
  const permissions = useLeaveTypePermissions()
  const commands = useLeaveTypeGroupCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<LeaveTypeGroup | null>(null)

  if (groups.status === 'failed') return <FailureNotice error={groups.error} />
  if (groups.status === 'loading') return <LoadingNotice />

  const live = liveGroups(groups.value)
  const newGroup = () => {
    setFailure(null)
    panel.open(PANEL_IDS.leaveTypeGroups, { entity: NEW_ENTITY })
  }

  if (panel.entity === NEW_ENTITY) return <GroupEditor group={null} groups={groups.value} />
  if (panel.entity !== null) {
    const group = live.find((candidate) => candidate.id === panel.entity)
    if (group === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('leaveTypeGroups.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.leaveTypeGroups)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <GroupEditor key={group.id} group={group} groups={groups.value} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="leaveTypeGroups.emptyTitle" bodyKey={permissions.create ? undefined : 'leaveTypeGroups.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newGroup}>
            <Plus aria-hidden size={14} />
            {t('leaveTypeGroups.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const step = (group: LeaveTypeGroup, direction: -1 | 1) => {
    setFailure(null)
    void commands.step.run({ group, direction, all: groups.value }).then((result) => {
      if (!result.ok) setFailure(result.error)
    })
  }

  const actionsOf = (group: LeaveTypeGroup, index: number): RowAction[] => [
    ...(permissions.update && index > 0
      ? [{ id: 'up', labelKey: 'common.stepUp' as const, icon: <ArrowUp aria-hidden size={14} />, onAction: () => { step(group, -1) } }]
      : []),
    ...(permissions.update && index < live.length - 1
      ? [{ id: 'down', labelKey: 'common.stepDown' as const, icon: <ArrowDown aria-hidden size={14} />, onAction: () => { step(group, 1) } }]
      : []),
    ...(permissions.archive
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive' as const,
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(group)
            },
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      <ul aria-label={t('leaveTypeGroups.listLabel')} className="flex flex-col">
        {live.map((group, index) => (
          <li key={group.id} className="flex items-center gap-2xs border-b border-line bg-surface">
            {permissions.update ? (
              <AriaButton
                onPress={() => {
                  panel.open(PANEL_IDS.leaveTypeGroups, { entity: group.id })
                }}
                className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start text-name font-semibold outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
              >
                <span className="truncate">{group.name}</span>
              </AriaButton>
            ) : (
              <span className="flex min-h-touch min-w-none flex-1 items-center p-xs text-name font-semibold md:min-h-control">
                <span className="truncate">{group.name}</span>
              </span>
            )}
            <ActionMenu labelKey="common.actions" actions={actionsOf(group, index)} />
          </li>
        ))}
      </ul>
      {permissions.create ? (
        <div>
          <Button onPress={newGroup}>
            <Plus aria-hidden size={14} />
            {t('leaveTypeGroups.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="leaveTypeGroups.archiveTitle"
          hintKey="leaveTypeGroups.archiveBody"
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
