import { t, type I18nKey } from '@i18n'

/** A field's label: an i18n key, or a name from the data (a custom property's label, D-016). */
export type FieldLabel = I18nKey | { readonly text: string }

export function fieldLabel(label: FieldLabel): string {
  return typeof label === 'string' ? t(label) : label.text
}
