import {
  RuleEnforcement,
  RuleGroupBy,
  RuleMetric,
  RuleScopeMode,
  type AvailabilityRule,
  type CommandRank,
  type CommandRankId,
  type Deployment,
  type DeploymentId,
  type Tag,
  type TagCategory,
  type TagCategoryId,
  type TagId,
  type Unit,
  type UnitId,
  type UnitLevel,
  type UnitLevelId,
} from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  NEW_RULE_VALUES,
  liveCategories,
  liveRanks,
  ruleFormIssues,
  ruleFormValues,
  tagsOfCategory,
  useRuleCommands,
  type RuleFormValues,
} from '@logic'
import { useForm, useStore } from '@tanstack/react-form'
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button as AriaButton, Disclosure, DisclosurePanel } from 'react-aria-components'
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

// A rule (D-140): its name, then the parts of the sentence its drawer reads (OI-385, D-491): where it counts, whom, its
// bounds and when it holds; what is set rarely (how it is enforced, the grouping, pending requests, the priority, the
// switch and the description) waits under "עוד", open when a rule is edited. The population is chosen with the filter
// bar's lists: tags by category and ranks; none counts everyone (D-131).

const RULE_FIELDS: readonly string[] = [
  'name',
  'description',
  'enforcement',
  'scope_unit_id',
  'scope_mode',
  'scope_level_id',
  'group_by',
  'group_tag_category_id',
  'deployment_id',
  'metric',
  'min_value',
  'max_value',
  'effective_from',
  'effective_to',
  'priority',
]

/** A part of the rule's sentence: its name over its fields. */
function FormPart({ titleKey, children }: { readonly titleKey: I18nKey; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md">
      <h3 className="text-small font-bold text-text-muted">{t(titleKey)}</h3>
      {children}
    </section>
  )
}

/** The fields that wait under "עוד" (D-495). */
const MORE_FIELDS: ReadonlySet<string> = new Set([
  'enforcement',
  'group_by',
  'group_tag_category_id',
  'count_pending_as_unavailable',
  'priority',
  'is_enabled',
  'description',
])

const ENFORCEMENTS: SelectOption<RuleFormValues['enforcement']>[] = [
  { key: RuleEnforcement.enum.soft, label: { key: 'rules.enforcementSoft' }, value: RuleEnforcement.enum.soft },
  { key: RuleEnforcement.enum.hard, label: { key: 'rules.enforcementHard' }, value: RuleEnforcement.enum.hard },
]

const MODES: SelectOption<RuleFormValues['scope_mode']>[] = [
  { key: RuleScopeMode.enum.unit_tree, label: { key: 'rules.modeTree' }, value: RuleScopeMode.enum.unit_tree },
  { key: RuleScopeMode.enum.each_child, label: { key: 'rules.modeChild' }, value: RuleScopeMode.enum.each_child },
  { key: RuleScopeMode.enum.each_descendant_at_level, label: { key: 'rules.modeLevel' }, value: RuleScopeMode.enum.each_descendant_at_level },
]

const GROUPINGS: SelectOption<RuleFormValues['group_by']>[] = [
  { key: RuleGroupBy.enum.none, label: { key: 'rules.groupNone' }, value: RuleGroupBy.enum.none },
  { key: RuleGroupBy.enum.tag, label: { key: 'rules.groupTag' }, value: RuleGroupBy.enum.tag },
  { key: RuleGroupBy.enum.command_rank, label: { key: 'rules.groupRank' }, value: RuleGroupBy.enum.command_rank },
]

const METRICS: SelectOption<RuleFormValues['metric']>[] = [
  { key: RuleMetric.enum.count, label: { key: 'rules.metricCount' }, value: RuleMetric.enum.count },
  { key: RuleMetric.enum.percent, label: { key: 'rules.metricPercent' }, value: RuleMetric.enum.percent },
]

const ORGANIZATION_OPTION: SelectOption<UnitId | null> = { key: 'organization', label: { key: 'rules.wholeOrganization' }, value: null }
const CHOOSE_LEVEL: SelectOption<UnitLevelId | null> = { key: RuleGroupBy.enum.none, label: { key: 'rules.chooseLevel' }, value: null }
const ANY_CATEGORY: SelectOption<TagCategoryId | null> = { key: 'any', label: { key: 'rules.anyCategory' }, value: null }

const ANY_DEPLOYMENT: SelectOption<DeploymentId | null> = { key: 'any', label: { key: 'rules.anyDeployment' }, value: null }

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
  /** Archived ones too: the rule's own deployment stays a choice (D-071). */
  readonly deployments: readonly Deployment[]
  /** Where the rule may be placed: NULL is the whole organization (D-139). */
  readonly placeable: (scopeUnitId: UnitId | null) => boolean
  readonly onReload: () => void
  /** The form is done, saved or let go: the rule's drawer shows the rule again, or closes for a new one (D-482). */
  readonly onDone: () => void
}

export function RuleForm({ rule, units, levels, categories, tags, ranks, deployments, placeable, onReload, onDone }: RuleFormProps) {
  const { create, update } = useRuleCommands()
  const [opened] = useState(rule)
  const [state, setState] = useState(CLEAN_FORM)
  // "עוד" is open on an edit, and opens when the command refuses a field, so nothing refused stays out of sight.
  const [more, setMore] = useState(rule !== null)
  const backToList = onDone

  const form = useForm({
    defaultValues: opened === null ? NEW_RULE_VALUES : ruleFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(ruleFormIssues(value)) },
    // A field under "עוד" that the form itself refuses opens it, so the refusal is in sight (D-495).
    onSubmitInvalid: ({ value }) => {
      if (ruleFormIssues(value).some((issue) => MORE_FIELDS.has(String(issue.path[0])))) setMore(true)
    },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null ? await create.run(value) : await update.run({ rule: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else {
        setState(formStateOf(result.error, RULE_FIELDS))
        setMore(true)
      }
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

  // Only a deployment's members count (D-071); the one the rule has stays a choice even once archived.
  const deploymentOptions = [
    ANY_DEPLOYMENT,
    ...deployments
      .filter((deployment) => deployment.archived_at === null || opened?.deployment_id === deployment.id)
      .map((deployment) => ({ key: deployment.id, label: { text: deployment.name }, value: deployment.id })),
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
      <FormPart titleKey="rules.parts.where">
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
        {mode === RuleScopeMode.enum.each_descendant_at_level ? (
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
      </FormPart>
      <FormPart titleKey="rules.parts.who">
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
        {deploymentOptions.length === 1 ? null : (
          <form.Field name="deployment_id">
            {(field) => (
              <SelectField
                labelKey="rules.deployment"
                name={field.name}
                value={field.state.value}
                options={deploymentOptions}
                onChange={field.handleChange}
                error={error(field.state.meta.errors, field.name)}
              />
            )}
          </form.Field>
        )}
      </FormPart>
      <FormPart titleKey="rules.parts.bounds">
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
      </FormPart>
      <FormPart titleKey="rules.parts.when">
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
      </FormPart>
      <Disclosure isExpanded={more} onExpandedChange={setMore} className="flex flex-col gap-md">
        <AriaButton slot="trigger" className="inline-flex min-h-touch cursor-pointer items-center gap-xs self-start rounded-control text-body font-semibold text-text-muted outline-focus outline-offset-2 data-focus-visible:outline-2">
          {t('rules.parts.more')}
          <ChevronDown aria-hidden size={16} className={more ? 'rotate-180' : ''} />
        </AriaButton>
        <DisclosurePanel className="flex flex-col gap-md">
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
          {groupBy === RuleGroupBy.enum.tag ? (
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
        </DisclosurePanel>
      </Disclosure>
    </EntityForm>
  )
}
