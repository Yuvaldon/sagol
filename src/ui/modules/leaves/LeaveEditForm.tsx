import type { Leave, LeaveType, LeaveTypeGroup, LeaveTypeId } from '@contracts'
import { t } from '@i18n'
import { editedLeaveCandidate, leaveEditIssues, leaveEditValues, useEditLeave, useLeaveActions } from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { useMemo, useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { DateField } from '../../primitives/DateField'
import { SelectField } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { RuleGateDialog, RuleWarnings } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { leaveTypeOptions } from './typeOptions'

// The one edit form of a leave (D-119): its type, its days and its reason. It holds the leave as it was when
// opened and saves at that version. Before it is sent it says when an approved leave will wait for approval again.

/** What the command's answers are placed on: it names the fields under `changes` (D-123). */
const EDIT_FIELDS: readonly string[] = ['leave_type_id', 'start_date', 'end_date', 'reason']

/** The form's own name of a field the command names under `changes`. */
const formPath = (path: readonly (string | number)[]) => path.filter((part) => part !== 'changes')

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
  const gate = useRuleGate()
  const actions = useLeaveActions(opened)
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId) => types.find((type) => type.id === id) ?? null

  const properties = usePropertyFields('leave', opened.properties)
  const form = useForm({
    defaultValues: leaveEditValues(opened),
    validators: {
      onSubmit: ({ value }) =>
        validatorResult(leaveEditIssues(opened, value, typeOf(value.leave_type_id)).map((issue) => ({ ...issue, path: formPath(issue.path) }))),
    },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      await gate.run(
        (acknowledged) => edit.run(opened, { ...value, ...properties.withProperties }, acknowledged),
        (result) => {
          if (result.ok) {
            onDone()
            return
          }
          const error =
            result.error.code === 'validation_failed'
              ? { ...result.error, issues: result.error.issues.map((issue) => ({ ...issue, path: formPath(issue.path) })) }
              : result.error
          setState(formStateOf(error, [...EDIT_FIELDS, ...properties.fieldNames]))
        },
      )
    },
  })
  const values = useStore(form.store, (current) => current.values)
  const reasonRequired = typeOf(values.leave_type_id)?.requires_reason === true
  const returnsToPending = actions.returnsToPending(values)
  // While the edit is sent, the board already moves; judging the form too would count the leave twice.
  const candidate = useMemo(
    () => (edit.isPending ? null : editedLeaveCandidate(opened, values, returnsToPending)),
    [edit.isPending, opened, values, returnsToPending],
  )

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
            options={leaveTypeOptions(groups, types, opened.leave_type_id)}
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
      {returnsToPending ? (
        <p role="status" className="rounded-control border border-dashed border-status-pending p-md text-name text-status-pending-text">
          {t('leaves.returnsToPending')}
        </p>
      ) : null}
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
      <RuleWarnings candidate={candidate} stored={opened} />
      <RuleGateDialog gate={gate} isPending={edit.isPending} />
    </EntityForm>
  )
}
