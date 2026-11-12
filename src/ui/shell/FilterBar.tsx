import {
  CommandRankId,
  LeaveTypeId,
  PropertyOptionId,
  SoldierStatus,
  TagId,
  type CommandRank,
  type LeaveType,
  type LeaveTypeGroup,
  type PropertyDefinition,
  type Tag,
  type TagCategory,
  type TagCategoryId,
} from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  BoardLeaveStatus,
  definitionsOf,
  optionsOf,
  liveCategories,
  liveRanks,
  orderedLeaveTypes,
  tagColorOf,
  tagsOfCategory,
  useCommandRanks,
  useLeaveConditions,
  useLeaveTypeGroups,
  useLeaveTypes,
  useModuleAccess,
  useOnlyMissing,
  usePresence,
  usePresenceDay,
  usePropertyDefinitions,
  useTagCategories,
  useTags,
  useBoardFilters,
  useToday,
  useViewFilter,
  withPropertyChip,
  withTagChip,
  type PropertyChip,
  type SoldierConditions,
} from '@logic'
import { ChevronRight, ListFilter, UserMinus, UserX, X } from 'lucide-react'
import { useState, type ReactNode, useEffect } from 'react'
import { Button as AriaButton, Dialog, DialogTrigger, Popover, Switch } from 'react-aria-components'
import { useFilterFocus } from './filterFocus'
import { useIsDesktop } from '../patterns/media'
import { toneOf } from '../theme/palette'
import { CheckList, type Choice, type ChoiceText } from '../primitives/ChoiceList'

// The board's filters (D-131 to D-134, D-173). The bar holds "filter" to add a condition, the "only who is missing"
// switch and the presence button. The row under the bars shows only while a condition is set: a chip per condition,
// and "clear all". A chip opens its values; its "x" removes it. The unit stays in the scope label of the top bar (D-104).

const PILL = 'glass-bar pointer-events-auto inline-flex min-h-touch shrink-0 items-center rounded-pill text-control text-text md:min-h-control'
const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
const POPOVER = 'glass-menu max-h-list w-menu overflow-auto rounded-panel p-md'
/** A control of the bar: its icon alone on a phone, its name still read aloud. */
const BAR_CONTROL =
  'relative inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text md:min-h-control md:bg-inner md:px-md data-hovered:bg-line'

const SEPARATOR = ', '
const LABEL_SEPARATOR = ':'

/** One condition: its name and values open its choices; the "x" removes it. */
function Chip({
  name,
  values,
  onRemove,
  children,
}: {
  readonly name: string
  readonly values: readonly string[]
  readonly onRemove: () => void
  readonly children: ReactNode | null
}) {
  const removeLabel = [t('filters.remove'), name].join(' ')
  // The chip's text is its name: the condition, then every value, cut by the width only (D-131).
  const content = (
    <>
      <span className="text-text-muted">
        {name}
        {values.length === 0 ? null : <span className="sr-only">{LABEL_SEPARATOR}</span>}
      </span>
      {values.length === 0 ? null : <span className="max-w-unit-picker truncate font-semibold">{values.join(SEPARATOR)}</span>}
    </>
  )
  return (
    <div className={`${PILL} gap-2xs ps-md pe-xs`}>
      {children === null ? (
        <span className="inline-flex items-center gap-xs">
          {content}
        </span>
      ) : (
        <DialogTrigger>
          <AriaButton
            className={`inline-flex min-h-touch items-center gap-xs rounded-pill md:min-h-control ${PRESS}`}
          >
            {content}
          </AriaButton>
          <Popover className={POPOVER}>
            <Dialog aria-label={name} className="outline-none">
              {children}
            </Dialog>
          </Popover>
        </DialogTrigger>
      )}
      <AriaButton
        aria-label={removeLabel}
        onPress={onRemove}
        className={`inline-flex size-touch items-center justify-center rounded-pill bg-inner md:size-chip-close ${PRESS}`}
      >
        <X aria-hidden size={10} strokeWidth={3} />
      </AriaButton>
    </div>
  )
}

interface ChipChoices {
  readonly label: ChoiceText
  readonly choices: readonly Choice[]
  readonly selected: readonly string[]
  readonly onChange: (keys: string[]) => void
}

/** A condition the bar can show: its chip when it holds values, and its choices in "+" when it does not. */
interface Condition {
  readonly key: string
  readonly name: string
  readonly values: readonly string[]
  readonly onRemove: () => void
  /** NULL when its values cannot be chosen here (a filter the bar does not read). */
  readonly choices: ChipChoices | null
}

/**
 * "Filter": the conditions not set yet, then the values of the one picked. A picked condition stays open after its
 * first value makes it a chip, so more values can be checked.
 */
function AddCondition({
  conditions,
  all,
  isOpen,
  onOpenChange,
}: {
  readonly conditions: readonly Condition[]
  readonly all: readonly Condition[]
  readonly isOpen: boolean
  readonly onOpenChange: (isOpen: boolean) => void
}) {
  const { bindTrigger } = useFilterFocus()
  const [picked, setPicked] = useState<string | null>(null)
  const isDesktop = useIsDesktop()
  const open = all.find((condition) => condition.key === picked)
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) setPicked(null)
        onOpenChange(next)
      }}
    >
      <AriaButton ref={bindTrigger} aria-label={t('filters.add')} className={`${BAR_CONTROL} ${PRESS}`}>
        <ListFilter aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
        <span aria-hidden className={isDesktop ? '' : 'sr-only'}>
          {t('filters.open')}
        </span>
      </AriaButton>
      <Popover className={POPOVER}>
        <Dialog aria-label={t('filters.add')} className="flex flex-col gap-xs outline-none">
          {open?.choices === undefined || open.choices === null ? (
            <>
              <p className="text-label font-semibold text-text-muted">{t('filters.addTitle')}</p>
              {conditions.map((condition) => (
                <AriaButton
                  key={condition.key}
                  onPress={() => {
                    setPicked(condition.key)
                  }}
                  className={`flex min-h-touch items-center rounded-control px-xs text-start text-control md:min-h-control data-hovered:bg-inner ${PRESS}`}
                >
                  {condition.name}
                </AriaButton>
              ))}
            </>
          ) : (
            <>
              <AriaButton
                onPress={() => {
                  setPicked(null)
                }}
                className={`flex min-h-touch items-center gap-xs self-start rounded-pill px-xs text-label text-text-muted md:min-h-control ${PRESS}`}
              >
                <ChevronRight aria-hidden size={12} />
                {t('filters.back')}
              </AriaButton>
              <CheckList {...open.choices} autoFocus />
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

const named = (key: I18nKey): ChoiceText => ({ key })
const unknownChoice = (key: string): Choice => ({ key, label: named('filters.unavailable') })

/** The choices of one category's tags: its live tags, and any chosen tag the actor no longer sees as live. */
function tagCondition(
  category: TagCategory,
  categories: readonly TagCategory[],
  tags: readonly Tag[],
  selected: readonly TagId[],
  write: (tagIds: readonly TagId[]) => void,
): Condition {
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const live = tagsOfCategory(tags, category.id)
  const extra = selected.filter((tagId) => !live.some((tag) => tag.id === tagId))
  const choices: Choice[] = [
    ...live.map((tag) => ({ key: tag.id, label: { text: tag.name }, dot: toneOf(tagColorOf(tag, categories)).fill })),
    ...extra.map((tagId) => {
      const tag = byId.get(tagId)
      return tag === undefined ? unknownChoice(tagId) : { key: tag.id, label: { text: tag.name }, note: 'soldiers.tagArchived' as const }
    }),
  ]
  const ids = new Set<string>(choices.map((choice) => choice.key))
  return {
    key: `tags:${category.id}`,
    name: category.name,
    values: selected.map((tagId) => byId.get(tagId)?.name ?? t('filters.unavailable')),
    onRemove: () => {
      write([])
    },
    choices: {
      label: { text: category.name },
      choices,
      selected,
      onChange: (keys) => {
        write(selected.filter((tagId) => !ids.has(tagId)).concat(choices.filter((choice) => keys.includes(choice.key)).map((choice) => TagId.parse(choice.key))))
      },
    },
  }
}

const BOOLEAN_KEYS = { true: 'true', false: 'false' } as const
const BOOLEAN_CHOICES: readonly Choice[] = [
  { key: BOOLEAN_KEYS.true, label: named('properties.yes') },
  { key: BOOLEAN_KEYS.false, label: named('properties.no') },
]

/** Whether the bar reads a chip of this definition (D-177): a soldier property, of the type the chip is written for. */
function chipFits(definition: PropertyDefinition, chip: PropertyChip): boolean {
  if (definition.entity_type !== 'soldier') return false
  if (chip.kind === 'boolean') return definition.data_type === 'boolean'
  return definition.data_type === 'select' || definition.data_type === 'multi_select'
}

/**
 * The condition of one property the bar reads (D-177): its live options, and any chosen option it no longer holds, for
 * a select or multi-select property; yes or no for a yes / no property, one answer at a time. NULL for other types.
 */
function propertyCondition(
  definition: PropertyDefinition,
  chip: PropertyChip | null,
  write: (chip: PropertyChip | null) => void,
): Condition | null {
  const remove = () => {
    write(null)
  }
  if (definition.data_type === 'boolean') {
    const selected: readonly string[] = chip?.kind === 'boolean' ? [chip.value ? BOOLEAN_KEYS.true : BOOLEAN_KEYS.false] : []
    return {
      key: `property:${definition.id}`,
      name: definition.label,
      values: selected.map((key) => t(key === BOOLEAN_KEYS.true ? 'properties.yes' : 'properties.no')),
      onRemove: remove,
      choices: {
        label: { text: definition.label },
        choices: BOOLEAN_CHOICES,
        selected,
        onChange: (keys) => {
          // One answer at a time: the newly checked one replaces the other.
          const next = keys.find((key) => !selected.includes(key)) ?? keys[0]
          write(next === undefined ? null : { kind: 'boolean', definitionId: definition.id, value: next === BOOLEAN_KEYS.true })
        },
      },
    }
  }
  if (definition.data_type !== 'select' && definition.data_type !== 'multi_select') return null
  const options = optionsOf(definition)
  const selected = chip?.kind === 'options' ? chip.optionIds : []
  const optionName = (id: PropertyOptionId) => options.find((option) => option.id === id)?.label ?? t('filters.unavailable')
  const choices: Choice[] = [
    ...options.map((option) => ({
      key: option.id,
      label: { text: option.label },
      ...(option.color_key === null ? {} : { dot: toneOf(option.color_key).fill }),
    })),
    ...selected.filter((id) => !options.some((option) => option.id === id)).map(unknownChoice),
  ]
  return {
    key: `property:${definition.id}`,
    name: definition.label,
    values: selected.map(optionName),
    onRemove: remove,
    choices: {
      label: { text: definition.label },
      choices,
      selected,
      onChange: (keys) => {
        const optionIds = choices.filter((choice) => keys.includes(choice.key)).map((choice) => PropertyOptionId.parse(choice.key))
        write(optionIds.length === 0 ? null : { kind: 'options', definitionId: definition.id, optionIds })
      },
    },
  }
}

interface ConditionSets {
  readonly shown: readonly Condition[]
  readonly addable: readonly Condition[]
}

/** The leave conditions (D-132), which live in their own param, whatever the soldier filter is. */
function leaveConditionsOf(
  leaves: ReturnType<typeof useLeaveConditions>,
  allTypes: readonly LeaveType[],
  groups: readonly LeaveTypeGroup[],
): ConditionSets {
  const shown: Condition[] = []
  const addable: Condition[] = []
  // Leave conditions (D-132).
  const LEAVE_STATUS_KEYS: Record<BoardLeaveStatus, I18nKey> = { pending: 'leaves.statusPending', approved: 'leaves.statusApproved' }
  const statuses = leaves.conditions.statuses ?? []
  const leaveStatus: Condition = {
    key: 'leaveStatus',
    name: t('filters.leaveStatus'),
    values: statuses.map((value) => t(LEAVE_STATUS_KEYS[value])),
    onRemove: () => {
      leaves.setStatuses([])
    },
    choices: {
      label: named('filters.leaveStatus'),
      choices: BoardLeaveStatus.options.map((value) => ({ key: value, label: named(LEAVE_STATUS_KEYS[value]) })),
      selected: statuses,
      onChange: (keys) => {
        leaves.setStatuses(BoardLeaveStatus.options.filter((value) => keys.includes(value)))
      },
    },
  }
  if (statuses.length > 0) shown.push(leaveStatus)
  else addable.push(leaveStatus)

  const liveTypes = orderedLeaveTypes(groups, allTypes)
  const typeIds = leaves.conditions.type_ids ?? []
  const typeName = (id: LeaveTypeId) => allTypes.find((type) => type.id === id)?.name ?? t('filters.unavailable')
  const typeChoices: Choice[] = [
    ...liveTypes.map((type) => ({ key: type.id, label: { text: type.name }, dot: toneOf(type.color_key).fill })),
    ...typeIds.filter((id) => !liveTypes.some((type) => type.id === id)).map((id) => ({ key: id, label: { text: typeName(id) } })),
  ]
  const leaveType: Condition = {
    key: 'leaveType',
    name: t('filters.leaveType'),
    values: typeIds.map(typeName),
    onRemove: () => {
      leaves.setTypes([])
    },
    choices: {
      label: named('filters.leaveType'),
      choices: typeChoices,
      selected: typeIds,
      onChange: (keys) => {
        leaves.setTypes(typeChoices.filter((choice) => keys.includes(choice.key)).map((choice) => LeaveTypeId.parse(choice.key)))
      },
    },
  }
  if (typeIds.length > 0) shown.push(leaveType)
  else if (typeChoices.length > 0) addable.push(leaveType)

  return { shown, addable }
}

function useConditions(): ConditionSets {
  const filter = useViewFilter()
  const leaves = useLeaveConditions()
  const categories = useTagCategories()
  const tags = useTags()
  const ranks = useCommandRanks()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const properties = usePropertyDefinitions()

  const leave = leaveConditionsOf(
    leaves,
    types.status === 'ready' ? types.value : [],
    groups.status === 'ready' ? groups.value : [],
  )
  if (filter.read.kind === 'other') {
    return {
      shown: [{ key: 'other', name: t('filters.other'), values: [], onRemove: filter.clear, choices: null }, ...leave.shown],
      addable: leave.addable,
    }
  }
  const conditions = filter.read.conditions
  const write = (next: SoldierConditions) => {
    filter.setConditions(next)
  }
  const allCategories = categories.status === 'ready' ? categories.value : []
  const allTags = tags.status === 'ready' ? tags.value : []
  const categoryOf = (tagId: TagId): TagCategoryId | undefined => allTags.find((tag) => tag.id === tagId)?.category_id

  const shown: Condition[] = []
  const addable: Condition[] = []

  // Tags: one chip per category (D-131).
  const usedCategories = new Set<TagCategoryId>()
  conditions.tagSets.forEach((set, index) => {
    const categoryId = set.map(categoryOf).find((id) => id !== undefined)
    const category = allCategories.find((candidate) => candidate.id === categoryId)
    if (category === undefined) {
      const removeSet = () => {
        write({ ...conditions, tagSets: conditions.tagSets.filter((_, at) => at !== index) })
      }
      shown.push({ key: `tags:${String(index)}`, name: t('filters.unavailable'), values: set.map(() => t('filters.unavailable')), onRemove: removeSet, choices: null })
      return
    }
    usedCategories.add(category.id)
    shown.push({
      ...tagCondition(category, allCategories, allTags, set, (tagIds) => {
        write(withTagChip(conditions, categoryOf, category.id, tagIds))
      }),
      key: `tags:${String(index)}`,
    })
  })
  for (const category of liveCategories(allCategories)) {
    if (usedCategories.has(category.id) || tagsOfCategory(allTags, category.id).length === 0) continue
    addable.push(
      tagCondition(category, allCategories, allTags, [], (tagIds) => {
        write(withTagChip(conditions, categoryOf, category.id, tagIds))
      }),
    )
  }

  // Properties of soldiers (D-177): a chip per property, a chosen one kept by its name after it is archived.
  const allDefinitions = properties.status === 'ready' ? properties.value : []
  for (const chip of conditions.properties) {
    const definition = allDefinitions.find((candidate) => candidate.id === chip.definitionId)
    const write = (next: PropertyChip | null) => {
      filter.setConditions(withPropertyChip(conditions, chip.definitionId, next))
    }
    const condition = definition === undefined || !chipFits(definition, chip) ? null : propertyCondition(definition, chip, write)
    shown.push(
      condition ?? {
        key: `property:${chip.definitionId}`,
        name: t('filters.unavailable'),
        values: [],
        onRemove: () => {
          write(null)
        },
        choices: null,
      },
    )
  }
  for (const definition of definitionsOf(allDefinitions, 'soldier')) {
    if (conditions.properties.some((chip) => chip.definitionId === definition.id)) continue
    const condition = propertyCondition(definition, null, (next) => {
      filter.setConditions(withPropertyChip(conditions, definition.id, next))
    })
    if (condition !== null && condition.choices !== null && condition.choices.choices.length > 0) addable.push(condition)
  }

  // Rank.
  const allRanks: readonly CommandRank[] = ranks.status === 'ready' ? ranks.value : []
  const rankName = (id: CommandRankId) => allRanks.find((rank) => rank.id === id)?.title ?? t('filters.unavailable')
  const rankChoices: Choice[] = [
    ...liveRanks(allRanks).map((rank) => ({ key: rank.id, label: { text: rank.title } })),
    ...conditions.rankIds.filter((id) => !liveRanks(allRanks).some((rank) => rank.id === id)).map((id) => ({ key: id, label: { text: rankName(id) } })),
  ]
  const rank: Condition = {
    key: 'rank',
    name: t('filters.rank'),
    values: conditions.rankIds.map(rankName),
    onRemove: () => {
      write({ ...conditions, rankIds: [] })
    },
    choices: {
      label: named('filters.rank'),
      choices: rankChoices,
      selected: conditions.rankIds,
      onChange: (keys) => {
        write({ ...conditions, rankIds: rankChoices.filter((choice) => keys.includes(choice.key)).map((choice) => CommandRankId.parse(choice.key)) })
      },
    },
  }
  if (conditions.rankIds.length > 0) shown.push(rank)
  else if (rankChoices.length > 0) addable.push(rank)

  // Soldier status (D-131).
  const STATUS_KEYS: Record<SoldierStatus, I18nKey> = { active: 'soldiers.statusActive', inactive: 'soldiers.statusInactive' }
  const status: Condition = {
    key: 'status',
    name: t('filters.status'),
    values: conditions.statuses.map((value) => t(STATUS_KEYS[value])),
    onRemove: () => {
      write({ ...conditions, statuses: [] })
    },
    choices: {
      label: named('filters.status'),
      choices: SoldierStatus.options.map((value) => ({ key: value, label: named(STATUS_KEYS[value]) })),
      selected: conditions.statuses,
      onChange: (keys) => {
        write({ ...conditions, statuses: SoldierStatus.options.filter((value) => keys.includes(value)) })
      },
    },
  }
  if (conditions.statuses.length > 0) shown.push(status)
  else addable.push(status)

  return { shown: [...shown, ...leave.shown], addable: [...addable, ...leave.addable] }
}

/** "Only who is missing" (D-133): the switch's track, and its name beside it from a desktop. */
export function OnlyMissingSwitch() {
  const missing = useOnlyMissing()
  const isDesktop = useIsDesktop()
  return (
    <Switch isSelected={missing.on} onChange={missing.set} className={`group ${BAR_CONTROL} gap-sm ${PRESS}`}>
      {isDesktop ? null : <UserMinus aria-hidden size={18} className="text-text-muted" />}
      <span aria-hidden className="flex h-icon w-control shrink-0 items-center rounded-pill border border-line bg-inner p-2xs group-data-selected:border-action-solid group-data-selected:bg-action-solid">
        <span className="size-dot rounded-pill bg-text-muted group-data-selected:ms-auto group-data-selected:bg-on-action" />
      </span>
      <span className={isDesktop ? '' : 'sr-only'}>{t('filters.onlyMissing')}</span>
    </Switch>
  )
}

/** How many are missing today, under the board's filter; it opens the lists of today (D-134). */
export function PresenceButton() {
  const access = useModuleAccess()
  const today = useToday()
  const { filter } = useViewFilter()
  const presence = usePresence(today, filter)
  const { openToday } = usePresenceDay()
  const isDesktop = useIsDesktop()
  if (!access.soldiers || presence.status !== 'ready') return null
  return (
    <AriaButton onPress={openToday} className={`${BAR_CONTROL} ${PRESS}`}>
      <UserX aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span className={isDesktop ? 'text-text-muted' : 'sr-only'}>{t('presence.missingToday')}</span>
      <span
        className={`${isDesktop ? '' : 'absolute end-none top-xs bg-inner'} inline-flex min-w-icon items-center justify-center rounded-pill px-xs font-bold tabular-nums ${isDesktop ? '' : 'text-micro'}`}
      >
        {presence.value.absent.length}
      </span>
    </AriaButton>
  )
}

/** "Filter" in the bar: the conditions not set yet. Absent when there is nothing left to add (D-076). */
export function FilterControl() {
  const { shown, addable } = useConditions()
  // It stays while its popover is open, so the condition picked there keeps its values in sight after it is set.
  const [adding, setAdding] = useState(false)
  if (addable.length === 0 && !adding) return null
  return <AddCondition conditions={addable} all={[...shown, ...addable]} isOpen={adding} onOpenChange={setAdding} />
}

/** The row of set conditions, with "clear all"; it exists only while a condition is set (D-173). */
export function FilterBar() {
  const { shown } = useConditions()
  const { active, clearAll } = useBoardFilters()
  const focus = useFilterFocus()
  // A press that empties the row takes its control away with it, so focus moves on to "filter" in the bar.
  useEffect(() => {
    if (!active) focus.restore()
  }, [active, focus])
  if (!active) return null
  return (
    <search
      aria-label={t('filters.bar')}
      // The row scrolls sideways on a phone. Its room above and below keeps the chips' shadows whole, and lets presses
      // through to the board: only the chips take them.
      className="pointer-events-none -my-xl flex max-w-full items-center gap-sm overflow-x-auto px-2xs py-xl"
    >
      {shown.map((condition) => (
        <Chip
          key={condition.key}
          name={condition.name}
          values={condition.values}
          onRemove={() => {
            if (shown.length === 1) focus.request()
            condition.onRemove()
          }}
        >
          {condition.choices === null ? null : <CheckList {...condition.choices} autoFocus />}
        </Chip>
      ))}
      <AriaButton
        onPress={() => {
          focus.request()
          clearAll()
        }}
        className={`${PILL} gap-xs px-md font-semibold ${PRESS}`}
      >
        <X aria-hidden size={12} strokeWidth={2.6} />
        {t('filters.clearAll')}
      </AriaButton>
    </search>
  )
}
