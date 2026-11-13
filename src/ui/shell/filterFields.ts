import {
  CalendarDate,
  CommandRankId,
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
  fullName,
  liveCategories,
  liveRanks,
  optionsOf,
  tagColorOf,
  tagsOfCategory,
  useCommandRanks,
  usePropertyDefinitions,
  useTagCategories,
  useTags,
  useSoldiers,
  useUnits,
  type CompareOperator,
  type FilterRule,
} from '@logic'
import { useMemo } from 'react'
import { toneOf } from '../theme/palette'
import type { Choice } from '../primitives/ChoiceList'
import { formatDate } from '../patterns/dates'

// The soldier fields of the rule builder (D-312): what a rule may filter by, its operators and its values, and the way
// between a rule of the URL and a row of the builder. Every field reads its values from the data, never a list here.

export const OPERATORS = [
  'anyOf',
  'noneOf',
  'is',
  'isNot',
  'contains',
  'greaterThan',
  'greaterOrEqual',
  'lessThan',
  'lessOrEqual',
  'before',
  'onOrBefore',
  'after',
  'onOrAfter',
  'isEmpty',
  'isNotEmpty',
] as const
export type Operator = (typeof OPERATORS)[number]

export const OPERATOR_LABELS: Record<Operator, I18nKey> = {
  anyOf: 'filters.operators.anyOf',
  noneOf: 'filters.operators.noneOf',
  is: 'filters.operators.is',
  isNot: 'filters.operators.isNot',
  contains: 'filters.operators.contains',
  greaterThan: 'filters.operators.greaterThan',
  greaterOrEqual: 'filters.operators.greaterOrEqual',
  lessThan: 'filters.operators.lessThan',
  lessOrEqual: 'filters.operators.lessOrEqual',
  before: 'filters.operators.before',
  onOrBefore: 'filters.operators.onOrBefore',
  after: 'filters.operators.after',
  onOrAfter: 'filters.operators.onOrAfter',
  isEmpty: 'filters.operators.isEmpty',
  isNotEmpty: 'filters.operators.isNotEmpty',
}

/** The operator a compared value is written with (D-380); a date's "before" is "less than". */
const COMPARE_OF: Partial<Record<Operator, CompareOperator>> = {
  is: 'equals',
  isNot: 'not_equals',
  contains: 'contains',
  greaterThan: 'greater_than',
  greaterOrEqual: 'greater_or_equal',
  lessThan: 'less_than',
  lessOrEqual: 'less_or_equal',
  before: 'less_than',
  onOrBefore: 'less_or_equal',
  after: 'greater_than',
  onOrAfter: 'greater_or_equal',
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

/** How a row takes its value: chosen from a list, or typed (D-380). */
export type FieldInput = 'choices' | 'text' | 'number' | 'date'

export interface FilterField {
  readonly key: string
  readonly name: string
  /** Where its row lives: a soldier rule, or a leave condition (D-382). */
  readonly entity: 'soldier' | 'leave'
  readonly input: FieldInput
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
    entity: 'soldier',
    input: 'choices',
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
    entity: 'soldier',
    input: 'choices',
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
  entity: 'soldier',
  input: 'choices',
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

/** The live soldiers or units a reference property chooses from (D-380). */
export interface RefChoices {
  readonly soldiers: readonly Choice[]
  readonly units: readonly Choice[]
}

/** The typed value a compared rule writes: NULL while it is not one, so the row lives only in the builder (D-380). */
function typedValue(input: FieldInput, raw: string | undefined): string | number | null {
  if (raw === undefined || raw.trim() === '') return null
  if (input === 'number') {
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
  if (input === 'date') return safe(CalendarDate)(raw)
  return raw
}

const INPUT_OF: Partial<Record<PropertyDefinition['data_type'], FieldInput>> = { text: 'text', number: 'number', date: 'date' }

/**
 * A property the builder filters by (D-312, D-380): select, multi-select, soldier and unit by their choices, yes / no by
 * its answer or by having none (D-322), text, number and date by a typed value. A unit property reads the soldier's
 * primary unit (D-381) and names its entity; a leave property is a leave condition (D-382).
 */
function propertyField(definition: PropertyDefinition, refs: RefChoices): FilterField | null {
  const key = `property:${definition.id}`
  const definitionId = definition.id
  const entity = definition.entity_type === 'leave' ? 'leave' : 'soldier'
  const name = definition.entity_type === 'unit' ? `${definition.label} (${t('filters.ofUnit')})` : definition.label
  const base = { key, name, entity } as const
  const emptyRule = (operator: Operator): FilterRule => ({ kind: 'empty', definitionId, empty: operator === 'isEmpty' })
  if (definition.data_type === 'boolean') {
    return {
      ...base,
      input: 'choices',
      operators: ['is', 'isEmpty', 'isNotEmpty'],
      single: true,
      choicesOf: () => [...BOOLEAN_CHOICES],
      ruleOf: (operator, values) => {
        if (!takesValues(operator)) return emptyRule(operator)
        const [value] = values
        return value === undefined ? null : { kind: 'boolean', definitionId, value: value === BOOLEAN_KEYS.true }
      },
      labelOf: (value) => t(value === BOOLEAN_KEYS.true ? 'properties.yes' : 'properties.no'),
      inert: () => false,
    }
  }
  const input = INPUT_OF[definition.data_type]
  if (input !== undefined) {
    const operators: readonly Operator[] =
      input === 'text'
        ? ['contains', 'is', 'isNot', 'isEmpty', 'isNotEmpty']
        : input === 'number'
          ? ['is', 'isNot', 'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'isEmpty', 'isNotEmpty']
          : ['is', 'isNot', 'before', 'onOrBefore', 'after', 'onOrAfter', 'isEmpty', 'isNotEmpty']
    return {
      ...base,
      input,
      operators,
      single: true,
      choicesOf: () => [],
      ruleOf: (operator, values) => {
        const compare = COMPARE_OF[operator]
        if (!takesValues(operator) || compare === undefined) return emptyRule(operator)
        return { kind: 'compare', definitionId, operator: compare, value: typedValue(input, values[0]) }
      },
      labelOf: (value) => {
        const date = input === 'date' ? safe(CalendarDate)(value) : null
        return date === null ? value : formatDate(date)
      },
      inert: () => false,
    }
  }
  const live: Choice[] =
    definition.data_type === 'soldier_ref'
      ? [...refs.soldiers]
      : definition.data_type === 'unit_ref'
        ? [...refs.units]
        : optionsOf(definition).map((option) => ({
            key: option.id,
            label: { text: option.label },
            ...(option.color_key === null ? {} : { dot: toneOf(option.color_key).fill }),
          }))
  const textOf = (value: string) => {
    const label = live.find((choice) => choice.key === value)?.label
    return label === undefined || !('text' in label) ? null : label.text
  }
  return {
    ...base,
    input: 'choices',
    operators: ['anyOf', 'noneOf', 'isEmpty', 'isNotEmpty'],
    single: false,
    choicesOf: (values) => withExtras(live, values, unknownChoice),
    ruleOf: (operator, values) =>
      takesValues(operator) ? { kind: 'options', definitionId, negate: negated(operator), ids: [...values] } : emptyRule(operator),
    labelOf: (value) => textOf(value) ?? t('filters.unavailable'),
    inert: (value) => textOf(value) === null,
  }
}

export interface FilterFields {
  /** Whether the tags, ranks and properties have loaded: before, a rule's field is not known yet (OI-261). */
  readonly ready: boolean
  readonly byKey: ReadonlyMap<string, FilterField>
  /** The fields a new row may pick: the live ones that hold a value to choose or take a typed one. */
  readonly offered: readonly FilterField[]
  /** The leave properties a leave condition may pick (D-382). */
  readonly leaveOffered: readonly FilterField[]
  /** The row of a rule; NULL when its field is not one the builder knows, so the row can only be removed. */
  draftOf(rule: FilterRule): Draft | null
}

export function useFilterFields(): FilterFields {
  const categories = useTagCategories()
  const tags = useTags()
  const ranks = useCommandRanks()
  const properties = usePropertyDefinitions()
  const soldiers = useSoldiers()
  const units = useUnits()
  const allSoldiers = soldiers.status === 'ready' ? soldiers.value : null
  const allUnits = units.status === 'ready' ? units.value : null
  const allCategories = categories.status === 'ready' ? categories.value : null
  const allTags = tags.status === 'ready' ? tags.value : null
  const allRanks = ranks.status === 'ready' ? ranks.value : null
  const allDefinitions = properties.status === 'ready' ? properties.value : null
  const ready = [categories, tags, ranks, properties, soldiers, units].every((query) => query.status !== 'loading')
  return useMemo(() => {
    const categoryList = allCategories ?? []
    const tagList = allTags ?? []
    const rankList = allRanks ?? []
    const definitions = allDefinitions ?? []
    const refs: RefChoices = {
      soldiers: (allSoldiers ?? []).map((soldier) => ({ key: soldier.id, label: { text: fullName(soldier) } })),
      units: (allUnits ?? []).map((unit) => ({ key: unit.id, label: { text: unit.name } })),
    }
    const byKey = new Map<string, FilterField>()
    const offered: FilterField[] = []
    const leaveOffered: FilterField[] = []
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
    const entities = ['soldier', 'unit', 'leave'] as const
    for (const definition of entities.flatMap((entity) => definitionsOf(definitions, entity))) {
      const field = propertyField(definition, refs)
      if (field === null) continue
      byKey.set(field.key, field)
      if (field.input === 'choices' && field.choicesOf([]).length === 0) continue
      ;(field.entity === 'leave' ? leaveOffered : offered).push(field)
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
          return known({ field: `property:${rule.definitionId}`, operator: rule.negate ? 'noneOf' : 'anyOf', values: rule.ids })
        case 'empty':
          return known({ field: `property:${rule.definitionId}`, operator: rule.empty ? 'isEmpty' : 'isNotEmpty', values: [] })
        case 'boolean':
          return known({
            field: `property:${rule.definitionId}`,
            operator: 'is',
            values: [rule.value ? BOOLEAN_KEYS.true : BOOLEAN_KEYS.false],
          })
        case 'compare': {
          const field = `property:${rule.definitionId}`
          const operator = byKey.get(field)?.operators.find((candidate) => COMPARE_OF[candidate] === rule.operator)
          if (operator === undefined) return null
          return known({ field, operator, values: rule.value === null ? [] : [String(rule.value)] })
        }
      }
    }
    return { ready, byKey, offered, leaveOffered, draftOf }
  }, [ready, allCategories, allTags, allRanks, allDefinitions, allSoldiers, allUnits])
}
