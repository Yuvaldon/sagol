import { z } from 'zod'

// The closed list of `icon_key` values a leave type can take (D-034, D-113). The theme maps each key to an
// icon. Contracts only length-check `icon_key`; the data layer checks membership on write, as it does for
// `color_key`.

export const ICON_KEYS = [
  'home',
  'vacation',
  'travel',
  'medical',
  'sick',
  'course',
  'exam',
  'mission',
  'family',
  'celebration',
  'sport',
  'other',
] as const

export const IconKeyName = z.enum(ICON_KEYS)
export type IconKeyName = z.infer<typeof IconKeyName>

export function isIconKey(value: string): value is IconKeyName {
  return IconKeyName.safeParse(value).success
}
