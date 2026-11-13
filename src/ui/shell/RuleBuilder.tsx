import { BOARD_SORT_KEYS, SORT_ORDERS, SORTABLE_PROPERTY_TYPES, type BoardSortKey, type SortOrder } from '@config'
import { LeaveTypeId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  BoardLeaveStatus,
  definitionsOf,
  orderedLeaveTypes,
  useLeaveConditions,
  useLeaveTypeGroups,
  useLeaveTypes,
  useOnlyMissing,
  usePropertyDefinitions,
  useSortRules,
  useViewFilter,
  NO_RULES,
  readRules,
  writeRules,
  type FilterRule,
  type SoldierFilter,
  type ReadRules,
  type RuleMatch,
  type SortRule,
  type SortTarget,
} from '@logic'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components'
import { Drawer } from '../patterns/Drawer'
import { IconButton } from '../primitives/Button'
import { CheckList, RadioList, type Choice } from '../primitives/ChoiceList'
import { leaveTypeToneOf } from '../theme/palette'
import type { BuilderTarget } from './builderOpen'
import { OPERATOR_LABELS, takesValues, useFilterFields, type Draft, type FilterFields, type Operator } from './filterFields'

// "Filter and sort" (D-312, D-313): the soldier rules as rows of field · operator · values joined by וגם or או, the
// leave conditions and "only who is missing" after them, one of each, and the sort rules as rows of property ·
// direction. Every change writes the URL at once; a row with no value yet lives only here until it has one.

const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
const CONTROL = `flex min-h-touch min-w-none cursor-pointer items-center justify-between gap-xs rounded-control border border-line bg-surface px-sm text-control text-text outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2`
const ROW = 'flex flex-col gap-xs rounded-panel border border-line p-sm'
const CONNECTOR = 'min-w-control shrink-0 text-label font-semibold text-text-muted'
const ADD = `inline-flex min-h-touch items-center gap-xs self-start rounded-pill px-sm text-control font-semibold text-text md:min-h-control data-hovered:bg-inner ${PRESS}`
const SEPARATOR = ', '

interface Option<K extends string> {
  readonly key: K
  readonly label: string
}

/** A compact select of the builder: its name is read aloud, its value shows. */
function Pick<K extends string>({
  label,
  value,
  options,
  onChange,
  grow = false,
}: {
  readonly label: string
  readonly value: K
  readonly options: readonly Option<K>[]
  readonly onChange: (key: K) => void
  readonly grow?: boolean
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(key) => {
        const next = options.find((option) => option.key === key)
        if (next !== undefined) onChange(next.key)
      }}
      className={grow ? 'min-w-none flex-1' : 'shrink-0'}
    >
      <AriaButton className={`${CONTROL} w-full`}>
        <SelectValue className="truncate" />
        <ChevronDown aria-hidden size={14} className="shrink-0 text-text-muted" />
      </AriaButton>
      <Popover className="glass-menu min-w-trigger overflow-auto rounded-panel">
        <ListBox className="max-h-list overflow-auto p-xs outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option.key}
              id={option.key}
              textValue={option.label}
              className="flex min-h-touch cursor-pointer items-center rounded-control px-md text-control outline-none data-focused:bg-inner data-selected:font-semibold md:min-h-control"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

/** The values of a row: what is chosen, opening the choices. */
function Values({
  name,
  choices,
  selected,
  single,
  onChange,
  autoFocus,
}: {
  readonly name: string
  readonly choices: readonly Choice[]
  readonly selected: readonly string[]
  readonly single: boolean
  readonly onChange: (values: readonly string[]) => void
  readonly autoFocus: boolean
}) {
  const textOf = (key: string) => {
    const label = choices.find((choice) => choice.key === key)?.label
    return label === undefined ? t('filters.unavailable') : 'text' in label ? label.text : t(label.key)
  }
  const shown = selected.map(textOf).join(SEPARATOR)
  return (
    <DialogTrigger>
      <AriaButton autoFocus={autoFocus} aria-label={[t('filters.values'), name, shown].join(' ')} className={`${CONTROL} min-w-none flex-1`}>
        <span className={shown === '' ? 'truncate text-text-muted' : 'truncate font-semibold'}>
          {shown === '' ? t('filters.chooseValues') : shown}
        </span>
        <ChevronDown aria-hidden size={14} className="shrink-0 text-text-muted" />
      </AriaButton>
      <Popover className="glass-menu max-h-list w-menu overflow-auto rounded-panel p-md">
        <Dialog aria-label={name} className="outline-none">
          {single ? (
            <RadioList
              label={{ text: name }}
              choices={choices}
              selected={selected[0] ?? null}
              onChange={(key) => {
                onChange(key === null ? [] : [key])
              }}
            />
          ) : (
            <CheckList label={{ text: name }} choices={choices} selected={selected} onChange={onChange} autoFocus />
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

function RemoveButton({ labelKey, onPress, autoFocus = false }: { readonly labelKey: I18nKey; readonly onPress: () => void; readonly autoFocus?: boolean }) {
  return (
    <IconButton labelKey={labelKey} onPress={onPress} autoFocus={autoFocus}>
      <X aria-hidden size={16} />
    </IconButton>
  )
}

const LEAVE_FIELDS = ['leaveStatus', 'leaveType'] as const
type LeaveField = (typeof LEAVE_FIELDS)[number]
const LEAVE_FIELD_LABELS: Record<LeaveField, I18nKey> = { leaveStatus: 'filters.leaveStatus', leaveType: 'filters.leaveType' }
const LEAVE_STATUS_KEYS: Record<BoardLeaveStatus, I18nKey> = { pending: 'leaves.statusPending', approved: 'leaves.statusApproved' }
const MATCH_LABELS: Record<RuleMatch, I18nKey> = { all: 'filters.and', any: 'filters.or' }

type Row = { readonly id: number; readonly draft: Draft } | { readonly id: number; readonly kept: FilterRule }

interface Rows {
  readonly match: RuleMatch
  readonly rows: readonly Row[]
  readonly nextId: number
  /** The URL's rules the rows hold, as a key; NULL before the fields load (OI-261). */
  readonly read: string | null
  /** The key of the rules the rows last wrote, until the URL reads it back: the URL changes after the write. */
  readonly wrote: string | null
}

const NO_ROWS: Rows = { match: 'all', rows: [], nextId: 0, read: null, wrote: null }

const keyOf = (read: ReadRules) => JSON.stringify(read)

/** The rows of the URL's rules; a filter the builder does not read starts empty (D-312). Ids go on from `nextId`. */
function rowsOf(read: ReadRules, fields: FilterFields, nextId: number): Rows {
  const { rules, match } = read.kind === 'rules' ? read.filter : NO_RULES
  const rows = rules.map((rule, at): Row => {
    const id = nextId + at
    const draft = fields.draftOf(rule)
    return draft === null ? { id, kept: rule } : { id, draft }
  })
  return { match, rows, nextId: nextId + rows.length, read: keyOf(read), wrote: null }
}

function Connector({ index, match, onMatch }: { readonly index: number; readonly match: RuleMatch; readonly onMatch: ((match: RuleMatch) => void) | null }) {
  if (index === 0) return <span className={CONNECTOR}>{t('filters.where')}</span>
  if (index === 1 && onMatch !== null) {
    return (
      <Pick
        label={t('filters.match')}
        value={match}
        options={(['all', 'any'] as const).map((key) => ({ key, label: t(MATCH_LABELS[key]) }))}
        onChange={onMatch}
      />
    )
  }
  return <span className={CONNECTOR}>{t(MATCH_LABELS[onMatch === null ? 'all' : match])}</span>
}

function FilterSection({ target }: { readonly target: BuilderTarget }) {
  const filter = useViewFilter()
  const fields = useFilterFields()
  const leaves = useLeaveConditions()
  const missing = useOnlyMissing()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const unitId = filter.rules.kind === 'rules' ? filter.rules.filter.unitId : null
  // The rows follow the URL: built once the fields load, so no rule is read as "other" for want of its field, and
  // built again when the URL changes from outside (back, forward, a chip). A row still without a value lives only here,
  // and is lost only then (OI-261).
  const [held, setHeld] = useState<Rows>(NO_ROWS)
  const urlKey = keyOf(filter.rules)
  let state = held
  if (fields.ready && held.read !== urlKey) {
    // The URL reading back the rows' own write keeps the rows; any other change builds them again.
    state = held.wrote === urlKey ? { ...held, read: urlKey, wrote: null } : rowsOf(filter.rules, fields, held.nextId)
    setHeld(state)
  }
  const [leaveDrafts, setLeaveDrafts] = useState<Readonly<Record<LeaveField, boolean>>>({ leaveStatus: false, leaveType: false })

  const write = (next: Rows) => {
    const written: SoldierFilter = {
      unitId,
      match: next.match,
      rules: next.rows.flatMap((row) => {
        if ('kept' in row) return [row.kept]
        return fields.byKey.get(row.draft.field)?.ruleOf(row.draft.operator, row.draft.values) ?? []
      }),
    }
    // The key is the URL's as it will read back, so the rows are not built again from their own write. Until the
    // URL changes, its old key still matches the rows.
    const wrote = keyOf(readRules(writeRules(written) ?? null))
    setHeld({ ...next, wrote: wrote === next.read ? null : wrote })
    filter.setRules(written)
  }
  const replace = (id: number, draft: Draft) => {
    write({ ...state, rows: state.rows.map((row) => (row.id === id ? { id, draft } : row)) })
  }
  const remove = (id: number) => {
    write({ ...state, rows: state.rows.filter((row) => row.id !== id) })
  }

  const statuses = leaves.conditions.statuses ?? []
  const typeIds = leaves.conditions.type_ids ?? []
  const leaveShown: Record<LeaveField, boolean> = {
    leaveStatus: statuses.length > 0 || leaveDrafts.leaveStatus,
    leaveType: typeIds.length > 0 || leaveDrafts.leaveType,
  }
  const freeLeaveFields = LEAVE_FIELDS.filter((field) => !leaveShown[field])
  const allTypes = types.status === 'ready' ? types.value : []
  const liveTypes = orderedLeaveTypes(groups.status === 'ready' ? groups.value : [], allTypes)
  const typeChoices: Choice[] = [
    ...liveTypes.map((type) => ({ key: type.id, label: { text: type.name }, dot: leaveTypeToneOf(type.color_key).fill })),
    ...typeIds
      .filter((id) => !liveTypes.some((type) => type.id === id))
      .map((id): Choice => {
        const name = allTypes.find((type) => type.id === id)?.name
        return { key: id, label: name === undefined ? { key: 'filters.unavailable' } : { text: name } }
      }),
  ]
  const leaveRows = LEAVE_FIELDS.filter((field) => leaveShown[field])
  const rowCount = state.rows.length + leaveRows.length

  const addRow = () => {
    const [field] = fields.offered
    if (field === undefined) return
    const [operator] = field.operators
    if (operator === undefined) return
    write({ ...state, rows: [...state.rows, { id: state.nextId, draft: { field: field.key, operator, values: [] } }], nextId: state.nextId + 1 })
  }

  return (
    <section aria-labelledby="builder-filters" className="flex flex-col gap-sm">
      <h3 id="builder-filters" className="text-label font-semibold text-text-muted">
        {t('filters.filterSection')}
      </h3>
      {state.rows.map((row, index) => {
        const connector = (
          <Connector
            index={index}
            match={state.match}
            onMatch={(match) => {
              write({ ...state, match })
            }}
          />
        )
        const focused = target.kind === 'rule' && target.index === index
        if ('kept' in row) {
          return (
            <div key={row.id} className={ROW}>
              <div className="flex items-center gap-xs">
                {connector}
                <span className="min-w-none flex-1 truncate text-control text-text-muted">{t('filters.other')}</span>
                <RemoveButton
                  labelKey="filters.remove"
                  autoFocus={focused}
                  onPress={() => {
                    remove(row.id)
                  }}
                />
              </div>
            </div>
          )
        }
        const field = fields.byKey.get(row.draft.field)
        if (field === undefined) return null
        const fieldOptions: Option<string>[] = [
          ...(fields.offered.includes(field) ? [] : [{ key: field.key, label: field.name }]),
          ...fields.offered.map((offered) => ({ key: offered.key, label: offered.name })),
          ...freeLeaveFields.map((leaveField) => ({ key: leaveField, label: t(LEAVE_FIELD_LABELS[leaveField]) })),
        ]
        return (
          <div key={row.id} className={ROW}>
            <div className="flex items-center gap-xs">
              {connector}
              <Pick
                grow
                label={t('filters.field')}
                value={field.key}
                options={fieldOptions}
                onChange={(key) => {
                  const leaveField = LEAVE_FIELDS.find((candidate) => candidate === key)
                  if (leaveField !== undefined) {
                    // A leave condition has its own row, one of each (D-312).
                    remove(row.id)
                    setLeaveDrafts({ ...leaveDrafts, [leaveField]: true })
                    return
                  }
                  const next = fields.byKey.get(key)
                  const [operator] = next?.operators ?? []
                  if (next === undefined || operator === undefined) return
                  replace(row.id, { field: next.key, operator, values: [] })
                }}
              />
              <RemoveButton
                labelKey="filters.remove"
                onPress={() => {
                  remove(row.id)
                }}
              />
            </div>
            <div className="flex items-center gap-xs">
              {field.operators.length > 1 ? (
                <Pick
                  label={t('filters.operator')}
                  value={row.draft.operator}
                  options={field.operators.map((operator) => ({ key: operator, label: t(OPERATOR_LABELS[operator]) }))}
                  onChange={(operator: Operator) => {
                    replace(row.id, { ...row.draft, operator, values: takesValues(operator) ? row.draft.values : [] })
                  }}
                />
              ) : (
                <span className={CONNECTOR}>{t(OPERATOR_LABELS[row.draft.operator])}</span>
              )}
              {takesValues(row.draft.operator) ? (
                <Values
                  name={field.name}
                  choices={field.choicesOf(row.draft.values)}
                  selected={row.draft.values}
                  single={field.single}
                  autoFocus={focused}
                  onChange={(values) => {
                    replace(row.id, { ...row.draft, values })
                  }}
                />
              ) : null}
            </div>
          </div>
        )
      })}
      {leaveRows.map((leaveField, at) => {
        const index = state.rows.length + at
        const name = t(LEAVE_FIELD_LABELS[leaveField])
        const close = () => {
          setLeaveDrafts({ ...leaveDrafts, [leaveField]: false })
          if (leaveField === 'leaveStatus') leaves.setStatuses([])
          else leaves.setTypes([])
        }
        return (
          <div key={leaveField} className={ROW}>
            <div className="flex items-center gap-xs">
              <Connector index={index} match="all" onMatch={null} />
              <span className="min-w-none flex-1 truncate text-control font-semibold">{name}</span>
              <RemoveButton labelKey="filters.remove" onPress={close} />
            </div>
            <div className="flex items-center gap-xs">
              <span className={CONNECTOR}>{t(OPERATOR_LABELS[leaveField === 'leaveStatus' ? 'is' : 'anyOf'])}</span>
              {leaveField === 'leaveStatus' ? (
                <Values
                  name={name}
                  choices={BoardLeaveStatus.options.map((value) => ({ key: value, label: { key: LEAVE_STATUS_KEYS[value] } }))}
                  selected={statuses}
                  single={false}
                  autoFocus={target.kind === 'leaveStatus'}
                  onChange={(values) => {
                    leaves.setStatuses(BoardLeaveStatus.options.filter((value) => values.includes(value)))
                  }}
                />
              ) : (
                <Values
                  name={name}
                  choices={typeChoices}
                  selected={typeIds}
                  single={false}
                  autoFocus={target.kind === 'leaveType'}
                  onChange={(values) => {
                    leaves.setTypes(
                      typeChoices.filter((choice) => values.includes(choice.key)).flatMap((choice) => {
                        const id = LeaveTypeId.safeParse(choice.key)
                        return id.success ? [id.data] : []
                      }),
                    )
                  }}
                />
              )}
            </div>
          </div>
        )
      })}
      {missing.on ? (
        <div className={ROW}>
          <div className="flex items-center gap-xs">
            <Connector index={rowCount} match="all" onMatch={null} />
            <span className="min-w-none flex-1 truncate text-control font-semibold">{t('filters.onlyMissing')}</span>
            <RemoveButton
              labelKey="filters.remove"
              autoFocus={target.kind === 'missing'}
              onPress={() => {
                missing.set(false)
              }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-xs">
        {fields.offered.length === 0 ? null : (
          <AriaButton onPress={addRow} className={ADD}>
            <Plus aria-hidden size={14} />
            {t('filters.add')}
          </AriaButton>
        )}
        {/* "Only who is missing" is a suggestion beside "add": one press sets it (D-312). */}
        {missing.on ? null : (
          <AriaButton
            onPress={() => {
              missing.set(true)
            }}
            className={`${ADD} text-text-muted`}
          >
            <Plus aria-hidden size={14} />
            {t('filters.onlyMissing')}
          </AriaButton>
        )}
      </div>
    </section>
  )
}

const SORT_KEY_LABELS: Record<BoardSortKey, I18nKey> = {
  name: 'workspace.sortKeys.name',
  rank: 'workspace.sortKeys.rank',
  seniority: 'workspace.sortKeys.seniority',
  unit: 'workspace.sortKeys.unit',
  absent: 'workspace.sortKeys.absent',
}
const ORDER_LABELS: Record<SortOrder, I18nKey> = { asc: 'workspace.sortOrders.asc', desc: 'workspace.sortOrders.desc' }

interface Target {
  readonly id: string
  readonly target: SortTarget
  readonly label: string
}

const targetIdOf = (target: SortTarget) => ('key' in target ? `key:${target.key}` : `property:${target.property}`)

/** The sort's targets (D-313): the keys of D-214, then the soldier properties of a sortable type. */
function useSortTargets(): readonly Target[] {
  const properties = usePropertyDefinitions()
  const definitions = definitionsOf(properties.status === 'ready' ? properties.value : [], 'soldier')
  const sortable: readonly string[] = SORTABLE_PROPERTY_TYPES
  return [
    ...BOARD_SORT_KEYS.map((key) => ({ id: targetIdOf({ key }), target: { key }, label: t(SORT_KEY_LABELS[key]) })),
    ...definitions
      .filter((definition) => sortable.includes(definition.data_type))
      .map((definition) => ({ id: targetIdOf({ property: definition.id }), target: { property: definition.id }, label: definition.label })),
  ]
}

function ruleWith(target: SortTarget, order: SortOrder): SortRule {
  return 'key' in target ? { key: target.key, order } : { property: target.property, order }
}

function SortSection() {
  const sort = useSortRules()
  const targets = useSortTargets()
  const next = targets.find((candidate) => !sort.rules.some((rule) => targetIdOf(rule) === candidate.id))
  // Focus follows a moved rule to its new slot: the button pressed, or the other one when the move reached an end (OI-260).
  const section = useRef<HTMLElement>(null)
  const moved = useRef<{ readonly index: number; readonly by: -1 | 1 } | null>(null)
  useEffect(() => {
    const at = moved.current
    moved.current = null
    if (at === null) return
    const row = section.current?.querySelector(`[data-sort-slot="${String(at.index)}"]`)
    const pressed = row?.querySelector<HTMLElement>(`[data-move="${String(at.by)}"]:not([disabled])`)
    const other = row?.querySelector<HTMLElement>(`[data-move="${String(-at.by)}"]`)
    ;(pressed ?? other)?.focus()
  }, [sort.rules])
  const move = (index: number, by: -1 | 1) => {
    sort.move(index, by)
    moved.current = { index: index + by, by }
  }
  return (
    <section ref={section} aria-labelledby="builder-sort" className="flex flex-col gap-sm">
      <h3 id="builder-sort" className="text-label font-semibold text-text-muted">
        {t('workspace.sort')}
      </h3>
      {sort.rules.map((rule, index) => {
        const id = targetIdOf(rule)
        const own = targets.find((candidate) => candidate.id === id)
        const options: Option<string>[] = [
          ...(own === undefined ? [{ key: id, label: t('filters.unavailable') }] : []),
          ...targets
            .filter((candidate) => candidate.id === id || !sort.rules.some((held) => targetIdOf(held) === candidate.id))
            .map((candidate) => ({ key: candidate.id, label: candidate.label })),
        ]
        return (
          // A row is keyed by its slot, so picking another target keeps it, and its focus, in place (OI-260).
          <div key={index} data-sort-slot={index} className={`${ROW} flex-row flex-wrap items-center`}>
            <span className={CONNECTOR}>{t(index === 0 ? 'workspace.sortFirst' : 'workspace.sortThen')}</span>
            <Pick
              grow
              label={t('workspace.sortBy')}
              value={id}
              options={options}
              onChange={(key) => {
                const picked = targets.find((candidate) => candidate.id === key)
                if (picked !== undefined) sort.replace(index, ruleWith(picked.target, rule.order))
              }}
            />
            <Pick
              label={t('workspace.sortOrder')}
              value={rule.order}
              options={SORT_ORDERS.map((order) => ({ key: order, label: t(ORDER_LABELS[order]) }))}
              onChange={(order: SortOrder) => {
                sort.replace(index, ruleWith(rule, order))
              }}
            />
            <SortMoves index={index} count={sort.rules.length} move={move} remove={sort.remove} />
          </div>
        )
      })}
      {next === undefined ? null : (
        <AriaButton
          onPress={() => {
            sort.add(next.target)
          }}
          className={ADD}
        >
          <Plus aria-hidden size={14} />
          {t('workspace.addSort')}
        </AriaButton>
      )}
    </section>
  )
}

function SortMoves({
  index,
  count,
  move,
  remove,
}: {
  readonly index: number
  readonly count: number
  readonly move: (index: number, by: -1 | 1) => void
  readonly remove: (index: number) => void
}): ReactNode {
  return (
    <div className="flex items-center">
      <IconButton
        labelKey="workspace.moveUp"
        data-move="-1"
        isDisabled={index === 0}
        onPress={() => {
          move(index, -1)
        }}
      >
        <ChevronUp aria-hidden size={16} />
      </IconButton>
      <IconButton
        labelKey="workspace.moveDown"
        data-move="1"
        isDisabled={index === count - 1}
        onPress={() => {
          move(index, 1)
        }}
      >
        <ChevronDown aria-hidden size={16} />
      </IconButton>
      <RemoveButton
        labelKey="workspace.removeSort"
        onPress={() => {
          remove(index)
        }}
      />
    </div>
  )
}

/** The builder, opened on the whole or on one rule, which it focuses (D-312). */
export function RuleBuilder({ target, onClose }: { readonly target: BuilderTarget; readonly onClose: () => void }) {
  return (
    <Drawer titleKey="filters.builder" onClose={onClose}>
      <div className="flex flex-col gap-xl">
        <FilterSection target={target} />
        <SortSection />
      </div>
    </Drawer>
  )
}
