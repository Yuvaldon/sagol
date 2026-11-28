import { isLeaveTypePaletteKey, isPaletteKey, type PaletteKey } from '@config'
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

/** The class of a stored color key. NULL without a color, or for a key the palette no longer holds. */
export function swatchClassOf(key: string | null): string | null {
  return key !== null && isPaletteKey(key) ? PALETTE_SWATCHES[key].className : null
}

/** How a palette key paints a shape: a solid dot (D-454: time components carry no type color). */
export interface PaletteTone {
  readonly fill: string
}

const PALETTE_TONES: Record<PaletteKey, PaletteTone> = {
  red: { fill: 'bg-palette-red' },
  orange: { fill: 'bg-palette-orange' },
  amber: { fill: 'bg-palette-amber' },
  lime: { fill: 'bg-palette-lime' },
  green: { fill: 'bg-palette-green' },
  teal: { fill: 'bg-palette-teal' },
  cyan: { fill: 'bg-palette-cyan' },
  blue: { fill: 'bg-palette-blue' },
  indigo: { fill: 'bg-palette-indigo' },
  purple: { fill: 'bg-palette-purple' },
  pink: { fill: 'bg-palette-pink' },
  gray: { fill: 'bg-palette-gray' },
}

/** The tone of what has no color of its own: a key the palette no longer holds, a type whose key may not mean away. */
const UNIFORM_TONE: PaletteTone = { fill: 'bg-absence' }

/** The tone of a stored key, or the uniform tone for a key the palette no longer holds. */
export function toneOf(key: string | null): PaletteTone {
  return key !== null && isPaletteKey(key) ? PALETTE_TONES[key] : UNIFORM_TONE
}

/** A leave type's tone: green never means away (D-290), so a type that still holds a green key takes the uniform one. */
export function leaveTypeToneOf(key: string | null): PaletteTone {
  return key !== null && isLeaveTypePaletteKey(key) ? PALETTE_TONES[key] : UNIFORM_TONE
}
