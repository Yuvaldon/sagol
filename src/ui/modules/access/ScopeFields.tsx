import { ScopeAnchorType, SubjectRankConstraint, type UnitId, type UnitLevelId } from '@contracts'
import type { I18nKey } from '@i18n'
import { anchorFields, fullName, useSoldiers, useUnitLevels, useUnits, type ScopeFormValues } from '@logic'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { ComboField, TextField } from '../../primitives/fields'
import { unitOptions } from '../soldiers/unitOptions'

// The scope picker of a rank binding or a grant (D-028, D-165): the anchor, only the fields it needs, and the rank
// constraint.

const ANCHOR_OPTIONS: readonly SelectOption<ScopeAnchorType>[] = ScopeAnchorType.options.map((anchor) => ({
  key: anchor,
  label: { key: `scope.anchors.${anchor}` },
  value: anchor,
}))

const RANK_OPTIONS: readonly SelectOption<SubjectRankConstraint>[] = SubjectRankConstraint.options.map((constraint) => ({
  key: constraint,
  label: { key: `scope.ranks.${constraint}` },
  value: constraint,
}))

const NO_SELECTION = 'none'
const everyUnit = () => true

/** A whole number of levels, or nothing while the field is empty or holds something else. */
function stepsOf(text: string): number | null {
  const steps = Number.parseInt(text, 10)
  return Number.isInteger(steps) && String(steps) === text.trim() ? steps : null
}

export interface ScopeFieldsProps {
  readonly values: ScopeFormValues
  readonly onChange: (values: ScopeFormValues) => void
  readonly errorOf: (name: string) => I18nKey | null
}

export function ScopeFields({ values, onChange, errorOf }: ScopeFieldsProps) {
  const units = useUnits()
  const levels = useUnitLevels()
  const soldiers = useSoldiers()
  const fields = anchorFields(values.anchor_type)
  const change = (next: Partial<ScopeFormValues>) => {
    onChange({ ...values, ...next })
  }
  const levelOptions: SelectOption<UnitLevelId | null>[] = [
    { key: NO_SELECTION, label: { key: 'scope.none' }, value: null },
    ...(levels.status === 'ready'
      ? levels.value
          .filter((level) => level.archived_at === null)
          .map((level) => ({ key: level.id, label: { text: level.name }, value: level.id }))
      : []),
  ]
  const unitChoices: SelectOption<UnitId | null>[] = [
    { key: NO_SELECTION, label: { key: 'scope.none' }, value: null },
    ...(units.status === 'ready' ? unitOptions(units.value, everyUnit) : []),
  ]

  return (
    <>
      <SelectField
        labelKey="scope.anchor"
        name="anchor_type"
        value={values.anchor_type}
        options={ANCHOR_OPTIONS}
        onChange={(anchor_type) => {
          change({ anchor_type })
        }}
        error={errorOf('anchor_type')}
      />
      {fields.unit ? (
        <SelectField
          labelKey="scope.unit"
          name="anchor_unit_id"
          value={values.anchor_unit_id}
          options={unitChoices}
          onChange={(anchor_unit_id) => {
            change({ anchor_unit_id })
          }}
          error={errorOf('anchor_unit_id')}
        />
      ) : null}
      {fields.soldier ? (
        <ComboField
          labelKey="scope.soldier"
          toggleLabelKey="scope.soldierToggle"
          name="anchor_soldier_id"
          value={values.anchor_soldier_id}
          options={soldiers.status === 'ready' ? soldiers.value.map((soldier) => ({ key: soldier.id, label: fullName(soldier) })) : []}
          onChange={(key) => {
            const soldier = soldiers.status === 'ready' ? soldiers.value.find((candidate) => candidate.id === key) : undefined
            change({ anchor_soldier_id: soldier?.id ?? null })
          }}
          error={errorOf('anchor_soldier_id')}
        />
      ) : null}
      {fields.level ? (
        <SelectField
          labelKey="scope.level"
          name="anchor_level_id"
          value={values.anchor_level_id}
          options={levelOptions}
          onChange={(anchor_level_id) => {
            change({ anchor_level_id })
          }}
          error={errorOf('anchor_level_id')}
        />
      ) : null}
      {fields.steps ? (
        <TextField
          labelKey="scope.steps"
          name="anchor_steps"
          inputMode="numeric"
          dir="ltr"
          value={values.anchor_steps === null ? '' : String(values.anchor_steps)}
          onChange={(text) => {
            change({ anchor_steps: stepsOf(text) })
          }}
          error={errorOf('anchor_steps')}
        />
      ) : null}
      {fields.descendants ? (
        <SwitchField
          labelKey="scope.descendants"
          name="include_descendants"
          value={values.include_descendants}
          onChange={(include_descendants) => {
            change({ include_descendants })
          }}
        />
      ) : null}
      <SelectField
        labelKey="scope.rankConstraint"
        name="subject_rank_constraint"
        value={values.subject_rank_constraint}
        options={RANK_OPTIONS}
        onChange={(subject_rank_constraint) => {
          change({ subject_rank_constraint })
        }}
        error={errorOf('subject_rank_constraint')}
      />
    </>
  )
}
