import { t, type I18nKey } from '@i18n'
import { ChevronDown } from 'lucide-react'
import {
  Button as AriaButton,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
} from 'react-aria-components'

// Pick one of a short list of labelled values. Labels are data (a unit's name), so they arrive as
// text; everything else arrives as an i18n key.

export interface SelectOption<T> {
  readonly key: string
  /** What the list shows. Either a name from the data or an i18n key. */
  readonly label: { readonly text: string } | { readonly key: I18nKey }
  readonly value: T
  /** Indentation of an option in a tree. */
  readonly depth?: number
}

export interface SelectFieldProps<T> {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: T
  readonly options: readonly SelectOption<T>[]
  readonly onChange: (value: T) => void
  readonly error: I18nKey | null
}

function labelOf<T>(option: SelectOption<T>): string {
  return 'text' in option.label ? option.label.text : t(option.label.key)
}

export function SelectField<T>({ labelKey, name, value, options, onChange, error }: SelectFieldProps<T>) {
  const selected = options.find((option) => option.value === value)
  return (
    <Select
      name={name}
      value={selected?.key ?? null}
      onChange={(key) => {
        const next = options.find((option) => option.key === key)
        if (next !== undefined) onChange(next.value)
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      className="flex flex-col gap-xs"
    >
      <Label className="text-label font-semibold text-text-muted">{t(labelKey)}</Label>
      <AriaButton className="flex min-h-touch w-full cursor-pointer items-center justify-between gap-sm rounded-control border border-line bg-surface px-md text-input text-text outline-focus outline-offset-1 md:min-h-control md:text-control data-focus-visible:outline-2">
        <SelectValue className="truncate" />
        <ChevronDown aria-hidden size={14} className="shrink-0 text-text-muted" />
      </AriaButton>
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
      <Popover className="glass-menu w-trigger overflow-auto rounded-panel">
        <ListBox className="max-h-list overflow-auto p-xs outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option.key}
              id={option.key}
              textValue={labelOf(option)}
              style={{ paddingInlineStart: `calc(var(--spacing-md) + var(--spacing-lg) * ${String(option.depth ?? 0)})` }}
              className="flex min-h-touch cursor-pointer items-center rounded-control pe-md text-control outline-none data-focused:bg-inner data-selected:font-semibold md:min-h-control"
            >
              {labelOf(option)}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}
