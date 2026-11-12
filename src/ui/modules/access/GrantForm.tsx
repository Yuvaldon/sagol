import type { Issue, RoleId, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  formFieldIssues,
  fullName,
  grantFormIssues,
  liveRoles,
  newGrantValues,
  useGrantCommands,
  useRoles,
  type GrantFormValues,
} from '@logic'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, formStateOf, issueError } from '../../patterns/forms'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { ComboField } from '../../primitives/fields'
import { RoleInPlace } from './RolesModule'
import { ScopeFields } from './ScopeFields'

// A personal access grant (D-028, D-165, D-166): a role given to one soldier, in a scope, for a window of days.

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

/**
 * A new grant. On a soldier's card the grantee is that soldier and is not asked (D-284); in the module it is chosen
 * from who this actor may grant to.
 */
export function GrantForm({
  soldiers,
  timezone,
  grantTo,
  grantee = null,
  onDone,
}: {
  readonly soldiers: readonly Soldier[]
  readonly timezone: string
  readonly grantTo: (soldier: Soldier) => boolean
  readonly grantee?: SoldierId | null
  /** Back to where the form opened from, once given or cancelled. */
  readonly onDone: () => void
}) {
  const roles = useRoles()
  const { grant } = useGrantCommands(timezone)
  const [values, setValues] = useState<GrantFormValues>(() => ({ ...newGrantValues(), grantee_soldier_id: grantee }))
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState(CLEAN_FORM)
  const own: readonly Issue[] = submitted ? formFieldIssues(grantFormIssues(values, timezone)) : []
  const errorOf = (name: string) => issueError(own, state.answered, name)
  const change = (next: Partial<GrantFormValues>) => {
    setValues((current) => ({ ...current, ...next }))
  }
  const submit = async () => {
    setSubmitted(true)
    setState(CLEAN_FORM)
    if (grantFormIssues(values, timezone).length > 0) return
    const result = await grant.run(values)
    if (result.ok) onDone()
    // A grantee given by the card has no field here, so an issue about it is the form's failure, not a hidden one.
    else setState(formStateOf(result.error, grantee === null ? GRANT_FIELDS : GRANT_FIELDS.filter((field) => field !== 'grantee_soldier_id')))
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
      onReload={onDone}
      onCancel={onDone}
      onSubmit={() => {
        void submit()
      }}
    >
      {grantee === null ? (
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
      ) : null}
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
      <RoleInPlace
        isMissing={roles.status === 'ready' && liveRoles(roles.value).length === 0}
        onCreated={(role) => {
          change({ role_id: role.id })
        }}
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
