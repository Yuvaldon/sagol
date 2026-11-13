import type { CalendarDate, Deployment, LeaveTypeId } from '@contracts'
import {
  DEFAULT_TABLE_SORT_ORDER,
  PANEL_IDS,
  TableSortKey,
  type SortOrder,
} from '@config'
import { addDays, compareDates, daysBetween } from '@domain'
import { isReportable, reportDays, steppedReportDay } from '../presence/report'
import { useCallback, useMemo } from 'react'
import { useToday } from '../session/today'
import { NO_LEAVE_CONDITIONS, hasLeaveConditions, type BoardLeaveStatus, type LeaveConditions } from './conditions'
import { NO_RULES, readRules, writeRules } from './filter'
import { useChangeSearch, useWorkspaceSearch } from './search'
import { DEFAULT_SORT_RULES, defaultOrderOf as defaultRuleOrder, isDefaultSort, sameTarget, type SortRule, type SortTarget } from './sort-rules'
import { useDateWindow } from './window'

// What the board shows beyond the soldier filter: its leave conditions (D-132), "only who is missing" (D-133)
// and the day of the report (D-134, D-193). Each lives in the URL beside the filter.

export interface LeaveConditionsState {
  readonly conditions: LeaveConditions
  setStatuses(statuses: readonly BoardLeaveStatus[]): void
  setTypes(typeIds: readonly LeaveTypeId[]): void
}

export function useLeaveConditions(): LeaveConditionsState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const conditions = search.leaves ?? NO_LEAVE_CONDITIONS
  const write = useCallback(
    (next: LeaveConditions) => {
      change({ leaves: hasLeaveConditions(next) ? next : undefined })
    },
    [change],
  )
  const setStatuses = useCallback(
    (statuses: readonly BoardLeaveStatus[]) => {
      write({ ...conditions, statuses: statuses.length === 0 ? undefined : [...statuses] })
    },
    [conditions, write],
  )
  const setTypes = useCallback(
    (typeIds: readonly LeaveTypeId[]) => {
      write({ ...conditions, type_ids: typeIds.length === 0 ? undefined : [...typeIds] })
    },
    [conditions, write],
  )
  return { conditions, setStatuses, setTypes }
}

export interface OnlyMissingState {
  readonly on: boolean
  set(on: boolean): void
}

export interface BoardFiltersState {
  /**
   * A condition of the filter row is on: a soldier rule beside the unit, a leave condition, or "only who is missing"
   * (D-173, D-213, D-312).
   */
  readonly active: boolean
  /** Removes every condition of the filter row; the unit stays, as it is the scope and not a condition (D-173). */
  clearAll(): void
}

export function useBoardFilters(): BoardFiltersState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const filter = search.filter ?? null
  const read = useMemo(() => readRules(filter), [filter])
  const leaves = search.leaves ?? NO_LEAVE_CONDITIONS
  const active = read.kind === 'other' || read.filter.rules.length > 0 || hasLeaveConditions(leaves) || search.missing === true
  const clearAll = useCallback(() => {
    // A filter the builder does not read has no unit it can keep (D-104).
    const unitId = read.kind === 'rules' ? read.filter.unitId : null
    change({ filter: writeRules({ ...NO_RULES, unitId }), leaves: undefined, missing: undefined })
  }, [read, change])
  return { active, clearAll }
}

/** "Only who is missing" (D-133), a condition of the filter row (D-213). Off leaves the param out. */
export function useOnlyMissing(): OnlyMissingState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const set = useCallback(
    (on: boolean) => {
      change({ missing: on ? true : undefined })
    },
    [change],
  )
  return { on: search.missing === true, set }
}

export interface TableSortState {
  /** The leave column the table's lines are sorted by; NULL keeps the board's order (D-214, D-313). */
  readonly key: TableSortKey | null
  readonly order: SortOrder
  /** Sorts the lines by a leave column; with no direction, ascending. */
  sortBy(key: TableSortKey, order?: SortOrder): void
  /**
   * Puts one rule first, as the soldier and unit headers do, keeping the others after it as ties, and drops the leave
   * column's sort (D-313).
   */
  sortRows(rule: SortRule): void
}

/** The table's sort (D-214, D-313): a leave column in `sort` and `order`, or the board's own rules in `sorts`. */
export function useTableSort(): TableSortState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const parsed = TableSortKey.safeParse(search.sort)
  const key = parsed.success ? parsed.data : null
  const order = search.order ?? DEFAULT_TABLE_SORT_ORDER
  return useMemo(
    () => ({
      key,
      order,
      sortBy: (next, nextOrder = DEFAULT_TABLE_SORT_ORDER) => {
        change({ sort: next, order: nextOrder === DEFAULT_TABLE_SORT_ORDER ? undefined : nextOrder })
      },
      sortRows: (rule) => {
        const held = search.sorts ?? DEFAULT_SORT_RULES
        const sorts = [rule, ...held.filter((other) => !sameTarget(other, rule))]
        change({ sort: undefined, order: undefined, sorts: isDefaultSort(sorts) ? undefined : sorts })
      },
    }),
    [key, order, change, search.sorts],
  )
}

export interface SortRulesState {
  readonly rules: readonly SortRule[]
  /** Whether the rules are other than the default. */
  readonly changed: boolean
  /** Adds a rule last, in its target's direction; a target already listed stays where it is. */
  add(target: SortTarget): void
  /** Replaces the rule at an index; a target listed elsewhere leaves its old place. */
  replace(index: number, rule: SortRule): void
  remove(index: number): void
  /** Moves the rule at an index one place up (-1) or down (1). */
  move(index: number, by: -1 | 1): void
  /** Writes a list as it is; the default leaves the param out. */
  set(rules: readonly SortRule[]): void
}

/** The board's sort rules (D-313). */
export function useSortRules(): SortRulesState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const rules = search.sorts ?? DEFAULT_SORT_RULES
  const set = useCallback(
    (next: readonly SortRule[]) => {
      // The newest choice decides: rules written here drop a leave column's sort, as the headers do (D-313, OI-264).
      change({ sort: undefined, order: undefined, sorts: isDefaultSort(next) ? undefined : [...next] })
    },
    [change],
  )
  return useMemo(
    () => ({
      rules,
      changed: !isDefaultSort(rules),
      set,
      add: (target) => {
        if (rules.some((rule) => sameTarget(rule, target))) return
        set([...rules, { ...target, order: defaultRuleOrder(target) }])
      },
      replace: (index, rule) => {
        set(rules.flatMap((held, at) => (at === index ? [rule] : sameTarget(held, rule) ? [] : [held])))
      },
      remove: (index) => {
        set(rules.filter((_, at) => at !== index))
      },
      move: (index, by) => {
        const to = index + by
        const moved = rules[index]
        const other = rules[to]
        if (moved === undefined || other === undefined) return
        set(rules.map((held, at) => (at === index ? other : at === to ? moved : held)))
      },
    }),
    [rules, set],
  )
}

export interface PresenceDayState {
  /** NULL until today is known. */
  readonly day: CalendarDate | null
  /** The last day of a span (D-193); NULL for one day. */
  readonly until: CalendarDate | null
  readonly today: CalendarDate | null
  /** The days the report shows: the day, or the span's reportable days (D-193). Empty while the day is unknown. */
  readonly days: readonly CalendarDate[]
  /** The scope's live rotations (D-211). */
  readonly rotations: readonly Deployment[]
  /** Whether the day is reportable: the scope has no rotation, or one runs on it (D-193). */
  readonly reportable: (day: CalendarDate) => boolean
  /** Whether a step back (-1) or forward (1) reaches a reportable day. */
  canShift(step: -1 | 1): boolean
  /** The previous or next reportable day; a span's last day moves as far as its first, so it keeps its calendar length. */
  shift(step: -1 | 1): void
  goToToday(): void
  /** The span's last day; NULL turns it back to one day. */
  setUntil(until: CalendarDate | null): void
  /** Opens the report on today, in one step of the history (D-134). */
  openToday(): void
  /** Opens the report on a day, in one step of the history (D-193). */
  openOn(day: CalendarDate): void
}

/** The day of the report (D-134, D-193): the URL's, else today; and the span's last day. */
export function usePresenceDay(): PresenceDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const { rotations } = useDateWindow()
  const day = search.day ?? today
  const until = day === null || search.until === undefined || compareDates(search.until, day) <= 0 ? null : search.until
  const days = useMemo(() => (day === null ? [] : reportDays(rotations, day, until)), [rotations, day, until])
  const reportable = useCallback((candidate: CalendarDate) => isReportable(rotations, candidate), [rotations])
  const target = useCallback(
    (step: -1 | 1) => (day === null ? null : steppedReportDay(rotations, day, step)),
    [rotations, day],
  )
  const canShift = useCallback((step: -1 | 1) => target(step) !== null, [target])
  const shift = useCallback(
    (step: -1 | 1) => {
      const next = target(step)
      if (day === null || next === null) return
      change({ day: next, until: until === null ? undefined : addDays(until, daysBetween(day, next)) })
    },
    [change, target, day, until],
  )
  const goToToday = useCallback(() => {
    change({ day: undefined, until: undefined })
  }, [change])
  const setUntil = useCallback(
    (next: CalendarDate | null) => {
      change({ until: next ?? undefined })
    },
    [change],
  )
  const openOn = useCallback(
    (next: CalendarDate) => {
      change({ panel: PANEL_IDS.presence, entity: undefined, parent: undefined, day: next, until: undefined })
    },
    [change],
  )
  const openToday = useCallback(() => {
    change({ panel: PANEL_IDS.presence, entity: undefined, parent: undefined, day: undefined, until: undefined })
  }, [change])
  return { day, until, today, days, rotations, reportable, canShift, shift, goToToday, setUntil, openToday, openOn }
}

export interface RulesDayState {
  /** The day whose broken rules the rules panel shows (D-141); NULL shows none. */
  readonly day: CalendarDate | null
  /** Opens the rules panel on a day of the heat row, in one step of the history. */
  openOn(day: CalendarDate): void
  /** Opens the rules panel without a day. */
  open(): void
}

/** The rules panel and its day (D-140, D-141): the same `day` param as the presence lists (D-134). */
export function useRulesDay(): RulesDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const openOn = useCallback(
    (day: CalendarDate) => {
      change({ panel: PANEL_IDS.rules, entity: undefined, parent: undefined, day })
    },
    [change],
  )
  const open = useCallback(() => {
    change({ panel: PANEL_IDS.rules, entity: undefined, parent: undefined, day: undefined })
  }, [change])
  return { day: search.day ?? null, openOn, open }
}
