import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, CommandRankId, Issue, RankRoleBinding, Role, RoleId } from '@contracts'
import { t } from '@i18n'
import {
  bindingFormIssues,
  bindingFormValues,
  formFieldIssues,
  liveBindingsOf,
  liveRoles,
  newBindingValues,
  useBindingCommands,
  useCommandRanks,
  usePanel,
  useRankBindings,
  useRolePermissionHints,
  useRoles,
  type BindingFormValues,
} from '@logic'
import { Archive, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, formStateOf, issueError } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { ScopeFields } from './ScopeFields'
import { scopeText } from './scopeText'
import { useScopeNames } from './useScopeNames'

// The rank bindings of one role (D-060, D-165): whoever holds the rank gets the role in the scope set here. The rank is
// fixed once bound (D-045); the scope may change.

const BINDING_FIELDS: readonly string[] = [
  'command_rank_id',
  'anchor_type',
  'anchor_unit_id',
  'anchor_soldier_id',
  'anchor_level_id',
  'anchor_steps',
  'include_descendants',
  'subject_rank_constraint',
]
const NO_SELECTION = 'none'

function BindingForm({
  roleId,
  binding,
  onReload,
}: {
  readonly roleId: RoleId
  readonly binding: RankRoleBinding | null
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const ranks = useCommandRanks()
  const { create, update } = useBindingCommands()
  const [opened] = useState(binding)
  const [values, setValues] = useState<BindingFormValues>(opened === null ? newBindingValues() : bindingFormValues(opened))
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState(CLEAN_FORM)
  const own: readonly Issue[] = submitted ? formFieldIssues(bindingFormIssues(roleId, values)) : []
  const errorOf = (name: string) => issueError(own, state.answered, name)
  const backToList = () => {
    panel.open(PANEL_IDS.rankBindings)
  }

  const submit = async () => {
    setSubmitted(true)
    setState(CLEAN_FORM)
    if (bindingFormIssues(roleId, values).length > 0) return
    const result =
      opened === null
        ? await create.run({ roleId, values })
        : await update.run({ binding: opened, openedVersion: opened.version, values })
    if (result.ok) backToList()
    else setState(formStateOf(result.error, BINDING_FIELDS))
  }

  const rankChoices: SelectOption<CommandRankId | null>[] = [
    { key: NO_SELECTION, label: { key: 'scope.none' }, value: null },
    ...(ranks.status === 'ready'
      ? ranks.value
          .filter((rank) => rank.archived_at === null || rank.id === values.command_rank_id)
          .map((rank) => ({ key: rank.id, label: { text: rank.title }, value: rank.id }))
      : []),
  ]
  const fixedRank = ranks.status === 'ready' ? ranks.value.find((rank) => rank.id === opened?.command_rank_id) : undefined

  return (
    <EntityForm
      titleKey={opened === null ? 'bindings.newTitle' : 'bindings.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void submit()
      }}
    >
      {opened === null ? (
        <SelectField
          labelKey="bindings.rank"
          name="command_rank_id"
          value={values.command_rank_id}
          options={rankChoices}
          onChange={(command_rank_id) => {
            setValues((current) => ({ ...current, command_rank_id }))
          }}
          error={errorOf('command_rank_id')}
        />
      ) : (
        <div className="flex flex-col gap-2xs">
          <span className="text-label font-semibold text-text-muted">{t('bindings.rank')}</span>
          <span className="text-control">{fixedRank?.title ?? ''}</span>
          <span className="text-micro text-text-muted">{t('bindings.rankFixed')}</span>
        </div>
      )}
      <ScopeFields
        values={values}
        onChange={(scope) => {
          setValues((current) => ({ ...current, ...scope }))
        }}
        errorOf={errorOf}
      />
    </EntityForm>
  )
}

function BindingEditor({ roleId, binding }: { readonly roleId: RoleId; readonly binding: RankRoleBinding | null }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <BindingForm
      key={generation}
      roleId={roleId}
      binding={binding}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function BackToList() {
  const panel = usePanel()
  return (
    <div className="flex flex-col items-center gap-md py-xl text-center">
      <p className="text-name text-text-muted">{t('bindings.notFound')}</p>
      <Button
        onPress={() => {
          panel.open(PANEL_IDS.rankBindings)
        }}
      >
        {t('common.backToList')}
      </Button>
    </div>
  )
}

export function RankBindingsModule() {
  const panel = usePanel()
  const roles = useRoles()
  const bindings = useRankBindings()
  const ranks = useCommandRanks()
  const names = useScopeNames()
  const permissions = useRolePermissionHints()
  const commands = useBindingCommands()
  const [roleId, setRoleId] = useState<RoleId | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<RankRoleBinding | null>(null)

  if (roles.status === 'failed') return <FailureNotice error={roles.error} />
  if (bindings.status === 'failed') return <FailureNotice error={bindings.error} />
  if (roles.status === 'loading' || bindings.status === 'loading') return <LoadingNotice />

  const live = liveRoles(roles.value)
  const role: Role | undefined = live.find((candidate) => candidate.id === roleId)

  if (panel.entity === NEW_ENTITY) {
    if (role === undefined || !permissions.create) return <BackToList />
    return <BindingEditor roleId={role.id} binding={null} />
  }
  if (panel.entity !== null) {
    const binding = bindings.value.find((candidate) => candidate.id === panel.entity && candidate.archived_at === null)
    if (binding === undefined || !permissions.update) return <BackToList />
    return <BindingEditor key={binding.id} roleId={binding.role_id} binding={binding} />
  }

  if (live.length === 0) return <EmptyNotice titleKey="roles.emptyTitle" bodyKey="bindings.noRoles" />

  const roleChoices: SelectOption<RoleId | null>[] = [
    { key: NO_SELECTION, label: { key: 'scope.none' }, value: null },
    ...live.map((candidate) => ({ key: candidate.id, label: { text: candidate.name }, value: candidate.id })),
  ]
  const rows = role === undefined ? [] : liveBindingsOf(bindings.value, role.id)
  const rankTitle = (binding: RankRoleBinding) =>
    ranks.status === 'ready' ? (ranks.value.find((rank) => rank.id === binding.command_rank_id)?.title ?? '') : ''

  const actionsOf = (binding: RankRoleBinding): RowAction[] =>
    permissions.archive
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive',
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(binding)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('bindings.hint')}</p>
      <SelectField labelKey="bindings.role" name="role_id" value={role?.id ?? null} options={roleChoices} onChange={setRoleId} error={null} />
      {failure === null ? null : <FailureNotice error={failure} />}
      {role === undefined ? (
        <p className="text-name text-text-muted">{t('bindings.chooseRole')}</p>
      ) : rows.length === 0 ? (
        <EmptyNotice titleKey="bindings.emptyTitle" bodyKey="bindings.emptyBody" />
      ) : (
        <ul aria-label={t('bindings.listLabel')} className="flex flex-col">
          {rows.map((binding) => {
            const text = (
              <span className="flex min-w-none flex-col">
                <span className="truncate text-name font-semibold">{rankTitle(binding)}</span>
                <span className="truncate text-micro text-text-muted">{scopeText(binding, names)}</span>
              </span>
            )
            return (
              <li key={binding.id} className="flex items-center gap-2xs border-b border-line bg-surface">
                {permissions.update ? (
                  <AriaButton
                    onPress={() => {
                      panel.open(PANEL_IDS.rankBindings, { entity: binding.id })
                    }}
                    className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
                  >
                    {text}
                  </AriaButton>
                ) : (
                  <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
                )}
                <ActionMenu labelKey="common.actions" actions={actionsOf(binding)} />
              </li>
            )
          })}
        </ul>
      )}
      {role !== undefined && permissions.create ? (
        <div>
          <Button
            onPress={() => {
              setFailure(null)
              panel.open(PANEL_IDS.rankBindings, { entity: NEW_ENTITY })
            }}
          >
            <Plus aria-hidden size={14} />
            {t('bindings.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="bindings.archiveTitle"
          hintKey="bindings.archiveBody"
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
