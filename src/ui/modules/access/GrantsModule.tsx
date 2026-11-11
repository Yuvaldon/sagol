import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AccessGrant, AppError, Issue, RoleId, Soldier } from '@contracts'
import { t } from '@i18n'
import {
  formFieldIssues,
  fullName,
  grantDaysOf,
  grantFormIssues,
  liveRoles,
  newGrantValues,
  useGrantCommands,
  useGrantPermissionHints,
  useGrantRows,
  usePanel,
  useRoles,
  useSoldiers,
  useTimezone,
  type GrantFormValues,
  type GrantRow,
} from '@logic'
import { Ban, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { CLEAN_FORM, formStateOf, issueError } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { ComboField } from '../../primitives/fields'
import { ScopeFields } from './ScopeFields'
import { scopeText } from './scopeText'
import { useScopeNames } from './useScopeNames'

// Personal access grants (D-028, D-165, D-166): a role given to one soldier, in a scope, for a window of days. A grant
// is not edited; it is revoked and given again.

const GRANT_FIELDS: readonly string[] = [
  'grantee_soldier_id',
  'role_id',
  'anchor_type',
  'anchor_unit_id',
  'anchor_soldier_id',
  'anchor_level_id',
  'anchor_steps',
  'include_descendants',
  'subject_rank_constraint',
  'valid_from',
  'valid_to',
  'reason',
]
const NO_SELECTION = 'none'

function GrantForm({
  soldiers,
  timezone,
  grantTo,
}: {
  readonly soldiers: readonly Soldier[]
  readonly timezone: string
  readonly grantTo: (soldier: Soldier) => boolean
}) {
  const panel = usePanel()
  const roles = useRoles()
  const { grant } = useGrantCommands(timezone)
  const [values, setValues] = useState<GrantFormValues>(newGrantValues)
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState(CLEAN_FORM)
  const own: readonly Issue[] = submitted ? formFieldIssues(grantFormIssues(values, timezone)) : []
  const errorOf = (name: string) => issueError(own, state.answered, name)
  const change = (next: Partial<GrantFormValues>) => {
    setValues((current) => ({ ...current, ...next }))
  }
  const backToList = () => {
    panel.open(PANEL_IDS.accessGrants)
  }

  const submit = async () => {
    setSubmitted(true)
    setState(CLEAN_FORM)
    if (grantFormIssues(values, timezone).length > 0) return
    const result = await grant.run(values)
    if (result.ok) backToList()
    else setState(formStateOf(result.error, GRANT_FIELDS))
  }

  const grantees = soldiers.filter(grantTo)
  const roleChoices: SelectOption<RoleId | null>[] = [
    { key: NO_SELECTION, label: { key: 'scope.none' }, value: null },
    ...(roles.status === 'ready'
      ? liveRoles(roles.value).map((role) => ({ key: role.id, label: { text: role.name }, value: role.id }))
      : []),
  ]

  return (
    <EntityForm
      titleKey="grants.newTitle"
      submitKey="common.create"
      isPending={grant.isPending}
      failure={state.failure}
      onReload={backToList}
      onCancel={backToList}
      onSubmit={() => {
        void submit()
      }}
    >
      <ComboField
        labelKey="grants.grantee"
        toggleLabelKey="grants.granteeToggle"
        name="grantee_soldier_id"
        value={values.grantee_soldier_id}
        options={grantees.map((soldier) => ({ key: soldier.id, label: fullName(soldier) }))}
        onChange={(key) => {
          change({ grantee_soldier_id: grantees.find((soldier) => soldier.id === key)?.id ?? null })
        }}
        error={errorOf('grantee_soldier_id')}
      />
      <SelectField
        labelKey="grants.role"
        name="role_id"
        value={values.role_id}
        options={roleChoices}
        onChange={(role_id) => {
          change({ role_id })
        }}
        error={errorOf('role_id')}
      />
      <ScopeFields values={values} onChange={change} errorOf={errorOf} />
      <div className="flex flex-col gap-2xs">
        <DateField
          labelKey="grants.validFrom"
          name="valid_from"
          value={values.valid_from ?? ''}
          onChange={(day) => {
            change({ valid_from: day === '' ? null : day })
          }}
          error={errorOf('valid_from')}
        />
        <p className="text-micro text-text-muted">{t('grants.validFromHint')}</p>
      </div>
      <div className="flex flex-col gap-2xs">
        <DateField
          labelKey="grants.validTo"
          name="valid_to"
          value={values.valid_to ?? ''}
          onChange={(day) => {
            change({ valid_to: day === '' ? null : day })
          }}
          error={errorOf('valid_to')}
        />
        <p className="text-micro text-text-muted">{t('grants.validToHint')}</p>
      </div>
      <TextAreaField
        labelKey="grants.reason"
        name="reason"
        value={values.reason}
        onChange={(reason) => {
          change({ reason })
        }}
        error={errorOf('reason')}
      />
    </EntityForm>
  )
}

function daysText(grant: AccessGrant, timezone: string): string {
  const days = grantDaysOf(grant, timezone)
  const to = days.to === null ? t('grants.untilRevoked') : `${t('grants.to')} ${formatDate(days.to)}`
  return `${t('grants.from')}${formatDate(days.from)} ${to}`
}

function GrantList({
  soldiers,
  timezone,
  canGrant,
  revokeOf,
}: {
  readonly soldiers: readonly Soldier[]
  readonly timezone: string
  readonly canGrant: boolean
  readonly revokeOf: (grant: AccessGrant) => boolean
}) {
  const panel = usePanel()
  const roles = useRoles()
  const names = useScopeNames()
  const [showInactive, setShowInactive] = useState(false)
  const rows = useGrantRows(showInactive)
  const { revoke } = useGrantCommands(timezone)
  const [revoking, setRevoking] = useState<AccessGrant | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)

  const nameOf = (row: GrantRow) => {
    const soldier = soldiers.find((candidate) => candidate.id === row.grant.grantee_soldier_id)
    return soldier === undefined ? '' : fullName(soldier)
  }
  const roleOf = (row: GrantRow) =>
    roles.status === 'ready' ? (roles.value.find((role) => role.id === row.grant.role_id)?.name ?? '') : ''
  const actionsOf = (row: GrantRow): RowAction[] =>
    row.state !== 'revoked' && row.state !== 'expired' && revokeOf(row.grant)
      ? [
          {
            id: 'revoke',
            labelKey: 'grants.revoke',
            icon: <Ban aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setRevoking(row.grant)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('grants.hint')}</p>
      <SwitchField labelKey="grants.showInactive" name="show_inactive" value={showInactive} onChange={setShowInactive} />
      {failure === null ? null : <FailureNotice error={failure} />}
      {rows.status === 'failed' ? (
        <FailureNotice error={rows.error} />
      ) : rows.status === 'loading' ? (
        <LoadingNotice />
      ) : rows.value.length === 0 ? (
        <EmptyNotice titleKey="grants.emptyTitle" bodyKey="grants.emptyBody" />
      ) : (
        <ul aria-label={t('grants.listLabel')} className="flex flex-col">
          {rows.value.map((row) => (
            <li key={row.grant.id} className="flex items-center gap-2xs border-b border-line bg-surface">
              <span className="flex min-h-touch min-w-none flex-1 flex-col justify-center p-xs md:min-h-control">
                <span className="flex items-center gap-xs">
                  <span className="truncate text-name font-semibold">{nameOf(row)}</span>
                  <span className="shrink-0 rounded-pill bg-inner px-xs text-micro">{t(`grants.states.${row.state}`)}</span>
                </span>
                <span className="truncate text-micro text-text-muted">
                  {[roleOf(row), scopeText(row.grant, names), daysText(row.grant, timezone)].join(' · ')}
                </span>
              </span>
              <ActionMenu labelKey="common.actions" actions={actionsOf(row)} />
            </li>
          ))}
        </ul>
      )}
      {canGrant ? (
        <div>
          <Button
            onPress={() => {
              setFailure(null)
              panel.open(PANEL_IDS.accessGrants, { entity: NEW_ENTITY })
            }}
          >
            <Plus aria-hidden size={14} />
            {t('grants.new')}
          </Button>
        </div>
      ) : null}
      {revoking === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="grants.revokeTitle"
          hintKey="grants.revokeBody"
          confirmKey="grants.revokeConfirm"
          isPending={revoke.isPending}
          onCancel={() => {
            setRevoking(null)
          }}
          onConfirm={() => {
            void revoke.run(revoking).then((result) => {
              setRevoking(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}

function Grants({ soldiers, timezone }: { readonly soldiers: readonly Soldier[]; readonly timezone: string }) {
  const panel = usePanel()
  const hints = useGrantPermissionHints(soldiers)
  if (panel.entity === NEW_ENTITY) {
    if (!hints.any) return <EmptyNotice titleKey="grants.title" bodyKey="grants.noGrantees" />
    return <GrantForm soldiers={soldiers} timezone={timezone} grantTo={(soldier) => hints.grantTo(soldier.id)} />
  }
  return <GrantList soldiers={soldiers} timezone={timezone} canGrant={hints.any} revokeOf={hints.revokeOf} />
}

export function GrantsModule() {
  const soldiers = useSoldiers()
  const timezone = useTimezone()
  if (soldiers.status === 'failed') return <FailureNotice error={soldiers.error} />
  if (soldiers.status === 'loading' || timezone === null) return <LoadingNotice />
  return <Grants soldiers={soldiers.value} timezone={timezone} />
}
