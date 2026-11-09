import type { IconKeyName } from '@config'
import { isIconKey } from '@config'
import type { I18nKey } from '@i18n'
import {
  Dumbbell,
  GraduationCap,
  House,
  Baby,
  PartyPopper,
  PencilLine,
  Plane,
  Stethoscope,
  Tag,
  Target,
  Thermometer,
  TreePalm,
  type LucideIcon,
} from 'lucide-react'

// What an icon key looks like and how it is read aloud (D-034, D-113). The map is total, so a new key fails to
// compile until it has both.

export const ICON_GLYPHS: Record<IconKeyName, { readonly Icon: LucideIcon; readonly labelKey: I18nKey }> = {
  home: { Icon: House, labelKey: 'icons.home' },
  vacation: { Icon: TreePalm, labelKey: 'icons.vacation' },
  travel: { Icon: Plane, labelKey: 'icons.travel' },
  medical: { Icon: Stethoscope, labelKey: 'icons.medical' },
  sick: { Icon: Thermometer, labelKey: 'icons.sick' },
  course: { Icon: GraduationCap, labelKey: 'icons.course' },
  exam: { Icon: PencilLine, labelKey: 'icons.exam' },
  mission: { Icon: Target, labelKey: 'icons.mission' },
  family: { Icon: Baby, labelKey: 'icons.family' },
  celebration: { Icon: PartyPopper, labelKey: 'icons.celebration' },
  sport: { Icon: Dumbbell, labelKey: 'icons.sport' },
  other: { Icon: Tag, labelKey: 'icons.other' },
}

/** The glyph of a stored key. NULL without one, or for a key the list no longer holds. */
export function glyphOf(key: string | null): (typeof ICON_GLYPHS)[IconKeyName] | null {
  return key !== null && isIconKey(key) ? ICON_GLYPHS[key] : null
}

/** The icon of a stored key, as `glyphOf` finds it. */
export function iconOf(key: string | null): LucideIcon | null {
  return glyphOf(key)?.Icon ?? null
}
