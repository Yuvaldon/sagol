import {
  CommandRankId,
  PropertyOptionId,
  SoldierStatus,
  TagId,
  type CommandRank,
  type PropertyDefinition,
  type Tag,
  type TagCategory,
} from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  definitionsOf,
  liveCategories,
  liveRanks,
  optionsOf,
  tagColorOf,
  tagsOfCategory,
  useCommandRanks,
  usePropertyDefinitions,
  useTagCategories,
  useTags,
  type FilterRule,
} from '@logic'
import { useMemo } from 'react'
import { toneOf } from '../theme/palette'
import type { Choice } from '../primitives/ChoiceList'

// The soldier fields of the rule builder (D-312): what a rule may filter by, its operators and its values, and the way
// between a rule of the URL and a row of the builder. Every field reads its values from the data, never a list here.

export const OPERATORS = ['anyOf', 'noneOf', 'is', 'isNot', 'isEmpty', 'isNotEmpty'] as const
export type Operator = (typeof OPERATORS)[number]

export const OPERATOR_LABELS: Record<Operator, I18nKey> = {
  anyOf: 'filters.operators.anyOf',
  noneOf: 'filters.operators.noneOf',
  is: 'filters.operators.is',
  isNot: 'filters.operators.isNot',
  isEmpty: 'filters.operators.isEmpty',
  isNotEmpty: 'filters.operators.isNotEmpty',
}

/** The operators that need no value. */
export function takesValues(operator: Operator): boolean {
  return operator !== 'isEmpty' && operator !== 'isNotEmpty'
}

/** A row of the builder: a field, an operator and the values chosen so far. */
export interface Draft {
  readonly field: string
  readonly operator: Operator
  readonly values: readonly string[]
}

export interface FilterField {
  readonly key: string
  readonly name: string
  readonly operators: readonly Operator[]
  /** The live values, and any chosen one no longer live after them. */
  choicesOf(values: readonly string[]): Choice[]
  /** One value at a time (yes / no). */
  readonly single: boolean
  /** The rule a row writes; NULL while it has no value, so it lives only in the builder (D-312). */
  ruleOf(operator: Operator, values: readonly string[]): FilterRule | null
  labelOf(value: string): string
  /** Whether a chosen value matches no soldier: one not known, or an option no longer current (D-016). */
  inert(value: string): boolean
}

const named = (key: I18nKey) => ({ key })
const unknownChoice = (key: string): Choice => ({ key, label: named('filters.unavailable') })

const STATUS_KEYS: Record<SoldierStatus, I18nKey> = { active: 'soldiers.statusActive', inactive: 'soldiers.statusInactive' }

const BOOLEAN_KEYS = { true: 'true', false: 'false' } as const
const BOOLEAN_CHOICES: readonly Choice[] = [
  { key: BOOLEAN_KEYS.true, label: named('properties.yes') },
  { key: BOOLEAN_KEYS.false, label: named('properties.no') },
]

/** The choices, then the chosen values they do not hold. */
function withExtras(choices: readonly Choice[], values: readonly string[], extra: (value: string) => Choice): Choice[] {
  return [...choices, ...values.filter((value) => !choices.some((choice) => choice.key === value)).map(extra)]
}

const negated = (operator: Operator) => operator === 'noneOf' || operator === 'isNot'

function parsed<T>(values: readonly string[], parse: (value: string) => T | null): T[] {
  return values.flatMap((value) => {
    const held = parse(value)
    return held === null ? [] : [held]
  })
}

const safe =
  <T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }) =>
  (value: string): T | null => {
    const result = schema.safeParse(value)
    return result.success ? result.data : null
  }

function tagField(category: TagCategory, categories: readonly TagCategory[], tags: readonly Tag[]): FilterField {
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const live: Choice[] = tagsOfCategory(tags, category.id).map((tag) => ({
    key: tag.id,
    label: { text: tag.name },
    dot: toneOf(tagColorOf(tag, categories)).fill,
  }))
  return {
    key: `tag:${category.id}`,
    name: category.name,
    operators: ['anyOf', 'noneOf'],
    single: false,
    choicesOf: (values) =>
      withExtras(live, values, (value) => {
        const id = safe(TagId)(value)
        const tag = id === null ? undefined : byId.get(id)
        return tag === undefined ? unknownChoice(value) : { key: value, label: { text: tag.name }, note: 'soldiers.tagArchived' }
      }),
    ruleOf: (operator, values) => ({ kind: 'tag', negate: negated(operator), tagIds: parsed(values, safe(TagId)) }),
    labelOf: (value) => {
      const id = safe(TagId)(value)
      return (id === null ? undefined : byId.get(id)?.name) ?? t('filters.unavailable')
    },
    // A held archived tag still counts (D-130); only a tag not known matches nobody.
    inert: (value) => {
      const id = safe(TagId)(value)
      return id === null || !byId.has(id)
    },
  }
}

function rankField(ranks: readonly CommandRank[]): FilterField {
  const live: Choice[] = liveRanks(ranks).map((rank) => ({ key: rank.id, label: { text: rank.title } }))
  const titleOf = (value: string) => ranks.find((rank) => rank.id === value)?.title ?? null
  return {
    key: 'rank',
    name: t('filters.rank'),
    operators: ['anyOf', 'noneOf'],
    single: false,
    choicesOf: (values) =>
      withExtras(live, values, (value) => {
        const title = titleOf(value)
        return title === null ? unknownChoice(value) : { key: value, label: { text: title } }
      }),
    ruleOf: (operator, values) => ({ kind: 'rank', negate: negated(operator), rankIds: parsed(values, safe(CommandRankId)) }),
    labelOf: (value) => titleOf(value) ?? t('filters.unavailable'),
    inert: (value) => titleOf(value) === null,
  }
}

function statusField(): FilterField {
  return {
  key: 'status',
  name: t('filters.status'),
  operators: ['is', 'isNot'],
  single: false,
  choicesOf: (values) =>
    withExtras(
      SoldierStatus.options.map((value) => ({ key: value, label: named(STATUS_KEYS[value]) })),
      values,
      unknownChoice,
    ),
  ruleOf: (operator, values) => ({ kind: 'status', negate: negated(operator), statuses: parsed(values, safe(SoldierStatus)) }),
  labelOf: (value) => {
    const status = safe(SoldierStatus)(value)
    return status === null ? t('filters.unavailable') : t(STATUS_KEYS[status])
  },
  inert: (value) => safe(SoldierStatus)(value) === null,
  }
}

/**
 * A soldier property the builder filters by (D-312): select and multi-select by their options, yes / no by its answer
 * or by having none (D-322).
 */
function propertyField(definition: PropertyDefinition): FilterField | null {
  const key = `property:${definition.id}`
  const definitionId = definition.id
  if (definition.data_type === 'boolean') {
    return {
      key,
      name: definition.label,
      operators: ['is', 'isEmpty', 'isNotEmpty'],
      single: true,
      choicesOf: () => [...BOOLEAN_CHOICES],
      ruleOf: (operator, values) => {
        if (!takesValues(operator)) return { kind: 'empty', definitionId, empty: operator === 'isEmpty' }
        const [value] = values
        return value === undefined ? null : { kind: 'boolean', definitionId, value: value === BOOLEAN_KEYS.true }
      },
      labelOf: (value) => t(value === BOOLEAN_KEYS.true ? 'properties.yes' : 'properties.no'),
      inert: () => false,
    }
  }
  if (definition.data_type !== 'select' && definition.data_type !== 'multi_select') return null
  const options = optionsOf(definition)
  const live: Choice[] = options.map((option) => ({
    key: option.id,
    label: { text: option.label },
    ...(option.color_key === null ? {} : { dot: toneOf(option.color_key).fill }),
  }))
  return {
    key,
    name: definition.label,
    operators: ['anyOf', 'noneOf', 'isEmpty', 'isNotEmpty'],
    single: false,
    choicesOf: (values) => withExtras(live, values, unknownChoice),
    ruleOf: (operator, values) =>
      takesValues(operator)
        ? { kind: 'options', definitionId, negate: negated(operator), optionIds: parsed(values, safe(PropertyOptionId)) }
        : { kind: 'empty', definitionId, empty: operator === 'isEmpty' },
    labelOf: (value) => options.find((option) => option.id === value)?.label ?? t('filters.unavailable'),
    inert: (value) => !options.some((option) => option.id === value),
  }
}

export interface FilterFields {
  /** Whether the tags, ranks and properties have loaded: before, a rule's field is not known yet (OI-261). */
  readonly ready: boolean
  readonly byKey: ReadonlyMap<string, FilterField>
  /** The fields a new row may pick: the live ones that hold a value to choose. */
  readonly offered: readonly FilterField[]
  /** The row of a rule; NULL when its field is not one the builder knows, so the row can only be removed. */
  draftOf(rule: FilterRule): Draft | null
}

export function useFilterFields(): FilterFields {
  const categories = useTagCategories()
  const tags = useTags()
  const ranks = useCommandRanks()
  const properties = usePropertyDefinitions()
  const allCategories = categories.status === 'ready' ? categories.value : null
  const allTags = tags.status === 'ready' ? tags.value : null
  const allRanks = ranks.status === 'ready' ? ranks.value : null
  const allDefinitions = properties.status === 'ready' ? properties.value : null
  const ready = [categories, tags, ranks, properties].every((query) => query.status !== 'loading')
  return useMemo(() => {
    const categoryList = allCategories ?? []
    const tagList = allTags ?? []
    const rankList = allRanks ?? []
    const soldierDefinitions = definitionsOf(allDefinitions ?? [], 'soldier')
    const byKey = new Map<string, FilterField>()
    const offered: FilterField[] = []
    // Archived categories still name a rule that holds their tags.
    for (const category of categoryList) byKey.set(`tag:${category.id}`, tagField(category, categoryList, tagList))
    for (const category of liveCategories(categoryList)) {
      const field = byKey.get(`tag:${category.id}`)
      if (field !== undefined && tagsOfCategory(tagList, category.id).length > 0) offered.push(field)
    }
    const rank = rankField(rankList)
    byKey.set(rank.key, rank)
    if (liveRanks(rankList).length > 0) offered.push(rank)
    const status = statusField()
    byKey.set(status.key, status)
    offered.push(status)
    for (const definition of soldierDefinitions) {
      const field = propertyField(definition)
      if (field === null) continue
      byKey.set(field.key, field)
      if (field.choicesOf([]).length > 0) offered.push(field)
    }
    const categoryOf = (tagId: TagId) => tagList.find((tag) => tag.id === tagId)?.category_id
    const known = (draft: Draft): Draft | null => {
      const field = byKey.get(draft.field)
      return field !== undefined && field.operators.includes(draft.operator) ? draft : null
    }
    const draftOf = (rule: FilterRule): Draft | null => {
      switch (rule.kind) {
        case 'tag': {
          const [first] = rule.tagIds
          const categoryId = first === undefined ? undefined : categoryOf(first)
          if (categoryId === undefined) return null
          return known({ field: `tag:${categoryId}`, operator: rule.negate ? 'noneOf' : 'anyOf', values: rule.tagIds })
        }
        case 'rank':
          return known({ field: 'rank', operator: rule.negate ? 'noneOf' : 'anyOf', values: rule.rankIds })
        case 'status':
          return known({ field: 'status', operator: rule.negate ? 'isNot' : 'is', values: rule.statuses })
        case 'options':
          return known({ field: `property:${rule.definitionId}`, operator: rule.negate ? 'noneOf' : 'anyOf', values: rule.optionIds })
        case 'empty':
          return known({ field: `property:${rule.definitionId}`, operator: rule.empty ? 'isEmpty' : 'isNotEmpty', values: [] })
        case 'boolean':
          return known({
            field: `property:${rule.definitionId}`,
            operator: 'is',
            values: [rule.value ? BOOLEAN_KEYS.true : BOOLEAN_KEYS.false],
          })
      }
    }
    return { ready, byKey, offered, draftOf }
  }, [ready, allCategories, allTags, allRanks, allDefinitions])
}
