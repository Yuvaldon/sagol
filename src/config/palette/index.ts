import { z } from 'zod'

// The closed list of `color_key` values users can choose (D-074, OI-011). The theme maps
// each key to a light/dark token pair. Contracts only length-check `color_key`; the data
// layer checks membership against this list on write.

export const PALETTE_KEYS = [
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
] as const

export const PaletteKey = z.enum(PALETTE_KEYS)
export type PaletteKey = z.infer<typeof PaletteKey>

export function isPaletteKey(value: string): value is PaletteKey {
  return PaletteKey.safeParse(value).success
}
