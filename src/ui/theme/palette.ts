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

/** How a palette key paints a shape (D-111): a solid dot, a faint fill, an edge, and an ink for icons and hatching. */
export interface PaletteTone {
  readonly fill: string
  readonly faint: string
  readonly edge: string
  readonly ink: string
}

export const PALETTE_TONES: Record<PaletteKey, PaletteTone> = {
  red: { fill: 'bg-palette-red', faint: 'bg-palette-red/10', edge: 'border-palette-red', ink: 'text-palette-red' },
  orange: { fill: 'bg-palette-orange', faint: 'bg-palette-orange/10', edge: 'border-palette-orange', ink: 'text-palette-orange' },
  amber: { fill: 'bg-palette-amber', faint: 'bg-palette-amber/10', edge: 'border-palette-amber', ink: 'text-palette-amber' },
  lime: { fill: 'bg-palette-lime', faint: 'bg-palette-lime/10', edge: 'border-palette-lime', ink: 'text-palette-lime' },
  green: { fill: 'bg-palette-green', faint: 'bg-palette-green/10', edge: 'border-palette-green', ink: 'text-palette-green' },
  teal: { fill: 'bg-palette-teal', faint: 'bg-palette-teal/10', edge: 'border-palette-teal', ink: 'text-palette-teal' },
  cyan: { fill: 'bg-palette-cyan', faint: 'bg-palette-cyan/10', edge: 'border-palette-cyan', ink: 'text-palette-cyan' },
  blue: { fill: 'bg-palette-blue', faint: 'bg-palette-blue/10', edge: 'border-palette-blue', ink: 'text-palette-blue' },
  indigo: { fill: 'bg-palette-indigo', faint: 'bg-palette-indigo/10', edge: 'border-palette-indigo', ink: 'text-palette-indigo' },
  purple: { fill: 'bg-palette-purple', faint: 'bg-palette-purple/10', edge: 'border-palette-purple', ink: 'text-palette-purple' },
  pink: { fill: 'bg-palette-pink', faint: 'bg-palette-pink/10', edge: 'border-palette-pink', ink: 'text-palette-pink' },
  gray: { fill: 'bg-palette-gray', faint: 'bg-palette-gray/10', edge: 'border-palette-gray', ink: 'text-palette-gray' },
}

/** One tone for every absence in the uniform mode (D-112); a marker keeps the marker color. */
export const UNIFORM_TONE: PaletteTone = {
  fill: 'bg-absence',
  faint: 'bg-inner',
  edge: 'border-absence-edge',
  ink: 'text-absence-edge',
}

export const MARKER_TONE: PaletteTone = {
  fill: 'bg-marker',
  faint: 'bg-surface',
  edge: 'border-marker',
  ink: 'text-marker-ink',
}

/** The tone of a stored key, or the uniform tone for a key the palette no longer holds. */
export function toneOf(key: string | null): PaletteTone {
  return key !== null && isPaletteKey(key) ? PALETTE_TONES[key] : UNIFORM_TONE
}

/** A leave type's tone: green never means away (D-290), so a type that still holds a green key takes the uniform one. */
export function leaveTypeToneOf(key: string | null): PaletteTone {
  return key !== null && isLeaveTypePaletteKey(key) ? PALETTE_TONES[key] : UNIFORM_TONE
}
