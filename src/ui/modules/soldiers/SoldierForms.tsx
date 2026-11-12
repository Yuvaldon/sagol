import { PANEL_IDS } from '@config'
import type { CalendarDate, CommandRank, Soldier, SoldierPrivate, Unit, UnitId } from '@contracts'
import { SoldierStatus } from '@contracts'
import {
  newSoldierIssues,
  privateFormIssues,
  soldierFormIssues,
  usePanel,
  useSoldierCommands,
  type NewSoldierValues,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { rankOptions } from './rankOptions'
import { unitOptions } from './unitOptions'

// The forms of a soldier (D-094). A new soldier is one command, while an existing one has a form per
// permission and version.

const NO_SELECTION = 'none'
const NEW_FIELDS: readonly string[] = [
  'first_name',
  'last_name',
  'nickname',
  'command_rank_id',
  'membership.unit_id',
  'membership.valid_from',
  'private.personal_id',
  'private.invite_email',
  'private.phone',
]
const PROFILE_FIELDS: readonly string[] = ['first_name', 'last_name', 'nickname', 'command_rank_id', 'status']
const PRIVATE_FIELDS: readonly string[] = ['personal_id', 'invite_email', 'phone']

const STATUS_OPTIONS: readonly SelectOption<SoldierStatus>[] = [
  { key: SoldierStatus.enum.active, label: { key: 'soldiers.statusActive' }, value: SoldierStatus.enum.active },
  { key: SoldierStatus.enum.inactive, label: { key: 'soldiers.statusInactive' }, value: SoldierStatus.enum.inactive },
]

export function SoldierCreateForm({
  ranks,
  units,
  today,
  allowedUnit,
  allowNoUnit,
  allowPrivate,
}: {
  readonly ranks: readonly CommandRank[]
  readonly units: readonly Unit[]
  readonly today: CalendarDate | null
  readonly allowedUnit: (id: UnitId) => boolean
  readonly allowNoUnit: boolean
  readonly allowPrivate: (id: UnitId | null) => boolean
}) {
  const panel = usePanel()
  const { create } = useSoldierCommands()
  const [state, setState] = useState(CLEAN_FORM)
  const placements: SelectOption<UnitId | null>[] = [
    ...(allowNoUnit ? [{ key: NO_SELECTION, label: { key: 'soldiers.noUnit' as const }, value: null }] : []),
    ...unitOptions(units, allowedUnit),
  ]
  const backToList = () => {
    panel.open(PANEL_IDS.soldiers)
  }
  const initial: NewSoldierValues = {
    first_name: '',
    last_name: '',
    nickname: '',
    command_rank_id: null,
    membership: { unit_id: placements[0]?.value ?? null, valid_from: today ?? '' },
    private: { personal_id: '', invite_email: '', phone: '' },
  }

  const properties = usePropertyFields('soldier')
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: ({ value }) => validatorResult(newSoldierIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      // Private fields hidden by the placement are not sent: what the actor cannot see, they did not type (D-096).
      const values = allowPrivate(value.membership.unit_id) ? value : { ...value, private: initial.private }
      const result = await create.run({ ...values, ...properties.withProperties })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, [...NEW_FIELDS, ...properties.fieldNames]))
    },
  })

  return (
    <EntityForm
      titleKey="soldiers.newTitle"
      submitKey="common.create"
      isPending={create.isPending}
      failure={state.failure}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="first_name">
        {(field) => (
          <TextField
            labelKey="soldiers.firstName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="last_name">
        {(field) => (
          <TextField
            labelKey="soldiers.lastName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="nickname">
        {(field) => (
          <TextField
            labelKey="soldiers.nickname"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="command_rank_id">
        {(field) => (
          <SelectField
            labelKey="soldiers.rank"
            name={field.name}
            value={field.state.value}
            options={rankOptions(ranks, null)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="membership.unit_id">
        {(field) => (
          <SelectField
            labelKey="soldiers.unit"
            name={field.name}
            value={field.state.value}
            options={placements}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(current) => current.values.membership.unit_id}>
        {(unitId) => (
          <>
            {unitId === null ? null : (
              <form.Field name="membership.valid_from">
                {(field) => (
                  <DateField
                    labelKey="soldiers.placedFrom"
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    error={fieldError(field.state.meta.errors, field.name, state.answered)}
                  />
                )}
              </form.Field>
            )}
            {allowPrivate(unitId) ? (
              <>
                <form.Field name="private.personal_id">
                  {(field) => (
                    <TextField
                      labelKey="soldiers.personalId"
                      name={field.name}
                      inputMode="numeric"
                      dir="ltr"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      error={fieldError(field.state.meta.errors, field.name, state.answered)}
                    />
                  )}
                </form.Field>
                <form.Field name="private.invite_email">
                  {(field) => (
                    <TextField
                      labelKey="soldiers.inviteEmail"
                      name={field.name}
                      inputMode="email"
                      dir="ltr"
                      value={field.state.value ?? ''}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      error={fieldError(field.state.meta.errors, field.name, state.answered)}
                    />
                  )}
                </form.Field>
                <form.Field name="private.phone">
                  {(field) => (
                    <TextField
                      labelKey="soldiers.phone"
                      name={field.name}
                      inputMode="tel"
                      dir="ltr"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      error={fieldError(field.state.meta.errors, field.name, state.answered)}
                    />
                  )}
                </form.Field>
              </>
            ) : null}
          </>
        )}
      </form.Subscribe>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
    </EntityForm>
  )
}

/** The profile as it was when the form opened: its version goes with the save (D-012). */
function ProfileFields({
  soldier,
  ranks,
  onReload,
}: {
  readonly soldier: Soldier
  readonly ranks: readonly CommandRank[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { update } = useSoldierCommands()
  const [opened] = useState(soldier)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.soldiers)
  }

  const properties = usePropertyFields('soldier', opened.properties)
  const form = useForm({
    defaultValues: {
      first_name: opened.first_name,
      last_name: opened.last_name,
      nickname: opened.nickname ?? '',
      command_rank_id: opened.command_rank_id,
      status: opened.status,
    },
    validators: { onSubmit: ({ value }) => validatorResult(soldierFormIssues(opened.id, value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await update.run({ soldier: opened, openedVersion: opened.version, values: { ...value, ...properties.withProperties } })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, [...PROFILE_FIELDS, ...properties.fieldNames]))
    },
  })

  return (
    <EntityForm
      titleKey="soldiers.profileTitle"
      submitKey="common.save"
      isPending={update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="first_name">
        {(field) => (
          <TextField
            labelKey="soldiers.firstName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="last_name">
        {(field) => (
          <TextField
            labelKey="soldiers.lastName"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="nickname">
        {(field) => (
          <TextField
            labelKey="soldiers.nickname"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="command_rank_id">
        {(field) => (
          <SelectField
            labelKey="soldiers.rank"
            name={field.name}
            value={field.state.value}
            options={rankOptions(ranks, opened.command_rank_id)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="status">
        {(field) => (
          <SelectField
            labelKey="soldiers.status"
            name={field.name}
            value={field.state.value}
            options={STATUS_OPTIONS}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
    </EntityForm>
  )
}

export function SoldierProfileForm({ soldier, ranks }: { readonly soldier: Soldier; readonly ranks: readonly CommandRank[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <ProfileFields
      key={generation}
      soldier={soldier}
      ranks={ranks}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function PrivateFields({
  soldier,
  row,
  onReload,
}: {
  readonly soldier: Soldier
  readonly row: SoldierPrivate | null
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { updatePrivate } = useSoldierCommands()
  const [opened] = useState(row)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.soldiers)
  }

  const form = useForm({
    defaultValues: { personal_id: opened?.personal_id ?? '', invite_email: opened?.invite_email ?? '', phone: opened?.phone ?? '' },
    validators: { onSubmit: ({ value }) => validatorResult(privateFormIssues(soldier.id, value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await updatePrivate.run({ soldierId: soldier.id, opened, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, PRIVATE_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey="soldiers.privateTitle"
      submitKey="common.save"
      isPending={updatePrivate.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="personal_id">
        {(field) => (
          <TextField
            labelKey="soldiers.personalId"
            name={field.name}
            inputMode="numeric"
            dir="ltr"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="invite_email">
        {(field) => (
          <TextField
            labelKey="soldiers.inviteEmail"
            name={field.name}
            inputMode="email"
            dir="ltr"
            value={field.state.value ?? ''}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="phone">
        {(field) => (
          <TextField
            labelKey="soldiers.phone"
            name={field.name}
            inputMode="tel"
            dir="ltr"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
    </EntityForm>
  )
}

export function SoldierPrivateForm({ soldier, row }: { readonly soldier: Soldier; readonly row: SoldierPrivate | null }) {
  const [generation, setGeneration] = useState(0)
  return (
    <PrivateFields
      key={generation}
      soldier={soldier}
      row={row}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}
