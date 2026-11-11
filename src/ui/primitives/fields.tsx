import { t, type I18nKey } from '@i18n'
import { ChevronDown } from 'lucide-react'
import {
  Button as AriaButton,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  TextField as AriaTextField,
  useFilter,
} from 'react-aria-components'

// Form fields. A field shows its label, its value and one error message, and knows nothing about
// forms or validation: the error arrives as an i18n key.

const FIELD = 'flex flex-col gap-xs'
const LABEL = 'text-label font-semibold text-text-muted'
const INPUT =
  'min-h-touch w-full rounded-control border border-line bg-surface px-md text-input text-text outline-focus outline-offset-1 md:min-h-control md:text-control data-focused:outline-2 data-invalid:border-status-rejected'
const ERROR = 'text-label text-status-rejected'

export interface TextFieldProps {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onBlur?: () => void
  readonly error: I18nKey | null
  readonly type?: 'text' | 'email'
  readonly autoComplete?: string
  readonly isRequired?: boolean
  readonly inputMode?: 'numeric' | 'tel' | 'email'
  /** Numbers and technical values read left to right inside the RTL layout. */
  readonly dir?: 'ltr'
}

export function TextField({ labelKey, error, name, type = 'text', autoComplete, isRequired, inputMode, dir, ...rest }: TextFieldProps) {
  return (
    <AriaTextField
      {...rest}
      name={name}
      type={type}
      {...(autoComplete === undefined ? {} : { autoComplete })}
      isRequired={isRequired ?? false}
      isInvalid={error !== null}
      validationBehavior="aria"
      className={FIELD}
    >
      <Label className={LABEL}>{t(labelKey)}</Label>
      <Input
        {...(inputMode === undefined ? {} : { inputMode })}
        {...(dir === undefined ? {} : { dir })}
        className={dir === undefined ? INPUT : `${INPUT} text-end`}
      />
      {error === null ? null : (
        <Text slot="errorMessage" className={ERROR}>
          {t(error)}
        </Text>
      )}
    </AriaTextField>
  )
}

export interface SearchSelectFieldProps {
  readonly labelKey: I18nKey
  readonly toggleLabelKey: I18nKey
  readonly name: string
  readonly value: string
  readonly options: readonly string[]
  readonly onChange: (value: string) => void
  readonly error: I18nKey | null
}

/** Pick one of many values by typing. Values are technical names, shown left to right. */
export function SearchSelectField({ labelKey, toggleLabelKey, name, value, options, onChange, error }: SearchSelectFieldProps) {
  const { contains } = useFilter({ sensitivity: 'base' })
  return (
    <ComboBox
      name={name}
      defaultItems={options.map((id) => ({ id }))}
      defaultFilter={contains}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (typeof key === 'string') onChange(key)
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      menuTrigger="focus"
      className={FIELD}
    >
      <Label className={LABEL}>{t(labelKey)}</Label>
      <div className="relative">
        <Input dir="ltr" className={`${INPUT} ps-touch text-end`} />
        <AriaButton
          aria-label={t(toggleLabelKey)}
          className="absolute inset-y-none end-none flex min-w-touch cursor-pointer items-center justify-center text-text-muted outline-focus data-focus-visible:outline-2"
        >
          <ChevronDown aria-hidden size={14} />
        </AriaButton>
      </div>
      {error === null ? null : (
        <Text slot="errorMessage" className={ERROR}>
          {t(error)}
        </Text>
      )}
      <Popover className="glass-menu w-trigger overflow-auto rounded-panel">
        <ListBox<{ id: string }> className="max-h-list overflow-auto p-xs outline-none">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.id}
              dir="ltr"
              className="flex min-h-touch cursor-pointer items-center justify-end rounded-control px-md text-control outline-none data-focused:bg-inner data-selected:font-semibold md:min-h-control"
            >
              {item.id}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}

export interface ComboOption {
  readonly key: string
  /** A name from the data. */
  readonly label: string
}

export interface ComboFieldProps {
  readonly labelKey: I18nKey
  readonly toggleLabelKey: I18nKey
  readonly name: string
  readonly value: string | null
  readonly options: readonly ComboOption[]
  readonly onChange: (value: string | null) => void
  readonly error: I18nKey | null
}

/** Pick one of many named rows by typing part of the name (a soldier). Names read right to left. */
export function ComboField({ labelKey, toggleLabelKey, name, value, options, onChange, error }: ComboFieldProps) {
  const { contains } = useFilter({ sensitivity: 'base' })
  return (
    <ComboBox
      name={name}
      defaultItems={options}
      defaultFilter={contains}
      selectedKey={value}
      onSelectionChange={(key) => {
        onChange(typeof key === 'string' ? key : null)
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      menuTrigger="focus"
      className={FIELD}
    >
      <Label className={LABEL}>{t(labelKey)}</Label>
      <div className="relative">
        <Input className={`${INPUT} pe-touch`} />
        <AriaButton
          aria-label={t(toggleLabelKey)}
          className="absolute inset-y-none end-none flex min-w-touch cursor-pointer items-center justify-center text-text-muted outline-focus data-focus-visible:outline-2"
        >
          <ChevronDown aria-hidden size={14} />
        </AriaButton>
      </div>
      {error === null ? null : (
        <Text slot="errorMessage" className={ERROR}>
          {t(error)}
        </Text>
      )}
      <Popover className="glass-menu w-trigger overflow-auto rounded-panel">
        <ListBox<ComboOption> className="max-h-list overflow-auto p-xs outline-none">
          {(item) => (
            <ListBoxItem
              id={item.key}
              textValue={item.label}
              className="flex min-h-touch cursor-pointer items-center rounded-control px-md text-control outline-none data-focused:bg-inner data-selected:font-semibold md:min-h-control"
            >
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
