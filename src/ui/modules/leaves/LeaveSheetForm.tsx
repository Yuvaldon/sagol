import type { CalendarDate, LeaveType, LeaveTypeGroup, LeaveTypeId, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  leaveSheetIssues,
  newLeaveSheetValues,
  newSheetRow,
  sheetCandidates,
  useCreateLeaves,
  usePanel,
  useRequestRotation,
  type NewLeaveDraft,
} from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { RuleGateDialog, RuleWarnings } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { Button, IconButton } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { ComboField, TextField } from '../../primitives/fields'
import { leaveTypeOptions } from './typeOptions'

// The request sheet (D-275): one soldier, then a row per request, each of its own type and days, and a row may repeat
// every so many days up to a date. Everything is sent at once, and every leave is on the board as soon as it is.
// "Approve now" is there only for who may approve that soldier, and starts from their own default (D-121).

const ROW_FIELDS: readonly string[] = ['leave_type_id', 'start_date', 'end_date', 'reason', 'every_days', 'until']

/** The dotted names the answer's issues land on: the soldier, and each row's fields. */
function sheetFields(rowCount: number): string[] {
  const rows = Array.from({ length: rowCount }, (_, row) => ROW_FIELDS.map((field) => `rows.${String(row)}.${field}`))
  return ['soldier_id', ...rows.flat()]
}

/** What the type field holds until a type is chosen. It leaves the list once one is. */
const CHOOSE_TYPE: SelectOption<LeaveTypeId | null> = { key: 'none', label: { key: 'leaves.chooseType' }, value: null }

export function LeaveSheetForm({
  soldiers,
  canApprove,
  groups,
  types,
  today,
  approveNow,
  draft,
}: {
  readonly soldiers: readonly Soldier[]
  readonly canApprove: (soldierId: SoldierId) => boolean
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
  readonly today: CalendarDate
  readonly approveNow: boolean
  /** The soldier and days a drag on the board marked (D-143). */
  readonly draft: NewLeaveDraft | null
}) {
  const panel = usePanel()
  const create = useCreateLeaves()
  const gate = useRuleGate()
  const rotationOf = useRequestRotation()
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId | null) => types.find((type) => type.id === id) ?? null

  const properties = usePropertyFields('leave')
  // Each row carries a key of its own, so the sheet's first values are made once, not on every render.
  const [defaultValues] = useState(() =>
    newLeaveSheetValues(today, approveNow, draft, soldiers.length === 1 ? (soldiers[0]?.id ?? null) : null),
  )
  const form = useForm({
    defaultValues,
    validators: { onSubmit: ({ value }) => validatorResult(leaveSheetIssues(value, typeOf, rotationOf)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      // Only who may approve the soldier sends "approve now"; the command checks again (D-013).
      const asApproved = value.as_approved && value.soldier_id !== null && canApprove(value.soldier_id)
      // A rule the command names opens the dialog, and acknowledging sends it again (D-047, D-142).
      await gate.run(
        (acknowledged) => create.run({ ...value, as_approved: asApproved, ...properties.withProperties }, rotationOf, acknowledged),
        (result) => {
          if (result.ok) panel.close()
          else setState(formStateOf(result.error, [...sheetFields(value.rows.length), ...properties.fieldNames]))
        },
      )
    },
  })
  const values = useStore(form.store, (current) => current.values)
  const approving = values.as_approved && values.soldier_id !== null && canApprove(values.soldier_id)
  // While the leaves are sent they are already on the board; judging the sheet too would count them twice.
  const candidates = useMemo(
    () => (create.isPending ? [] : sheetCandidates({ ...values, as_approved: approving })),
    [create.isPending, values, approving],
  )
  const error = (errors: readonly unknown[], row: number, field: string) => fieldError(errors, `rows.${String(row)}.${field}`, state.answered)

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
      <form.Field name="rows" mode="array">
        {(rowsField) => (
          <>
            {rowsField.state.value.map((row, index) => {
              const title = `${t('leaves.row')} ${String(index + 1)}`
              const reasonRequired = typeOf(row.leave_type_id)?.requires_reason === true
              return (
                <div key={row.key} role="group" aria-label={title} className="flex flex-col gap-md rounded-control border border-line p-md">
                  <div className="flex items-center justify-between gap-sm">
                    <p className="text-name font-semibold">{title}</p>
                    {rowsField.state.value.length > 1 ? (
                      <IconButton
                        labelKey="leaves.removeRow"
                        onPress={() => {
                          // The answer named rows by their place; once one goes, it names the wrong ones.
                          setState(CLEAN_FORM)
                          void rowsField.removeValue(index)
                        }}
                      >
                        <X aria-hidden size={14} />
                      </IconButton>
                    ) : null}
                  </div>
                  <form.Field name={`rows[${index}].leave_type_id`}>
                    {(field) => (
                      <SelectField
                        labelKey="leaves.type"
                        name={field.name}
                        value={field.state.value}
                        options={field.state.value === null ? [CHOOSE_TYPE, ...leaveTypeOptions(groups, types)] : leaveTypeOptions(groups, types)}
                        onChange={field.handleChange}
                        error={error(field.state.meta.errors, index, 'leave_type_id')}
                      />
                    )}
                  </form.Field>
                  <div className="grid grid-cols-2 gap-md">
                    <form.Field name={`rows[${index}].start_date`}>
                      {(field) => (
                        <DateField
                          labelKey="leaves.from"
                          name={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                          error={error(field.state.meta.errors, index, 'start_date')}
                        />
                      )}
                    </form.Field>
                    <form.Field name={`rows[${index}].end_date`}>
                      {(field) => (
                        <DateField
                          labelKey="leaves.to"
                          name={field.name}
                          value={field.state.value}
                          onChange={field.handleChange}
                          error={error(field.state.meta.errors, index, 'end_date')}
                        />
                      )}
                    </form.Field>
                  </div>
                  <form.Field name={`rows[${index}].reason`}>
                    {(field) => (
                      <TextField
                        labelKey={reasonRequired ? 'leaves.reasonRequired' : 'leaves.reason'}
                        name={field.name}
                        isRequired={reasonRequired}
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        error={error(field.state.meta.errors, index, 'reason')}
                      />
                    )}
                  </form.Field>
                  <form.Field name={`rows[${index}].repeats`}>
                    {(field) => <SwitchField labelKey="leaves.repeats" name={field.name} value={field.state.value} onChange={field.handleChange} />}
                  </form.Field>
                  {row.repeats ? (
                    <div className="grid grid-cols-2 gap-md">
                      <form.Field name={`rows[${index}].every_days`}>
                        {(field) => (
                          <TextField
                            labelKey="leaves.everyDays"
                            name={field.name}
                            inputMode="numeric"
                            dir="ltr"
                            isRequired
                            value={field.state.value}
                            onChange={field.handleChange}
                            onBlur={field.handleBlur}
                            error={error(field.state.meta.errors, index, 'every_days')}
                          />
                        )}
                      </form.Field>
                      <form.Field name={`rows[${index}].until`}>
                        {(field) => (
                          <DateField
                            labelKey="leaves.repeatUntil"
                            name={field.name}
                            value={field.state.value}
                            onChange={field.handleChange}
                            error={error(field.state.meta.errors, index, 'until')}
                          />
                        )}
                      </form.Field>
                    </div>
                  ) : null}
                </div>
              )
            })}
            <Button
              onPress={() => {
                rowsField.pushValue(newSheetRow(today))
              }}
            >
              <Plus aria-hidden size={14} />
              {t('leaves.addRow')}
            </Button>
          </>
        )}
      </form.Field>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
      {values.soldier_id !== null && canApprove(values.soldier_id) ? (
        <form.Field name="as_approved">
          {(field) => <SwitchField labelKey="leaves.approveNow" name={field.name} value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      ) : null}
      <RuleWarnings candidate={candidates} />
      <RuleGateDialog gate={gate} isPending={create.isPending} />
    </EntityForm>
  )
}
