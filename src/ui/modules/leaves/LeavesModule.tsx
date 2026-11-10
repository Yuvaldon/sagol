import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { CalendarDate, LeaveType, LeaveTypeGroup, LeaveTypeId, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  newLeaveIssues,
  newLeaveValues,
  useCreateLeave,
  useLeaveCreation,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  useLeaveTypes,
  useModuleAccess,
  useMyPreferences,
  usePanel,
  useSoldiers,
  useToday,
} from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { Tags } from 'lucide-react'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { ComboField, TextField } from '../../primitives/fields'
import { leaveTypeOptions } from './typeOptions'
import { LeaveDetails } from './LeaveDetails'

// A new leave (D-115): who, what kind, which days, and why when the type asks. "Approve now" is there only for
// who may approve that soldier, and starts from their own default (D-121). The bar is on the board as soon as it is
// sent.

const LEAVE_FIELDS: readonly string[] = ['soldier_id', 'leave_type_id', 'start_date', 'end_date', 'reason']

/** What the type field holds until a type is chosen. It leaves the list once one is. */
const CHOOSE_TYPE: SelectOption<LeaveTypeId | null> = { key: 'none', label: { key: 'leaves.chooseType' }, value: null }

function NewLeaveForm({
  soldiers,
  canApprove,
  groups,
  types,
  today,
  approveNow,
}: {
  readonly soldiers: readonly Soldier[]
  readonly canApprove: (soldierId: SoldierId) => boolean
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
  readonly today: CalendarDate
  readonly approveNow: boolean
}) {
  const panel = usePanel()
  const create = useCreateLeave()
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId | null) => types.find((type) => type.id === id) ?? null

  const form = useForm({
    defaultValues: newLeaveValues(today, approveNow),
    validators: { onSubmit: ({ value }) => validatorResult(newLeaveIssues(value, typeOf(value.leave_type_id))) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      // Only who may approve the soldier sends "approve now"; the command checks again (D-013).
      const asApproved = value.as_approved && value.soldier_id !== null && canApprove(value.soldier_id)
      const result = await create.run({ ...value, as_approved: asApproved })
      if (result.ok) panel.close()
      else setState(formStateOf(result.error, LEAVE_FIELDS))
    },
  })
  const soldierId = useStore(form.store, (current) => current.values.soldier_id)
  const typeId = useStore(form.store, (current) => current.values.leave_type_id)
  const reasonRequired = typeOf(typeId)?.requires_reason === true

  return (
    <EntityForm
      titleKey="leaves.newTitle"
      submitKey="leaves.submit"
      isPending={create.isPending}
      failure={state.failure}
      onCancel={panel.close}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="soldier_id">
        {(field) => (
          <ComboField
            labelKey="leaves.soldier"
            toggleLabelKey="leaves.soldierToggle"
            name={field.name}
            value={field.state.value}
            options={soldiers.map((soldier) => ({ key: soldier.id, label: fullName(soldier) }))}
            onChange={(key) => {
              field.handleChange(soldiers.find((soldier) => soldier.id === key)?.id ?? null)
            }}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="leave_type_id">
        {(field) => (
          <SelectField
            labelKey="leaves.type"
            name={field.name}
            value={field.state.value}
            options={field.state.value === null ? [CHOOSE_TYPE, ...leaveTypeOptions(groups, types)] : leaveTypeOptions(groups, types)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-md">
        <form.Field name="start_date">
          {(field) => (
            <DateField
              labelKey="leaves.from"
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              error={fieldError(field.state.meta.errors, field.name, state.answered)}
            />
          )}
        </form.Field>
        <form.Field name="end_date">
          {(field) => (
            <DateField
              labelKey="leaves.to"
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              error={fieldError(field.state.meta.errors, field.name, state.answered)}
            />
          )}
        </form.Field>
      </div>
      <form.Field name="reason">
        {(field) => (
          <TextField
            labelKey={reasonRequired ? 'leaves.reasonRequired' : 'leaves.reason'}
            name={field.name}
            isRequired={reasonRequired}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      {soldierId !== null && canApprove(soldierId) ? (
        <form.Field name="as_approved">
          {(field) => <SwitchField labelKey="leaves.approveNow" name={field.name} value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      ) : null}
    </EntityForm>
  )
}

/** What the panel shows before the form: what is missing, and the way to it when the actor may take it. */
function NewLeave() {
  const panel = usePanel()
  const access = useModuleAccess()
  const typePermissions = useLeaveTypePermissions()
  const today = useToday()
  const soldiers = useSoldiers()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const preferences = useMyPreferences()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)

  for (const loaded of [soldiers, types, groups, preferences]) {
    if (loaded.status === 'failed') return <FailureNotice error={loaded.error} />
  }
  if (soldiers.status !== 'ready' || types.status !== 'ready' || groups.status !== 'ready' || preferences.status !== 'ready' || today === null) {
    return <LoadingNotice />
  }

  const liveTypes = types.value.filter((type) => type.archived_at === null)
  if (liveTypes.length === 0) {
    return (
      <EmptyNotice titleKey="leaves.noTypesTitle" bodyKey={typePermissions.create ? 'leaves.noTypesBody' : 'leaves.noTypesReadOnly'}>
        {typePermissions.create && access.leaveTypes ? (
          <Button
            variant="primary"
            onPress={() => {
              panel.open(PANEL_IDS.leaveTypes, { entity: NEW_ENTITY })
            }}
          >
            <Tags aria-hidden size={14} />
            {t('leaves.openTypes')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }
  if (!creation.any) return <EmptyNotice titleKey="leaves.noSoldiersTitle" bodyKey="leaves.noSoldiersBody" />

  return (
    <NewLeaveForm
      soldiers={creation.soldiers}
      canApprove={creation.canApprove}
      groups={groups.value}
      types={liveTypes}
      today={today}
      approveNow={preferences.value.create_leaves_as_approved}
    />
  )
}

const NO_SOLDIERS: readonly never[] = []

/** The `leaves` panel: the new-leave form, or the details of the leave `entity` names (D-115, D-119). */
export function LeavesModule() {
  const panel = usePanel()
  if (panel.entity !== null && panel.entity !== NEW_ENTITY) return <LeaveDetails key={panel.entity} id={panel.entity} />
  return <NewLeave />
}
