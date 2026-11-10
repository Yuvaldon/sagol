import type { Leave, LeaveType, LeaveTypeGroup, LeaveTypeId } from '@contracts'
import { t } from '@i18n'
import { leaveEditIssues, leaveEditValues, orderedLeaveTypes, useEditLeave, useLeaveActions } from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'

// The one edit form of a leave (D-119): its type, its days and its reason. It holds the leave as it was when
// opened and saves at that version. Before it is sent it says when an approved leave will wait for approval again.

/** What the adapter's answers are placed on: `update` answers under `changes`, `reschedule` at the root. */
const EDIT_FIELDS: readonly string[] = ['leave_type_id', 'start_date', 'end_date', 'reason']

/** Live types in their order, and the leave's own type first when it is archived: the leave keeps it (D-113). */
function typeOptions(leave: Leave, groups: readonly LeaveTypeGroup[], types: readonly LeaveType[]): SelectOption<LeaveTypeId>[] {
  const groupName = new Map(groups.map((group) => [group.id, group.name]))
  const live = orderedLeaveTypes(groups, types)
  const own = types.find((type) => type.id === leave.leave_type_id)
  const listed = own === undefined || live.some((type) => type.id === own.id) ? live : [own, ...live]
  return listed.map((type) => {
    const group = type.group_id === null ? undefined : groupName.get(type.group_id)
    return { key: type.id, label: { text: group === undefined ? type.name : `${group} · ${type.name}` }, value: type.id }
  })
}

export function LeaveEditForm({
  leave,
  groups,
  types,
  onDone,
  onReload,
}: {
  readonly leave: Leave
  readonly groups: readonly LeaveTypeGroup[]
  /** Archived ones too. */
  readonly types: readonly LeaveType[]
  readonly onDone: () => void
  /** Opens the form again on the stored leave, after someone else changed it. */
  readonly onReload: () => void
}) {
  // What was opened: a change from another tab never replaces what is being typed.
  const [opened] = useState(leave)
  const edit = useEditLeave()
  const actions = useLeaveActions(opened)
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId) => types.find((type) => type.id === id) ?? null

  const form = useForm({
    defaultValues: leaveEditValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(leaveEditIssues(opened, value, typeOf(value.leave_type_id))) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await edit.run(opened, value)
      if (result.ok) {
        onDone()
        return
      }
      // `update` names its fields under `changes`; here they are the form's own.
      const error =
        result.error.code === 'validation_failed'
          ? { ...result.error, issues: result.error.issues.map((issue) => ({ ...issue, path: issue.path.filter((part) => part !== 'changes') })) }
          : result.error
      setState(formStateOf(error, EDIT_FIELDS))
    },
  })
  const values = useStore(form.store, (current) => current.values)
  const reasonRequired = typeOf(values.leave_type_id)?.requires_reason === true

  return (
    <EntityForm
      titleKey="leaves.editTitle"
      submitKey="common.save"
      isPending={edit.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={onDone}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="leave_type_id">
        {(field) => (
          <SelectField
            labelKey="leaves.type"
            name={field.name}
            value={field.state.value}
            options={typeOptions(opened, groups, types)}
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
      {actions.returnsToPending(values) ? (
        <p role="status" className="rounded-control border border-dashed border-status-pending p-md text-name text-status-pending-text">
          {t('leaves.returnsToPending')}
        </p>
      ) : null}
    </EntityForm>
  )
}
