import { PANEL_IDS } from '@config'
import type { Unit, UnitId, UnitLevel, UnitLevelId } from '@contracts'
import { liveLevels, unitFormIssues, unitTreeRows, usePanel, useUnitCommands, type UnitFormValues } from '@logic'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { usePropertyFields } from '../../patterns/properties/usePropertyFields'
import { ColorField } from '../../primitives/ColorField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { UnitLevelInPlace } from '../unit-levels/UnitLevelsModule'

// The fields on screen are name, level and color (D-092).

const NO_SELECTION = 'none'
const UNIT_FIELDS: readonly string[] = ['name', 'unit_level_id', 'color_key', 'parent_id']

interface CreateValues extends UnitFormValues {
  readonly parent_id: UnitId | null
}

function levelOptions(levels: readonly UnitLevel[], current: UnitLevelId | null): SelectOption<UnitLevelId | null>[] {
  // A level that was archived stays selectable only on the unit that already has it (D-088).
  const offered = levels.filter((level) => level.archived_at === null || level.id === current)
  return [
    { key: NO_SELECTION, label: { key: 'units.levelNone' }, value: null },
    ...offered.map((level) => ({ key: level.id, label: { text: level.name }, value: level.id })),
  ]
}

function parentOptions(units: readonly Unit[], allowed: (id: UnitId | null) => boolean): SelectOption<UnitId | null>[] {
  const top: SelectOption<UnitId | null>[] = allowed(null)
    ? [{ key: NO_SELECTION, label: { key: 'units.parentTop' }, value: null }]
    : []
  return [
    ...top,
    ...unitTreeRows(units)
      .filter((row) => allowed(row.unit.id))
      .map((row) => ({ key: row.unit.id, label: { text: row.unit.name }, value: row.unit.id, depth: row.depth })),
  ]
}




export function UnitCreateForm({
  units,
  levels,
  parentId,
  allowedParent,
}: {
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly parentId: UnitId | null
  readonly allowedParent: (id: UnitId | null) => boolean
}) {
  const panel = usePanel()
  const { create } = useUnitCommands()
  const [state, setState] = useState(CLEAN_FORM)
  const initialValues: CreateValues = { name: '', unit_level_id: null, color_key: null, parent_id: parentId }
  const backToList = () => {
    panel.open(PANEL_IDS.units)
  }

  const properties = usePropertyFields('unit')
  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: ({ value }) => validatorResult(unitFormIssues(toValues(value))) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await create.run({ values: { ...toValues(value), ...properties.withProperties }, parentId: value.parent_id, siblings: units })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, [...UNIT_FIELDS, ...properties.fieldNames]))
    },
  })

  return (
    <EntityForm
      titleKey="units.newTitle"
      submitKey="common.create"
      isPending={create.isPending}
      failure={state.failure}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="units.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="parent_id">
        {(field) => (
          <SelectField
            labelKey="units.parent"
            name={field.name}
            value={field.state.value}
            options={parentOptions(units, allowedParent)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="unit_level_id">
        {(field) => (
          <>
            <SelectField
              labelKey="units.level"
              name={field.name}
              value={field.state.value}
              options={levelOptions(levels, null)}
              onChange={field.handleChange}
              error={fieldError(field.state.meta.errors, field.name, state.answered)}
            />
            <UnitLevelInPlace
              isMissing={liveLevels(levels).length === 0}
              onCreated={(level) => {
                field.handleChange(level.id)
              }}
            />
          </>
        )}
      </form.Field>
      <form.Field name="color_key">
        {(field) => (
          <ColorField
            labelKey="palette.label"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
    </EntityForm>
  )
}

function toValues({ name, unit_level_id, color_key }: UnitFormValues): UnitFormValues {
  return { name, unit_level_id, color_key }
}

/**
 * Edits the row as it was when the form opened: its version goes with the save, so a change from
 * another tab answers `stale_version` instead of being overwritten (D-012).
 */
function UnitEditFields({
  unit,
  levels,
  onReload,
}: {
  readonly unit: Unit
  readonly levels: readonly UnitLevel[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { update } = useUnitCommands()
  const [opened] = useState(unit)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.units)
  }

  const properties = usePropertyFields('unit', opened.properties)
  const form = useForm({
    defaultValues: { name: opened.name, unit_level_id: opened.unit_level_id, color_key: opened.color_key },
    validators: { onSubmit: ({ value }) => validatorResult(unitFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await update.run({ unit: opened, openedVersion: opened.version, values: { ...value, ...properties.withProperties } })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, [...UNIT_FIELDS, ...properties.fieldNames]))
    },
  })

  return (
    <EntityForm
      titleKey="units.editTitle"
      submitKey="common.save"
      isPending={update.isPending}
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
            labelKey="units.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="unit_level_id">
        {(field) => (
          <>
            <SelectField
              labelKey="units.level"
              name={field.name}
              value={field.state.value}
              options={levelOptions(levels, opened.unit_level_id)}
              onChange={field.handleChange}
              error={fieldError(field.state.meta.errors, field.name, state.answered)}
            />
            <UnitLevelInPlace
              isMissing={liveLevels(levels).length === 0}
              onCreated={(level) => {
                field.handleChange(level.id)
              }}
            />
          </>
        )}
      </form.Field>
      <form.Field name="color_key">
        {(field) => (
          <ColorField
            labelKey="palette.label"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <PropertyFields fields={properties} errorOf={(name) => issueError([], state.answered, name)} />
    </EntityForm>
  )
}

export function UnitEditForm({ unit, levels }: { readonly unit: Unit; readonly levels: readonly UnitLevel[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <UnitEditFields
      key={generation}
      unit={unit}
      levels={levels}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

