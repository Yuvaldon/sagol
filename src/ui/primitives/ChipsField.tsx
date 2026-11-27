import { t, type I18nKey } from '@i18n'
import { Label, Radio, RadioGroup, Text } from 'react-aria-components'

// One of a few named choices as chips in a row that scrolls sideways (D-454): the chosen one is filled, and a check
// of its state is read aloud. Arrow keys move between the chips, as in any radio group.

export interface ChipOption<Value> {
  readonly key: string
  /** A name from the data, or a word of the dictionary. */
  readonly label: { readonly text: string } | { readonly key: I18nKey }
  readonly value: Value
}

export interface ChipsFieldProps<Value> {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: Value | null
  readonly options: readonly ChipOption<Value>[]
  readonly onChange: (value: Value) => void
  readonly error: I18nKey | null
}

export function ChipsField<Value>({ labelKey, name, value, options, onChange, error }: ChipsFieldProps<Value>) {
  const selected = options.find((option) => option.value === value)?.key ?? null
  return (
    <RadioGroup
      name={name}
      orientation="horizontal"
      value={selected}
      isInvalid={error !== null}
      onChange={(key) => {
        const chosen = options.find((option) => option.key === key)
        if (chosen !== undefined) onChange(chosen.value)
      }}
      className="flex flex-col gap-xs"
    >
      <Label className="text-label font-semibold text-text-muted">{t(labelKey)}</Label>
      <div className="-mx-lg flex gap-sm overflow-x-auto px-lg py-2xs">
        {options.map((option) => (
          <Radio
            key={option.key}
            value={option.key}
            className="inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full bg-surface px-lg text-body font-semibold whitespace-nowrap text-text outline-focus outline-offset-2 data-focus-visible:outline-2 data-selected:bg-action-solid data-selected:text-on-action"
          >
            {'text' in option.label ? option.label.text : t(option.label.key)}
          </Radio>
        ))}
      </div>
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
    </RadioGroup>
  )
}
