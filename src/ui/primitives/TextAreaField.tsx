import { t, type I18nKey } from '@i18n'
import { Label, Text, TextArea, TextField as AriaTextField } from 'react-aria-components'

// A few lines of free text (a comment, a note). Like every field it shows its label, its value and one error.

export interface TextAreaFieldProps {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error: I18nKey | null
}

export function TextAreaField({ labelKey, name, value, onChange, error }: TextAreaFieldProps) {
  return (
    <AriaTextField
      name={name}
      value={value}
      onChange={onChange}
      isInvalid={error !== null}
      validationBehavior="aria"
      className="flex flex-col gap-xs"
    >
      <Label className="text-label font-semibold text-text-muted">{t(labelKey)}</Label>
      <TextArea
        rows={3}
        className="w-full resize-none rounded-control border border-line bg-surface px-md py-sm text-input text-text outline-focus outline-offset-1 md:text-control data-focused:outline-2 data-invalid:border-status-rejected"
      />
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
    </AriaTextField>
  )
}
