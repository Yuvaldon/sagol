import type { CalendarDate, LeaveType, LeaveTypeGroup, LeaveTypeId, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import { fullName, leaveBatchIssues, newLeaveBatchValues, useLeaveBatchCommands, usePanel, useRequestRotation } from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, rowIssuesOnFields, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { CheckList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { TextField } from '../../primitives/fields'
import { leaveTypeOptions } from './typeOptions'

// A collective leave (D-012, D-179): one name, one type and the same days for every soldier chosen, created together
// or not at all. "Approve now" is there only for who may approve every soldier chosen (D-013).

/** A leave of the batch answers on the batch's own fields (OI-114). */
const ROW_FIELDS = { soldier_id: 'soldier_ids' } as const

const BATCH_FIELDS: readonly string[] = ['name', 'description', 'soldier_ids', 'leave_type_id', 'start_date', 'end_date', 'reason']

const CHOOSE_TYPE: SelectOption<LeaveTypeId | null> = { key: 'none', label: { key: 'leaves.chooseType' }, value: null }

export function LeaveBatchForm({
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
  const { createBatch } = useLeaveBatchCommands()
  const gate = useRuleGate()
  const rotationOf = useRequestRotation()
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId | null) => types.find((type) => type.id === id) ?? null
  const approvesAll = (ids: readonly SoldierId[]) => ids.length > 0 && ids.every(canApprove)

  const properties = usePropertyFields('leave')
  const form = useForm({
    defaultValues: { ...newLeaveBatchValues(today), as_approved: approveNow },
    validators: { onSubmit: ({ value }) => validatorResult(leaveBatchIssues(value, typeOf(value.leave_type_id), rotationOf(value.soldier_ids, value))) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const values = { ...value, as_approved: value.as_approved && approvesAll(value.soldier_ids), ...properties.withProperties }
      // A rule the command names opens the dialog, and acknowledging sends the batch again (D-047, D-142).
      await gate.run(
        (acknowledged) => createBatch.run({ values, deploymentId: rotationOf(values.soldier_ids, values).deployment_id, acknowledged }),
        (result) => {
          if (result.ok) panel.close()
          else setState(formStateOf(rowIssuesOnFields(result.error, 'leaves', ROW_FIELDS), [...BATCH_FIELDS, ...properties.fieldNames]))
        },
      )
    },
  })
  const typeId = useStore(form.store, (current) => current.values.leave_type_id)
  const chosen = useStore(form.store, (current) => current.values.soldier_ids)
  const reasonRequired = typeOf(typeId)?.requires_reason === true
  const error = (errors: readonly unknown[], name: string) => fieldError(errors, name, state.answered)

  return (
    <EntityForm
      titleKey="leaves.batchTitle"
      submitKey="leaves.batchSubmit"
      isPending={createBatch.isPending}
      failure={state.failure}
      onCancel={panel.close}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="leaves.batchName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <form.Field name="soldier_ids">
        {(field) => (
          <div className="flex flex-col gap-xs">
            <CheckList
              label={{ key: 'leaves.batchSoldiers' }}
              choices={soldiers.map((soldier) => ({ key: soldier.id, label: { text: fullName(soldier) } }))}
              selected={field.state.value}
              onChange={(keys) => {
                field.handleChange(soldiers.filter((soldier) => keys.includes(soldier.id)).map((soldier) => soldier.id))
              }}
            />
            <FieldMessage errorKey={error(field.state.meta.errors, field.name)} />
          </div>
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
            error={error(field.state.meta.errors, field.name)}
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
              error={error(field.state.meta.errors, field.name)}
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
              error={error(field.state.meta.errors, field.name)}
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
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
      <form.Field name="description">
        {(field) => (
          <TextAreaField
            labelKey="leaves.batchDescription"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      {approvesAll(chosen) ? (
        <form.Field name="as_approved">
          {(field) => <SwitchField labelKey="leaves.approveNow" name={field.name} value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      ) : null}
      <RuleGateDialog gate={gate} isPending={createBatch.isPending} />
    </EntityForm>
  )
}

/** A list's error, under it: the list has no field of its own to carry one. */
export function FieldMessage({ errorKey }: { readonly errorKey: ReturnType<typeof fieldError> }) {
  if (errorKey === null) return null
  return (
    <p role="alert" className="text-label text-status-rejected">
      {t(errorKey)}
    </p>
  )
}
