import type { PropertyDefinition } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, optionsOf, unitTreeRows, useSoldiers, useUnits, type PropertyFieldValue } from '@logic'
import { CheckList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { ComboField, TextField } from '../../primitives/fields'
import { toneOf } from '../../theme/palette'
import { propertyFieldName, type PropertyFields as Fields } from './usePropertyFields'

// The inputs of an entity's custom properties (D-016), one per live definition, each by its data type. A field's
// label is the definition's own.

const NONE_KEY = 'none'
const NONE_OPTION: SelectOption<string> = { key: NONE_KEY, label: { key: 'properties.none' }, value: '' }

const BOOLEAN_OPTIONS: readonly SelectOption<string>[] = [
  NONE_OPTION,
  { key: 'true', label: { key: 'properties.yes' }, value: 'true' },
  { key: 'false', label: { key: 'properties.no' }, value: 'false' },
]

interface InputProps {
  readonly definition: PropertyDefinition
  readonly value: PropertyFieldValue
  readonly onChange: (value: PropertyFieldValue) => void
  readonly error: I18nKey | null
}

const textOf = (value: PropertyFieldValue) => (typeof value === 'string' ? value : '')

function SoldierInput({ definition, value, onChange, error }: InputProps) {
  const soldiers = useSoldiers()
  const options = soldiers.status === 'ready' ? soldiers.value.map((soldier) => ({ key: soldier.id, label: fullName(soldier) })) : []
  const current = textOf(value)
  return (
    <ComboField
      labelKey={{ text: definition.label }}
      toggleLabelKey="properties.chooseSoldier"
      name={propertyFieldName(definition)}
      value={current === '' ? null : current}
      options={options}
      onChange={(next) => {
        onChange(next ?? '')
      }}
      error={error}
    />
  )
}

function UnitInput({ definition, value, onChange, error }: InputProps) {
  const units = useUnits()
  const rows = units.status === 'ready' ? unitTreeRows(units.value) : []
  const options: SelectOption<string>[] = [
    NONE_OPTION,
    ...rows.map((row) => ({ key: row.unit.id, label: { text: row.unit.name }, value: row.unit.id, depth: row.depth })),
  ]
  return (
    <SelectField
      labelKey={{ text: definition.label }}
      name={propertyFieldName(definition)}
      value={textOf(value)}
      options={options}
      onChange={onChange}
      error={error}
    />
  )
}

function PropertyInput(props: InputProps) {
  const { definition, value, onChange, error } = props
  const labelKey = { text: definition.label }
  const name = propertyFieldName(definition)
  switch (definition.data_type) {
    case 'text':
      return <TextField labelKey={labelKey} name={name} isRequired={definition.is_required} value={textOf(value)} onChange={onChange} error={error} />
    case 'number':
      return (
        <TextField
          labelKey={labelKey}
          name={name}
          isRequired={definition.is_required}
          inputMode="numeric"
          dir="ltr"
          value={textOf(value)}
          onChange={onChange}
          error={error}
        />
      )
    case 'date':
      return <DateField labelKey={labelKey} name={name} value={textOf(value)} onChange={onChange} error={error} />
    case 'boolean':
      return <SelectField labelKey={labelKey} name={name} value={textOf(value)} options={BOOLEAN_OPTIONS} onChange={onChange} error={error} />
    case 'select': {
      const options: SelectOption<string>[] = [
        NONE_OPTION,
        ...optionsOf(definition).map((option) => ({ key: option.id, label: { text: option.label }, value: option.id })),
      ]
      return <SelectField labelKey={labelKey} name={name} value={textOf(value)} options={options} onChange={onChange} error={error} />
    }
    case 'multi_select': {
      const options = optionsOf(definition)
      // An option removed since the value was stored is not shown, so a change writes the live ones only (D-176).
      const selected = typeof value === 'string' ? [] : value.filter((id) => options.some((option) => option.id === id))
      return (
        <div className="flex flex-col gap-xs">
          <CheckList
            label={labelKey}
            choices={options.map((option) => ({ key: option.id, label: { text: option.label }, dot: option.color_key === null ? null : toneOf(option.color_key).fill }))}
            selected={selected}
            onChange={onChange}
          />
          {error === null ? null : <p className="text-label text-status-rejected">{t(error)}</p>}
        </div>
      )
    }
    case 'soldier_ref':
      return <SoldierInput {...props} />
    case 'unit_ref':
      return <UnitInput {...props} />
  }
}

/** The fields of the entity's live definitions; nothing when it has none. */
export function PropertyFields({ fields, errorOf }: { readonly fields: Fields; readonly errorOf: (name: string) => I18nKey | null }) {
  return fields.definitions.map((definition) => (
    <PropertyInput
      key={definition.id}
      definition={definition}
      value={fields.values[definition.id] ?? ''}
      onChange={(value) => {
        fields.set(definition.id, value)
      }}
      error={errorOf(propertyFieldName(definition))}
    />
  ))
}
