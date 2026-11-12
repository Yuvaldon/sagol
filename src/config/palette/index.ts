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

/**
 * The keys a leave type may take (D-268, D-290): a leave is an absence, and green never means away, so the green family
 * is not offered. A type that holds one from before is painted in the uniform tone.
 */
const NOT_FOR_LEAVES: ReadonlySet<PaletteKey> = new Set(['green', 'lime'])

export const LEAVE_TYPE_PALETTE_KEYS: readonly PaletteKey[] = PALETTE_KEYS.filter((key) => !NOT_FOR_LEAVES.has(key))

export function isLeaveTypePaletteKey(value: string): value is PaletteKey {
  return isPaletteKey(value) && !NOT_FOR_LEAVES.has(value)
}

/** What an imported type stored green comes in as (D-290): the quietest key a leave type may take. */
export const IMPORTED_LEAVE_TYPE_STAND_IN: PaletteKey = 'gray'
