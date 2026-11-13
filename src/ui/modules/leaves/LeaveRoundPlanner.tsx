import type { CalendarDate, Deployment, DeploymentId, LeaveType, LeaveTypeGroup, LeaveTypeId, Soldier, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  groupRounds,
  isRotationLeave,
  leaveRoundIssues,
  newLeaveRoundValues,
  newRoundGroup,
  nextFirstHome,
  plannedRounds,
  rotationSoldiers,
  useCreateLeaveRounds,
  usePanel,
  type RoundContext,
} from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateRange } from '../../patterns/dates'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { Button, IconButton } from '../../primitives/Button'
import { CheckList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { TextField } from '../../primitives/fields'
import { LeaveTypeInPlace } from '../leave-types/LeaveTypesModule'
import { FieldMessage } from './LeaveBatchForm'
import { leaveTypeOptions } from './typeOptions'

// The leave-round planner (D-270, D-316): inside one rotation, groups of soldiers go home on one rhythm, each group
// from its own first day home, so the groups take turns. The plan is sent as one collective leave (D-179): every
// round of every soldier, or none. Each group shows its rounds before anything is sent.

const PLAN_FIELDS: readonly string[] = ['name', 'description', 'deployment_id', 'start_date', 'end_date', 'days_in', 'days_home', 'leave_type_id', 'reason', 'groups']
const GROUP_FIELDS: readonly string[] = ['soldier_ids', 'first_home']

/** The dotted names the answer's issues land on: the plan's, and each group's. */
function planFields(groupCount: number): string[] {
  const groups = Array.from({ length: groupCount }, (_, group) => GROUP_FIELDS.map((field) => `groups.${String(group)}.${field}`))
  return [...PLAN_FIELDS, ...groups.flat()]
}

const CHOOSE_TYPE: SelectOption<LeaveTypeId | null> = { key: 'none', label: { key: 'leaves.chooseType' }, value: null }
const WORD = ' '
const LIST = ' · '

export function LeaveRoundPlanner({
  soldiers,
  canApprove,
  groups,
  types,
  today,
  approveNow,
  context,
  preferred,
}: {
  readonly soldiers: readonly Soldier[]
  readonly canApprove: (soldierId: SoldierId) => boolean
  readonly groups: readonly LeaveTypeGroup[]
  readonly types: readonly LeaveType[]
  readonly today: CalendarDate
  readonly approveNow: boolean
  readonly context: RoundContext
  /** The rotation the plan starts in. */
  readonly preferred: Deployment
}) {
  const panel = usePanel()
  const create = useCreateLeaveRounds()
  const gate = useRuleGate()
  const [state, setState] = useState(CLEAN_FORM)
  const typeOf = (id: LeaveTypeId | null) => types.find((type) => type.id === id) ?? null
  const approvesAll = (ids: readonly SoldierId[]) => ids.length > 0 && ids.every(canApprove)

  const properties = usePropertyFields('leave')
  // Each group carries a key of its own, so the plan's first values are made once, not on every render.
  const [defaultValues] = useState(() => newLeaveRoundValues(today, preferred, approveNow))
  const form = useForm({
    defaultValues,
    validators: { onSubmit: ({ value }) => validatorResult(leaveRoundIssues(value, typeOf(value.leave_type_id), context)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const planned = value.groups.flatMap((group) => group.soldier_ids)
      // Only who may approve every soldier planned sends "approve now"; the command checks again (D-013).
      const values = { ...value, as_approved: value.as_approved && approvesAll(planned), ...properties.withProperties }
      // A rule the command names opens the dialog, and acknowledging sends the plan again (D-047, D-142).
      await gate.run(
        (acknowledged) => create.run({ values, context, acknowledged }),
        (result) => {
          if (result.ok) panel.close()
          else setState(formStateOf(result.error, [...planFields(value.groups.length), ...properties.fieldNames]))
        },
      )
    },
  })
  const values = useStore(form.store, (current) => current.values)
  const rotation = context.rotations.find((candidate) => candidate.id === values.deployment_id) ?? null
  const offered = useMemo(() => {
    const serving = new Set(rotationSoldiers(rotation, context.members, soldiers.map((soldier) => soldier.id)))
    return soldiers.filter((soldier) => serving.has(soldier.id))
  }, [rotation, context.members, soldiers])
  const planned = values.groups.flatMap((group) => group.soldier_ids)
  const count = useMemo(() => plannedRounds(values, context).length, [values, context])
  const reasonRequired = typeOf(values.leave_type_id)?.requires_reason === true
  const asksReason = !isRotationLeave(typeOf(values.leave_type_id), groups)
  const error = (errors: readonly unknown[], name: string) => fieldError(errors, name, state.answered)
  const rotationOptions: SelectOption<DeploymentId | null>[] = context.rotations.map((candidate) => ({
    key: candidate.id,
    label: { text: candidate.name },
    value: candidate.id,
  }))

  return (
    <EntityForm
      titleKey="leaves.roundsTitle"
      submitKey="leaves.roundsSubmit"
      isPending={create.isPending}
      failure={state.failure}
      onCancel={panel.close}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="leaves.roundsName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <form.Field name="deployment_id">
        {(field) => (
          <SelectField
            labelKey="leaves.roundsRotation"
            name={field.name}
            value={field.state.value}
            options={rotationOptions}
            onChange={(id) => {
              // Another rotation has other days and other soldiers: the plan starts over inside it.
              const next = newLeaveRoundValues(today, context.rotations.find((candidate) => candidate.id === id) ?? null)
              setState(CLEAN_FORM)
              field.handleChange(id)
              form.setFieldValue('start_date', next.start_date)
              form.setFieldValue('end_date', next.end_date)
              form.setFieldValue('groups', next.groups)
            }}
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
        <form.Field name="days_in">
          {(field) => (
            <TextField
              labelKey="leaves.daysIn"
              name={field.name}
              inputMode="numeric"
              dir="ltr"
              isRequired
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
        <form.Field name="days_home">
          {(field) => (
            <TextField
              labelKey="leaves.daysHome"
              name={field.name}
              inputMode="numeric"
              dir="ltr"
              isRequired
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      </div>
      <form.Field name="groups" mode="array">
        {(groupsField) => (
          <>
            {groupsField.state.value.map((group, index) => {
              const title = `${t('leaves.roundsGroup')}${WORD}${String(index + 1)}`
              // A soldier goes home with one group: those another group has are not offered here.
              const elsewhere = new Set(groupsField.state.value.flatMap((other, at) => (at === index ? [] : other.soldier_ids)))
              const choices = offered.filter((soldier) => !elsewhere.has(soldier.id) || group.soldier_ids.includes(soldier.id))
              const rounds = groupRounds(values, group)
              return (
                <div key={group.key} role="group" aria-label={title} className="flex flex-col gap-md rounded-control border border-line p-md">
                  <div className="flex items-center justify-between gap-sm">
                    <p className="text-name font-semibold">{title}</p>
                    {groupsField.state.value.length > 1 ? (
                      <IconButton
                        labelKey="leaves.removeGroup"
                        onPress={() => {
                          // The answer named groups by their place; once one goes, it names the wrong ones.
                          setState(CLEAN_FORM)
                          groupsField.removeValue(index)
                          if (form.state.submissionAttempts > 0) void form.validate('submit')
                        }}
                      >
                        <X aria-hidden size={14} />
                      </IconButton>
                    ) : null}
                  </div>
                  <form.Field name={`groups[${index}].soldier_ids`}>
                    {(field) => (
                      <div className="flex flex-col gap-xs">
                        <CheckList
                          label={{ key: 'leaves.roundsGroupSoldiers' }}
                          choices={choices.map((soldier) => ({ key: soldier.id, label: { text: fullName(soldier) } }))}
                          selected={field.state.value}
                          onChange={(keys) => {
                            field.handleChange(choices.filter((soldier) => keys.includes(soldier.id)).map((soldier) => soldier.id))
                          }}
                        />
                        <FieldMessage errorKey={error(field.state.meta.errors, `groups.${String(index)}.soldier_ids`)} />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name={`groups[${index}].first_home`}>
                    {(field) => (
                      <DateField
                        labelKey="leaves.firstHome"
                        name={field.name}
                        value={field.state.value}
                        onChange={field.handleChange}
                        error={error(field.state.meta.errors, `groups.${String(index)}.first_home`)}
                      />
                    )}
                  </form.Field>
                  <p className="text-label text-text-muted">
                    {rounds.length === 0
                      ? t('leaves.roundsNone')
                      : rounds.map((round) => formatDateRange(round.start_date, round.end_date)).join(LIST)}
                  </p>
                </div>
              )
            })}
            <FieldMessage errorKey={error([], 'groups')} />
            <Button
              onPress={() => {
                groupsField.pushValue(newRoundGroup(nextFirstHome(form.state.values)))
              }}
            >
              <Plus aria-hidden size={14} />
              {t('leaves.addGroup')}
            </Button>
          </>
        )}
      </form.Field>
      <p className="text-label text-text-muted">{[t('leaves.roundsCount'), String(count)].join(WORD)}</p>
      <form.Field
        name="leave_type_id"
        listeners={{
          // A rotation leave asks no reason (D-347): one typed before the type changed is not sent with it.
          onChange: ({ value }) => {
            if (isRotationLeave(typeOf(value), groups)) form.setFieldValue('reason', '')
          },
        }}
      >
        {(field) => (
          <>
            <SelectField
              labelKey="leaves.type"
              name={field.name}
              value={field.state.value}
              options={field.state.value === null ? [CHOOSE_TYPE, ...leaveTypeOptions(groups, types)] : leaveTypeOptions(groups, types)}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
            <LeaveTypeInPlace
              isMissing={leaveTypeOptions(groups, types).length === 0}
              onCreated={(type) => {
                field.handleChange(type.id)
              }}
            />
          </>
        )}
      </form.Field>
      {asksReason ? (
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
      ) : null}
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
      {approvesAll(planned) ? (
        <form.Field name="as_approved">
          {(field) => <SwitchField labelKey="leaves.approveNow" name={field.name} value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
      ) : null}
      <RuleGateDialog gate={gate} isPending={create.isPending} />
    </EntityForm>
  )
}
