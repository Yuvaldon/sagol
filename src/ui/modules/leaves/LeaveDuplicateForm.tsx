import type { Leave, Soldier, SoldierId } from '@contracts'
import { duplicateLeaveIssues, fullName, newDuplicateValues, useLeaveBatchCommands } from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, rowIssuesOnFields, validatorResult } from '../../patterns/forms'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { CheckList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'
import { SwitchField } from '../../primitives/SwitchField'
import { FieldMessage } from './LeaveBatchForm'

// A leave's copies (`leaves:duplicate`, D-049, D-179): the same type, reason and properties, for the soldiers chosen
// and the days given, all or none. "Approve now" is there only for who may approve every soldier chosen (D-013).

/** A copy answers on the form's own fields (OI-114). */
const ROW_FIELDS = { soldier_id: 'soldier_ids' } as const

const DUPLICATE_FIELDS: readonly string[] = ['soldier_ids', 'start_date', 'end_date']

export function LeaveDuplicateForm({
  leave,
  soldiers,
  canApprove,
  onDone,
}: {
  readonly leave: Leave
  /** Who a copy may be made for, by name. */
  readonly soldiers: readonly Soldier[]
  readonly canApprove: (soldierId: SoldierId) => boolean
  readonly onDone: () => void
}) {
  const { duplicate } = useLeaveBatchCommands()
  const gate = useRuleGate()
  const [state, setState] = useState(CLEAN_FORM)
  const approvesAll = (ids: readonly SoldierId[]) => ids.length > 0 && ids.every(canApprove)

  const form = useForm({
    defaultValues: newDuplicateValues(leave),
    validators: { onSubmit: ({ value }) => validatorResult(duplicateLeaveIssues(leave, value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const values = { ...value, as_approved: value.as_approved && approvesAll(value.soldier_ids) }
      await gate.run(
        (acknowledged) => duplicate.run({ source: leave, values, acknowledged }),
        (result) => {
          if (result.ok) onDone()
          else setState(formStateOf(rowIssuesOnFields(result.error, 'copies', ROW_FIELDS), DUPLICATE_FIELDS))
        },
      )
    },
  })
  const chosen = useStore(form.store, (current) => current.values.soldier_ids)
  const error = (errors: readonly unknown[], name: string) => fieldError(errors, name, state.answered)

  return (
    <EntityForm
      titleKey="leaves.duplicateTitle"
      submitKey="leaves.duplicateSubmit"
      isPending={duplicate.isPending}
      failure={state.failure}
      onCancel={onDone}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="soldier_ids">
        {(field) => (
          <div className="flex flex-col gap-xs">
            <CheckList
              label={{ key: 'leaves.duplicateSoldiers' }}
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
      {approvesAll(chosen) ? (
        <form.Field name="as_approved">
          {(field) => <SwitchField labelKey="leaves.approveNow" name={field.name} value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      ) : null}
      <RuleGateDialog gate={gate} isPending={duplicate.isPending} />
    </EntityForm>
  )
}
