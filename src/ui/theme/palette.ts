import type { PaletteKey } from '@config'
import type { I18nKey } from '@i18n'

// What a palette key looks like and how it is read aloud. The map is total, so a new key fails to
// compile until it has both (D-074). Tailwind sees these classes because they are written in full.

export const PALETTE_SWATCHES: Record<PaletteKey, { readonly className: string; readonly labelKey: I18nKey }> = {
  red: { className: 'bg-palette-red', labelKey: 'palette.red' },
  orange: { className: 'bg-palette-orange', labelKey: 'palette.orange' },
  amber: { className: 'bg-palette-amber', labelKey: 'palette.amber' },
  lime: { className: 'bg-palette-lime', labelKey: 'palette.lime' },
  green: { className: 'bg-palette-green', labelKey: 'palette.green' },
  teal: { className: 'bg-palette-teal', labelKey: 'palette.teal' },
  cyan: { className: 'bg-palette-cyan', labelKey: 'palette.cyan' },
  blue: { className: 'bg-palette-blue', labelKey: 'palette.blue' },
  indigo: { className: 'bg-palette-indigo', labelKey: 'palette.indigo' },
  purple: { className: 'bg-palette-purple', labelKey: 'palette.purple' },
  pink: { className: 'bg-palette-pink', labelKey: 'palette.pink' },
  gray: { className: 'bg-palette-gray', labelKey: 'palette.gray' },
}
