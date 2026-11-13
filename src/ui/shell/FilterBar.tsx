import { t, type I18nKey } from '@i18n'
import {
  useBoardFilters,
  useLeaveConditions,
  useLeaveTypes,
  useOnlyMissing,
  useViewFilter,
  ruleOfNode,
  type BoardLeaveStatus,
  type FilterRule,
} from '@logic'
import { ListFilter, X } from 'lucide-react'
import { Fragment, useEffect } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useBuilderOpen, type BuilderTarget } from './builderOpen'
import { OPERATOR_LABELS, useFilterFields, type FilterFields } from './filterFields'
import { useFilterFocus } from './filterFocus'
import { useIsDesktop } from '../patterns/media'

// The board's filters (D-131, D-173, D-213, D-312). The bar holds "filter and sort", which opens the builder. The row
// under the bars shows only while a rule is set: a chip per rule, and "clear all". A chip opens its rule in the builder;
// its "x" removes it. The unit stays in the scope label of the top bar (D-104).

const PILL = 'glass-bar pointer-events-auto inline-flex min-h-touch shrink-0 items-center rounded-pill text-control text-text md:min-h-control'
export const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
/** A control of the bar: its icon alone on a phone, its name still read aloud. */
export const BAR_CONTROL =
  'relative inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text md:min-h-control md:bg-inner md:px-md data-hovered:bg-line'

const SEPARATOR = ', '
const LABEL_SEPARATOR = ':'

/** One rule: its text opens it in the builder; the bare "x" removes it (D-314). */
function Chip({
  name,
  qualifier,
  values,
  onOpen,
  onRemove,
}: {
  readonly name: string
  readonly qualifier: string | null
  readonly values: readonly string[]
  readonly onOpen: (() => void) | null
  readonly onRemove: () => void
}) {
  const removeLabel = [t('filters.remove'), name].join(' ')
  // The chip's text is its rule: the field, the operator when it is not plain "any of", then every value (D-131).
  const content = (
    <>
      <span className="text-text-muted">
        {name}
        {qualifier === null ? null : ` ${qualifier}`}
        {values.length === 0 ? null : <span className="sr-only">{LABEL_SEPARATOR}</span>}
      </span>
      {values.length === 0 ? null : <span className="max-w-unit-picker truncate font-semibold">{values.join(SEPARATOR)}</span>}
    </>
  )
  return (
    <div className={`${PILL} gap-2xs ps-md`}>
      {onOpen === null ? (
        <span className="inline-flex items-center gap-xs">{content}</span>
      ) : (
        <AriaButton onPress={onOpen} className={`inline-flex min-h-touch items-center gap-xs rounded-pill md:min-h-control ${PRESS}`}>
          {content}
        </AriaButton>
      )}
      <AriaButton
        aria-label={removeLabel}
        onPress={onRemove}
        className={`inline-flex size-touch items-center justify-center rounded-pill text-text-muted md:size-chip-close data-hovered:text-text ${PRESS}`}
      >
        <X aria-hidden size={14} strokeWidth={2.4} />
      </AriaButton>
    </div>
  )
}

/** "Filter and sort" in the bar: opens the builder on the whole (D-312). */
export function FilterButton() {
  const { bindTrigger } = useFilterFocus()
  const builder = useBuilderOpen()
  const isDesktop = useIsDesktop()
  return (
    <AriaButton
      ref={bindTrigger}
      aria-label={t('filters.builder')}
      onPress={() => {
        builder.open({ kind: 'all' })
      }}
      className={`${BAR_CONTROL} ${PRESS}`}
    >
      <ListFilter aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span aria-hidden className={isDesktop ? '' : 'sr-only'}>
        {t('filters.builder')}
      </span>
    </AriaButton>
  )
}

interface ChipOf {
  readonly key: string
  readonly name: string
  readonly qualifier: string | null
  readonly values: readonly string[]
  readonly target: BuilderTarget | null
  readonly remove: () => void
}

const QUALIFIER_SEPARATOR = ' · '

/** The text of a rule of the URL: its field, its operator when not plain, its values. */
function chipText(rule: FilterRule, fields: FilterFields): Pick<ChipOf, 'name' | 'qualifier' | 'values'> {
  const draft = fields.draftOf(rule)
  const field = draft === null ? undefined : fields.byKey.get(draft.field)
  if (draft === null || field === undefined) return { name: t('filters.unavailable'), qualifier: null, values: [] }
  const plain = draft.operator === 'anyOf' || draft.operator === 'is'
  const operator = plain ? null : t(OPERATOR_LABELS[draft.operator])
  // A "none of" or "is not" whose every value matches nobody keeps everyone; the chip says so (OI-264).
  const negated = draft.operator === 'noneOf' || draft.operator === 'isNot'
  const keepsEveryone = negated && draft.values.length > 0 && draft.values.every(field.inert)
  return {
    name: field.name,
    qualifier: keepsEveryone ? [operator, t('filters.keepsEveryone')].join(QUALIFIER_SEPARATOR) : operator,
    values: draft.values.map(field.labelOf),
  }
}

const LEAVE_STATUS_KEYS: Record<BoardLeaveStatus, I18nKey> = { pending: 'leaves.statusPending', approved: 'leaves.statusApproved' }

function useChips(): { readonly chips: readonly ChipOf[]; readonly any: boolean } {
  const filter = useViewFilter()
  const fields = useFilterFields()
  const leaves = useLeaveConditions()
  const types = useLeaveTypes()
  const missing = useOnlyMissing()
  const read = filter.rules
  const soldier: ChipOf[] =
    read.kind === 'other'
      ? [{ key: 'other', name: t('filters.other'), qualifier: null, values: [], target: null, remove: filter.clear }]
      : read.filter.rules.map((rule, index, rules) => ({
          key: `rule:${String(index)}`,
          ...chipText(rule, fields),
          target: { kind: 'rule', index },
          remove: () => {
            filter.setRules({ ...read.filter, rules: rules.filter((_, at) => at !== index) })
          },
        }))
  const statuses = leaves.conditions.statuses ?? []
  const typeIds = leaves.conditions.type_ids ?? []
  const allTypes = types.status === 'ready' ? types.value : []
  const leave: ChipOf[] = []
  if (statuses.length > 0) {
    leave.push({
      key: 'leaveStatus',
      name: t('filters.leaveStatus'),
      qualifier: null,
      values: statuses.map((status) => t(LEAVE_STATUS_KEYS[status])),
      target: { kind: 'leaveStatus' },
      remove: () => {
        leaves.setStatuses([])
      },
    })
  }
  if (typeIds.length > 0) {
    leave.push({
      key: 'leaveType',
      name: t('filters.leaveType'),
      qualifier: null,
      values: typeIds.map((id) => allTypes.find((type) => type.id === id)?.name ?? t('filters.unavailable')),
      target: { kind: 'leaveType' },
      remove: () => {
        leaves.setTypes([])
      },
    })
  }
  const properties = leaves.conditions.properties ?? []
  for (const [index, node] of properties.entries()) {
    const rule = ruleOfNode(node)
    leave.push({
      key: `leaveProperty:${String(index)}`,
      ...(rule === null ? { name: t('filters.other'), qualifier: null, values: [] } : chipText(rule, fields)),
      target: { kind: 'leaveProperty', index },
      remove: () => {
        leaves.setProperties(properties.filter((_, at) => at !== index))
      },
    })
  }
  const onlyMissing: ChipOf[] = missing.on
    ? [
        {
          key: 'missing',
          name: t('filters.onlyMissing'),
          qualifier: null,
          values: [],
          target: { kind: 'missing' },
          remove: () => {
            missing.set(false)
          },
        },
      ]
    : []
  return {
    chips: [...soldier, ...leave, ...onlyMissing],
    any: filter.rules.kind === 'rules' && filter.rules.filter.match === 'any' ? soldier.length > 1 : false,
  }
}

/** The row of set rules, with "clear all"; it exists only while a rule is set (D-173). */
export function FilterBar() {
  const { chips, any } = useChips()
  const { active, clearAll } = useBoardFilters()
  const builder = useBuilderOpen()
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
      {chips.map((chip, index) => {
        const { target } = chip
        return (
          <Fragment key={chip.key}>
            {/* Soldier rules joined by "or" say so between them (D-312). */}
            {any && index > 0 && chip.key.startsWith('rule:') ? (
              <span className="shrink-0 text-label font-semibold text-text-muted">{t('filters.or')}</span>
            ) : null}
            <Chip
              name={chip.name}
              qualifier={chip.qualifier}
              values={chip.values}
              onOpen={
                target === null
                  ? null
                  : () => {
                      builder.open(target)
                    }
              }
              onRemove={() => {
                if (chips.length === 1) focus.request()
                chip.remove()
              }}
            />
          </Fragment>
        )
      })}
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
