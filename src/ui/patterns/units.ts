import { t, type I18nKey } from '@i18n'
import type { UnitState } from '@logic'

// What a soldier's unit is called when it is not a unit the actor sees (D-106, OI-048). The soldiers list
// and the timeline say the same thing.

export const UNIT_STATE_KEYS = {
  none: 'soldiers.noUnit',
  other: 'soldiers.hiddenUnit',
  unknown: 'soldiers.unknownUnit',
} as const satisfies Record<Exclude<UnitState['kind'], 'unit'>, I18nKey>

export function unitStateLabel(state: UnitState): string {
  return state.kind === 'unit' ? state.unit.name : t(UNIT_STATE_KEYS[state.kind])
}
