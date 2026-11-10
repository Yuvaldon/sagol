import { PANEL_IDS } from '@config'
import type {
  AvailabilityRule,
  CommandRank,
  CommandRankId,
  Tag,
  TagCategory,
  TagCategoryId,
  TagId,
  Unit,
  UnitId,
  UnitLevel,
  UnitLevelId,
} from '@contracts'
import { t } from '@i18n'
import {
  NEW_RULE_VALUES,
  liveCategories,
  liveRanks,
  ruleFormIssues,
  ruleFormValues,
  tagsOfCategory,
  usePanel,
  useRuleCommands,
  type RuleFormValues,
} from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { CheckList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { TextField } from '../../primitives/fields'
import { unitOptions } from '../soldiers/unitOptions'

// A rule (D-140): its name, how it is enforced, where it counts and whom, its bounds and when it holds. The population
// is chosen with the filter bar's lists: tags by category and ranks; none counts everyone (D-131).

const RULE_FIELDS: readonly string[] = [
  'name',
  'description',
  'enforcement',
  'scope_unit_id',
  'scope_mode',
  'scope_level_id',
  'group_by',
  'group_tag_category_id',
  'metric',
  'min_value',
  'max_value',
  'effective_from',
  'effective_to',
  'priority',
]

const ENFORCEMENTS: SelectOption<RuleFormValues['enforcement']>[] = [
  { key: 'soft', label: { key: 'rules.enforcementSoft' }, value: 'soft' },
  { key: 'hard', label: { key: 'rules.enforcementHard' }, value: 'hard' },
]

const MODES: SelectOption<RuleFormValues['scope_mode']>[] = [
  { key: 'unit_tree', label: { key: 'rules.modeTree' }, value: 'unit_tree' },
  { key: 'each_child', label: { key: 'rules.modeChild' }, value: 'each_child' },
  { key: 'each_descendant_at_level', label: { key: 'rules.modeLevel' }, value: 'each_descendant_at_level' },
]

const GROUPINGS: SelectOption<RuleFormValues['group_by']>[] = [
  { key: 'none', label: { key: 'rules.groupNone' }, value: 'none' },
  { key: 'tag', label: { key: 'rules.groupTag' }, value: 'tag' },
  { key: 'command_rank', label: { key: 'rules.groupRank' }, value: 'command_rank' },
]

const METRICS: SelectOption<RuleFormValues['metric']>[] = [
  { key: 'count', label: { key: 'rules.metricCount' }, value: 'count' },
  { key: 'percent', label: { key: 'rules.metricPercent' }, value: 'percent' },
]

const ORGANIZATION_OPTION: SelectOption<UnitId | null> = { key: 'organization', label: { key: 'rules.wholeOrganization' }, value: null }
const CHOOSE_LEVEL: SelectOption<UnitLevelId | null> = { key: 'none', label: { key: 'rules.chooseLevel' }, value: null }
const ANY_CATEGORY: SelectOption<TagCategoryId | null> = { key: 'any', label: { key: 'rules.anyCategory' }, value: null }

/** The population's lists: one per tag category, and the ranks. A filter the form does not read can only be cleared. */
function PopulationField({
  other,
  tagSets,
  rankIds,
  onClearOther,
  onChange,
  categories,
  tags,
  ranks,
}: {
  readonly other: boolean
  readonly tagSets: readonly (readonly TagId[])[]
  readonly rankIds: readonly CommandRankId[]
  readonly onClearOther: () => void
  readonly onChange: (tagSets: readonly (readonly TagId[])[], rankIds: readonly CommandRankId[]) => void
  readonly categories: readonly TagCategory[]
  readonly tags: readonly Tag[]
  readonly ranks: readonly CommandRank[]
}) {
  if (other) {
    return (
      <div className="flex flex-col items-start gap-xs">
        <span className="text-label font-semibold text-text-muted">{t('rules.population')}</span>
        <span className="text-name">{t('rules.otherPopulation')}</span>
        <Button onPress={onClearOther}>{t('rules.countEveryone')}</Button>
      </div>
    )
  }
  const tagChoices = (categoryId: TagCategoryId) =>
    tagsOfCategory(tags, categoryId).map((tag) => ({ key: tag.id, label: { text: tag.name } }))
  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="pb-xs text-label font-semibold text-text-muted">{t('rules.population')}</legend>
      {tagSets.length === 0 && rankIds.length === 0 ? <p className="text-micro text-text-muted">{t('rules.everyone')}</p> : null}
      {liveCategories(categories).map((category) => {
        const ofCategory = new Set<TagId>(tagsOfCategory(tags, category.id).map((tag) => tag.id))
        const selected = tagSets.flat().filter((id) => ofCategory.has(id))
        return (
          <CheckList
            key={category.id}
            label={{ text: category.name }}
            choices={tagChoices(category.id)}
            selected={selected}
            onChange={(keys) => {
              const others = tagSets.filter((set) => !set.some((id) => ofCategory.has(id)))
              const chosen = tags.filter((tag) => keys.includes(tag.id)).map((tag) => tag.id)
              onChange(chosen.length === 0 ? others : [...others, chosen], rankIds)
            }}
          />
        )
      })}
      {ranks.length === 0 ? null : (
        <CheckList
          label={{ key: 'rules.ranks' }}
          choices={ranks.map((rank) => ({ key: rank.id, label: { text: rank.title } }))}
          selected={rankIds}
          onChange={(keys) => {
            onChange(
              tagSets,
              ranks.filter((rank) => keys.includes(rank.id)).map((rank) => rank.id),
            )
          }}
        />
      )}
    </fieldset>
  )
}

export interface RuleFormProps {
  readonly rule: AvailabilityRule | null
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly categories: readonly TagCategory[]
  readonly tags: readonly Tag[]
  readonly ranks: readonly CommandRank[]
  /** Where the rule may be placed: NULL is the whole organization (D-139). */
  readonly placeable: (scopeUnitId: UnitId | null) => boolean
  readonly onReload: () => void
}

export function RuleForm({ rule, units, levels, categories, tags, ranks, placeable, onReload }: RuleFormProps) {
  const panel = usePanel()
  const { create, update } = useRuleCommands()
  const [opened] = useState(rule)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.rules)
  }

  const form = useForm({
    defaultValues: opened === null ? NEW_RULE_VALUES : ruleFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(ruleFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null ? await create.run(value) : await update.run({ rule: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, RULE_FIELDS))
    },
  })
  const mode = useStore(form.store, (current) => current.values.scope_mode)
  const groupBy = useStore(form.store, (current) => current.values.group_by)
  const tagSets = useStore(form.store, (current) => current.values.tag_sets)
  const rankIds = useStore(form.store, (current) => current.values.rank_ids)
  const otherPopulation = useStore(form.store, (current) => current.values.other_population)
  const error = (errors: readonly unknown[], name: string) => fieldError(errors, name, state.answered)
  // The unit the rule has stays a choice, so an edit never moves it by itself.
  const scopeOptions = [
    ...(placeable(null) || opened?.scope_unit_id === null ? [ORGANIZATION_OPTION] : []),
    ...unitOptions(
      units.filter((unit) => unit.archived_at === null),
      (id) => placeable(id) || opened?.scope_unit_id === id,
    ),
  ]
  const levelOptions = [CHOOSE_LEVEL, ...levels.filter((level) => level.archived_at === null).map((level) => ({ key: level.id, label: { text: level.name }, value: level.id }))]
  const categoryOptions = [
    ANY_CATEGORY,
    ...liveCategories(categories).map((category) => ({ key: category.id, label: { text: category.name }, value: category.id })),
  ]

  return (
    <EntityForm
      titleKey={opened === null ? 'rules.newTitle' : 'rules.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="rules.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <form.Field name="enforcement">
        {(field) => (
          <SelectField
            labelKey="rules.enforcement"
            name={field.name}
            value={field.state.value}
            options={ENFORCEMENTS}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-md">
        <form.Field name="min_value">
          {(field) => (
            <TextField
              labelKey="rules.min"
              name={field.name}
              inputMode="numeric"
              dir="ltr"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
        <form.Field name="max_value">
          {(field) => (
            <TextField
              labelKey="rules.max"
              name={field.name}
              inputMode="numeric"
              dir="ltr"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      </div>
      <form.Field name="metric">
        {(field) => (
          <SelectField
            labelKey="rules.metric"
            name={field.name}
            value={field.state.value}
            options={METRICS}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <PopulationField
        other={otherPopulation}
        tagSets={tagSets}
        rankIds={rankIds}
        onClearOther={() => {
          form.setFieldValue('other_population', false)
        }}
        onChange={(nextTagSets, nextRankIds) => {
          form.setFieldValue('tag_sets', nextTagSets)
          form.setFieldValue('rank_ids', nextRankIds)
        }}
        categories={categories}
        tags={tags}
        ranks={liveRanks(ranks)}
      />
      <form.Field name="scope_unit_id">
        {(field) => (
          <SelectField
            labelKey="rules.scope"
            name={field.name}
            value={field.state.value}
            options={scopeOptions}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <form.Field name="scope_mode">
        {(field) => (
          <SelectField
            labelKey="rules.scopeMode"
            name={field.name}
            value={field.state.value}
            options={MODES}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      {mode === 'each_descendant_at_level' ? (
        <form.Field name="scope_level_id">
          {(field) => (
            <SelectField
              labelKey="rules.level"
              name={field.name}
              value={field.state.value}
              options={levelOptions}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      ) : null}
      <form.Field name="group_by">
        {(field) => (
          <SelectField
            labelKey="rules.groupBy"
            name={field.name}
            value={field.state.value}
            options={GROUPINGS}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      {groupBy === 'tag' ? (
        <form.Field name="group_tag_category_id">
          {(field) => (
            <SelectField
              labelKey="rules.groupCategory"
              name={field.name}
              value={field.state.value}
              options={categoryOptions}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      ) : null}
      <div className="grid grid-cols-2 gap-md">
        <form.Field name="effective_from">
          {(field) => (
            <DateField
              labelKey="rules.from"
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
        <form.Field name="effective_to">
          {(field) => (
            <DateField
              labelKey="rules.to"
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              error={error(field.state.meta.errors, field.name)}
            />
          )}
        </form.Field>
      </div>
      <form.Field name="count_pending_as_unavailable">
        {(field) => <SwitchField labelKey="rules.countPending" name={field.name} value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <form.Field name="priority">
        {(field) => (
          <TextField
            labelKey="rules.priority"
            name={field.name}
            inputMode="numeric"
            dir="ltr"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
      <p className="text-micro text-text-muted">{t('rules.priorityHint')}</p>
      <form.Field name="is_enabled">
        {(field) => <SwitchField labelKey="rules.enabled" name={field.name} value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <TextAreaField
            labelKey="rules.description"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={error(field.state.meta.errors, field.name)}
          />
        )}
      </form.Field>
    </EntityForm>
  )
}
