import { BAR_COLOR_MODES, BOARD_GROUP_KEYS, DEFAULT_SORT_ORDER, type BarColorMode, type BoardGroupKey, type BoardSortKey, type RangeKind, type ViewId } from '@config'
import type { CalendarDate, Deployment } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  unitTreeRows,
  useBarColors,
  useBoardFilters,
  useBoardGrouping,
  useDateWindow,
  useSavedViews,
  useSortRules,
  useUnits,
  useViewFilter,
  useWorkspaceSearch,
  type BoardGrouping,
  type SortRule,
} from '@logic'
import { Bookmark, Maximize2, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { OptionsMenu, type OptionAction, type OptionRow } from '../kit/OptionsMenu'
import { formatDate, formatDateRange } from '../patterns/dates'
import { useBuilderOpen } from '../shell/builderOpen'
import { useFocusMode } from '../shell/focusMode'
import { CustomRangeDialog } from '../shell/WindowNavigator'
import { useConditions } from './conditions'

// The board's options (the handoff's board spec, §1.12 and §2; OI-386, D-480): the unit in sight, the range where a
// view has one to choose, the sort, the grouping and the filter, each a row with its value; after a divider, the saved
// views and focus mode. A sort, a grouping or a filter other than the default puts the dot on the menu's icon. What the
// rows do not hold (several sort rules, a field's operator) is one step on, in the builder.

const ICON = 20
const ACTION_ICON = 18
const WORD = ' '

/** The sorts the menu offers (§3): the most senior first, by name, the most days away first. */
const SORT_CHOICES: readonly BoardSortKey[] = ['seniority', 'name', 'absent']
const SORT_LABELS: Record<BoardSortKey, I18nKey> = {
  name: 'workspace.sortKeys.name',
  rank: 'workspace.sortKeys.rank',
  seniority: 'workspace.sortKeys.seniority',
  unit: 'workspace.sortKeys.unit',
  absent: 'workspace.sortKeys.absent',
}
const GROUP_LABELS: Record<BoardGroupKey, I18nKey> = {
  none: 'board.empty',
  unit: 'workspace.groupKeys.unit',
  rank: 'workspace.groupKeys.rank',
}
const COLOR_LABELS: Record<BarColorMode, I18nKey> = { type: 'workspace.colorsByType', uniform: 'workspace.colorsUniform' }
const RANGE_LABELS: Record<Exclude<RangeKind, 'rotation'>, I18nKey> = {
  day: 'workspace.ranges.day',
  week: 'workspace.ranges.week',
  two_weeks: 'workspace.ranges.two_weeks',
  four_weeks: 'workspace.ranges.four_weeks',
  month: 'workspace.ranges.month',
}

/** The ranges a timeline offers (§3: week, month, rotation and a custom range; no two or four weeks). */
const RANGE_CHOICES = ['week', 'month'] as const
const ROTATION = 'rotation:'
const CUSTOM = 'custom'
const ORGANIZATION = 'organization'
const CATEGORY = 'category:'

function groupKeyOf(grouping: BoardGrouping): string {
  return 'key' in grouping ? grouping.key : `${CATEGORY}${grouping.category}`
}

/** The one rule a choice of the menu writes, or NULL when the rules are more than a choice says. */
function sortChoiceOf(rules: readonly SortRule[]): BoardSortKey | null {
  const [first, ...rest] = rules
  if (first === undefined || rest.length > 0 || !('key' in first) || first.order !== DEFAULT_SORT_ORDER[first.key]) return null
  return first.key
}

function rotationDates(rotation: Deployment): string {
  return rotation.end_date === null ? formatDate(rotation.start_date, 'dayMonth') : formatDateRange(rotation.start_date, rotation.end_date)
}

function useUnitRow(): OptionRow | null {
  const units = useUnits()
  const { unit, selectUnit } = useViewFilter()
  const rows = useMemo(() => (units.status === 'ready' ? unitTreeRows(units.value) : []), [units])
  // One unit in sight is the only scope there is: nothing to choose (D-173, D-076).
  if (rows.length < 2) return null
  const roots = rows.filter((row) => row.depth === 0)
  const whole = roots.length === 1 && roots[0] !== undefined ? roots[0].unit.name : t('workspace.wholeOrganization')
  const selected = unit.kind === 'unit' ? unit.unitId : unit.kind === 'organization' ? ORGANIZATION : null
  const value =
    unit.kind === 'organization'
      ? whole
      : unit.kind === 'unit'
        ? (rows.find((row) => row.unit.id === unit.unitId)?.unit.name ?? t('workspace.unitUnavailable'))
        : t('workspace.otherFilter')
  return {
    key: 'unit',
    labelKey: 'board.unit',
    value,
    changed: false,
    choices: {
      selected,
      // The tree's depth shows as a quiet line of the units above, so the words stay whole.
      options: [
        { key: ORGANIZATION, label: whole },
        ...rows.filter((row) => !(roots.length === 1 && row.depth === 0)).map((row) => ({ key: row.unit.id, label: row.unit.name })),
      ],
      onChange: (key) => {
        if (key === ORGANIZATION) {
          selectUnit(null)
          return
        }
        const row = rows.find((candidate) => candidate.unit.id === key)
        if (row !== undefined) selectUnit(row.unit.id)
      },
    },
  }
}

function useRangeRow(view: ViewId, onCustom: () => void): OptionRow | null {
  const { window, rotations, setRange, showRotation } = useDateWindow()
  const { range } = useWorkspaceSearch()
  if (view !== 'timeline' && view !== 'table') return null
  const kind = window?.kind ?? range ?? 'week'
  const rotationLabel = rotations.length === 1 ? t('workspace.rotations') : null
  const newestFirst = rotations.toReversed()
  const selected =
    kind === 'rotation' && window?.rotationId !== null && window?.rotationId !== undefined
      ? `${ROTATION}${window.rotationId}`
      : kind === 'week' || kind === 'month'
        ? kind
        : null
  const value =
    kind === 'rotation'
      ? (rotations.find((rotation) => rotation.id === window?.rotationId)?.name ?? t('workspace.rotations'))
      : kind === 'custom'
        ? window === null
          ? t('workspace.customRange')
          : formatDateRange(window.from, window.to)
        : t(RANGE_LABELS[kind])
  return {
    key: 'range',
    labelKey: 'board.range',
    value,
    changed: false,
    choices: {
      selected,
      options: [
        ...RANGE_CHOICES.map((choice) => ({ key: choice, label: t(RANGE_LABELS[choice]) })),
        ...newestFirst.map((rotation) => ({ key: `${ROTATION}${rotation.id}`, label: rotationLabel ?? rotation.name, detail: rotationDates(rotation) })),
      ],
      onChange: (key) => {
        const rotation = rotations.find((candidate) => `${ROTATION}${candidate.id}` === key)
        if (rotation !== undefined) {
          showRotation(rotation.id)
          return
        }
        const choice = RANGE_CHOICES.find((candidate) => candidate === key)
        if (choice !== undefined) setRange(choice)
      },
    },
    actions: [{ key: CUSTOM, label: t('workspace.customRange'), onPress: onCustom }],
  }
}

function useSortRow(): OptionRow {
  const sort = useSortRules()
  const builder = useBuilderOpen()
  const choice = sortChoiceOf(sort.rules)
  return {
    key: 'sort',
    labelKey: 'board.sort',
    value: choice === null ? t('board.customSort') : t(SORT_LABELS[choice]),
    changed: sort.changed,
    choices: {
      selected: choice,
      options: SORT_CHOICES.map((key) => ({ key, label: t(SORT_LABELS[key]) })),
      onChange: (key) => {
        const picked = SORT_CHOICES.find((candidate) => candidate === key)
        if (picked !== undefined) sort.set([{ key: picked, order: DEFAULT_SORT_ORDER[picked] }])
      },
    },
    actions: [
      {
        key: 'more',
        label: t('board.sortMore'),
        detail: t('board.sortMoreDetail'),
        onPress: () => {
          builder.open({ kind: 'all' })
        },
      },
    ],
  }
}

function useGroupRow(): OptionRow | null {
  const grouping = useBoardGrouping()
  const { group } = useWorkspaceSearch()
  if (grouping.grouping === null) return null
  const shown = grouping.unavailable ?? grouping.grouping
  const category = 'category' in shown ? grouping.categories.find((candidate) => candidate.id === shown.category) : undefined
  const value =
    grouping.unavailable !== null ? t('filters.unavailable') : 'key' in shown ? t(GROUP_LABELS[shown.key]) : (category?.name ?? t('filters.unavailable'))
  return {
    key: 'group',
    labelKey: 'board.group',
    value,
    changed: group !== undefined,
    choices: {
      selected: groupKeyOf(shown),
      options: [
        ...BOARD_GROUP_KEYS.map((key) => ({ key, label: t(GROUP_LABELS[key]) })),
        ...grouping.categories.map((one) => ({ key: groupKeyOf({ category: one.id }), label: one.name })),
      ],
      onChange: (key) => {
        const picked = BOARD_GROUP_KEYS.find((candidate) => candidate === key)
        if (picked !== undefined) {
          grouping.set({ key: picked })
          return
        }
        const one = grouping.categories.find((candidate) => groupKeyOf({ category: candidate.id }) === key)
        if (one !== undefined) grouping.set({ category: one.id })
      },
    },
  }
}

function useFilterRow(): OptionRow {
  const conditions = useConditions()
  const { active, clearAll } = useBoardFilters()
  const builder = useBuilderOpen()
  const count = conditions.length
  const value = count === 0 ? t('board.empty') : count === 1 ? t('board.conditionsOne') : [String(count), t('board.conditions')].join(WORD)
  return {
    key: 'filter',
    labelKey: 'board.filter',
    value,
    changed: active,
    actions: [
      // A condition opens its rule in the builder; one the builder cannot show is only removed, here (D-131).
      ...conditions.map((condition) => {
        const { target } = condition
        return target === null
          ? { key: condition.key, label: [t('filters.remove'), condition.text].join(WORD), icon: <X aria-hidden size={ACTION_ICON} className="shrink-0 text-text-muted" />, onPress: condition.remove, stays: true }
          : {
              key: condition.key,
              label: condition.text,
              onPress: () => {
                builder.open(target)
              },
            }
      }),
      {
        key: 'add',
        label: t('board.addCondition'),
        icon: <Plus aria-hidden size={ACTION_ICON} className="shrink-0 text-text-muted" />,
        onPress: () => {
          builder.open({ kind: 'all' })
        },
      },
      ...(active
        ? [
            {
              key: 'clear',
              label: t('board.clearConditions'),
              icon: <X aria-hidden size={ACTION_ICON} className="shrink-0 text-text-muted" />,
              onPress: clearAll,
            },
          ]
        : []),
    ],
  }
}

function useColorsRow(view: ViewId, phone: boolean): OptionRow | null {
  const colors = useBarColors()
  // The colors of a leave's type stay only where the old bars still draw them: a wide screen's timeline and table (D-454).
  if (phone || (view !== 'timeline' && view !== 'table')) return null
  return {
    key: 'colors',
    labelKey: 'board.colors',
    value: t(COLOR_LABELS[colors.mode]),
    changed: false,
    choices: {
      selected: colors.mode,
      options: BAR_COLOR_MODES.map((mode) => ({ key: mode, label: t(COLOR_LABELS[mode]) })),
      onChange: (key) => {
        const mode = BAR_COLOR_MODES.find((candidate) => candidate === key)
        if (mode !== undefined) colors.select(mode)
      },
    },
  }
}

export interface BoardOptionsProps {
  readonly view: ViewId
  readonly phone: boolean
  readonly onSavedViews: (() => void) | null
}

export function BoardOptions({ view, phone, onSavedViews }: BoardOptionsProps) {
  const [custom, setCustom] = useState<{ readonly from: CalendarDate; readonly to: CalendarDate } | null>(null)
  const { window } = useDateWindow()
  const focusMode = useFocusMode()
  const saved = useSavedViews(view)
  const unit = useUnitRow()
  const range = useRangeRow(view, () => {
    if (window !== null) setCustom({ from: window.from, to: window.to })
  })
  const sort = useSortRow()
  const group = useGroupRow()
  const filter = useFilterRow()
  const colors = useColorsRow(view, phone)
  const rows = [unit, range, sort, group, filter, colors].filter((row) => row !== null)
  const footer: OptionAction[] = [
    ...(onSavedViews === null
      ? []
      : [
          {
            key: 'saved',
            label: t('board.savedViews'),
            detail: saved.current?.name ?? t('board.openSavedViews'),
            icon: <Bookmark aria-hidden size={ACTION_ICON} className="shrink-0 text-text-muted" />,
            onPress: onSavedViews,
          },
        ]),
    ...(focusMode.available
      ? [
          {
            key: 'focus',
            label: t('board.focus'),
            icon: <Maximize2 aria-hidden size={ACTION_ICON} className="shrink-0 text-text-muted" />,
            onPress: focusMode.enter,
          },
        ]
      : []),
  ]
  return (
    <>
      <OptionsMenu labelKey="board.options" icon={<SlidersHorizontal aria-hidden size={ICON} />} rows={rows} footer={footer} />
      {custom === null ? null : (
        <CustomRangeDialog
          from={custom.from}
          to={custom.to}
          onClose={() => {
            setCustom(null)
          }}
        />
      )}
    </>
  )
}
