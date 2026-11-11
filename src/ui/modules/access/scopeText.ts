import type { Soldier, Unit, UnitLevel } from '@contracts'
import { t } from '@i18n'
import { fullName, type ScopeFormValues } from '@logic'

// A scope in words for a list row (D-028): the anchor, its argument, and the rank constraint when it limits.

export interface ScopeNames {
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly soldiers: readonly Soldier[]
}

function argumentOf(scope: ScopeFormValues, names: ScopeNames): string | null {
  switch (scope.anchor_type) {
    case 'unit':
      return names.units.find((unit) => unit.id === scope.anchor_unit_id)?.name ?? null
    case 'soldier': {
      const soldier = names.soldiers.find((candidate) => candidate.id === scope.anchor_soldier_id)
      return soldier === undefined ? null : fullName(soldier)
    }
    case 'home_ancestor_at_level':
      return names.levels.find((level) => level.id === scope.anchor_level_id)?.name ?? null
    case 'home_ancestor_steps':
      return scope.anchor_steps === null ? null : String(scope.anchor_steps)
    case 'self':
    case 'organization':
    case 'home_unit':
      return null
  }
}

export function scopeText(scope: ScopeFormValues, names: ScopeNames): string {
  const argument = argumentOf(scope, names)
  return [
    argument === null ? t(`scope.anchors.${scope.anchor_type}`) : `${t(`scope.anchors.${scope.anchor_type}`)}: ${argument}`,
    ...(scope.include_descendants ? [t('scope.descendants')] : []),
    ...(scope.subject_rank_constraint === 'any' ? [] : [t(`scope.ranks.${scope.subject_rank_constraint}`)]),
  ].join(' · ')
}
