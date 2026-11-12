import { PANEL_IDS } from '@config'
import type { CalendarDate, Deployment, Unit, UnitId } from '@contracts'
import { deploymentFormIssues, deploymentFormValues, newDeploymentValues, useDeploymentCommands, usePanel } from '@logic'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { DateField } from '../../primitives/DateField'
import { SelectField } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { unitOptions } from '../soldiers/unitOptions'

// A deployment (D-019, D-179): its name, its unit and its days. An open end runs until it is given one.

const DEPLOYMENT_FIELDS: readonly string[] = ['name', 'unit_id', 'start_date', 'end_date']

export interface DeploymentFormProps {
  readonly deployment: Deployment | null
  readonly units: readonly Unit[]
  readonly today: CalendarDate
  /** Where the deployment may be placed. */
  readonly placeable: (unitId: UnitId) => boolean
  readonly onReload: () => void
  /** A new rotation goes on to who serves in it (D-219); without this the form goes back to the list. */
  readonly onCreated?: (deployment: Deployment) => void
}

export function DeploymentForm({ deployment, units, today, placeable, onReload, onCreated }: DeploymentFormProps) {
  const panel = usePanel()
  const { create, update } = useDeploymentCommands()
  const [opened] = useState(deployment)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.deployments)
  }
  // The unit the deployment has stays a choice, so an edit never moves it by itself.
  const options = unitOptions(
    units.filter((unit) => unit.archived_at === null),
    (id) => placeable(id) || opened?.unit_id === id,
  )

  const form = useForm({
    defaultValues: opened === null ? newDeploymentValues(today, options[0]?.value ?? null) : deploymentFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(deploymentFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      if (opened === null) {
        const created = await create.run(value)
        if (!created.ok) setState(formStateOf(created.error, DEPLOYMENT_FIELDS))
        else if (onCreated === undefined) backToList()
        else onCreated(created.value)
        return
      }
      const result = await update.run({ deployment: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, DEPLOYMENT_FIELDS))
    },
  })
  const error = (errors: readonly unknown[], name: string) => fieldError(errors, name, state.answered)

  return (
    <EntityForm
      titleKey={opened === null ? 'deployments.newTitle' : 'deployments.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="deployments.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <form.Field name="unit_id">
        {(field) => (
          <SelectField
            labelKey="deployments.unit"
            name={field.name}
            value={field.state.value}
            options={options}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-md">
        <form.Field name="start_date">
          {(field) => (
            <DateField
              labelKey="deployments.from"
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
              labelKey="deployments.to"
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      </div>
    </EntityForm>
  )
}
