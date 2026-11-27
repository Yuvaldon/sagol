import { MANAGE } from '@config'
import type { CalendarDate, CommandRank, FilterExpression, Soldier, SoldierId, Tag, TagCategory, Unit, UnitId } from '@contracts'
import { LEAVE_PERMISSIONS, addDays } from '@domain'
import { useMemo } from 'react'
import { boardItems, type BoardGroupItem, type BoardSoldierItem } from '../board/rows'
import { useFilterSource } from '../filters/source'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { myDays, type MyDay } from '../leaves/workflow'
import { checkOn } from '../permissions/checks'
import { useCan, useCanAnswers } from '../permissions/hooks'
import type { Loaded } from '../queries/loaded'
import { useToday } from '../session/today'
import { useTagCategories, useTags } from '../tags/hooks'
import { appliedGrouping, defaultGrouping, groupsByCategory, type BoardGrouping } from '../view-state/grouping'
import type { PeopleView } from '../view-state/people'
import { useRotationScope } from '../view-state/rotation'
import type { SortRule } from '../view-state/sort-rules'
import { usePlacementHints, usePlacementReading } from './hooks'
import { matchesName, membershipsBySoldier, unitStateOn, type UnitState } from './roster'

// The list of "חיילים" (D-482): every soldier the actor sees, regardless of where they are, as the board orders and
// groups them (D-452), on today. Each row says its command rank and tags, and its next days for who reads its leaves:
// a soldier whose leaves the actor may not read shows no days, never days on base it cannot know (rule 4).

export interface PeopleRow extends BoardSoldierItem {
  /** The tags the soldier holds now, by name, in their category's order. */
  readonly tags: readonly string[]
  /** The next days, today first; NULL where the actor does not read the soldier's leaves, or the list hides them. */
  readonly days: readonly MyDay[] | null
}

export type PeopleItem = BoardGroupItem | PeopleRow

export interface PeopleList {
  readonly today: CalendarDate
  readonly items: readonly PeopleItem[]
  /** The soldiers the list holds, headers aside. */
  readonly count: number
  /** The grouping applied: the asked one when it reads, else the default for what the list covers. */
  readonly grouping: BoardGrouping
  /** Whether the default groups: the list covers several units. */
  readonly defaultGrouping: BoardGrouping
  /** The categories that can group the list: live and single-selection. */
  readonly categories: readonly TagCategory[]
}

const ACTIVE_ONLY: FilterExpression = { where: { kind: 'soldier_status', statuses: ['active'] } }
/** A status condition brings the inactive back (D-131): with none, the board's rows leave them out. */
const EVERY_STATUS: FilterExpression = { where: { kind: 'soldier_status', statuses: ['active', 'inactive'] } }
const BY_RANK: readonly SortRule[] = [{ key: 'rank', order: 'desc' }]
const BY_NAME: readonly SortRule[] = [{ key: 'name', order: 'asc' }]
const NO_SOLDIERS: readonly Soldier[] = []

function tagNames(soldierId: SoldierId, held: ReadonlyMap<SoldierId, readonly Tag[]>, categories: readonly TagCategory[]): string[] {
  const order = new Map(categories.map((category, index) => [category.id, index]))
  return (held.get(soldierId) ?? [])
    .toSorted((a, b) => (order.get(a.category_id) ?? 0) - (order.get(b.category_id) ?? 0) || a.sort_order - b.sort_order)
    .map((tag) => tag.name)
}

export function usePeopleList(view: PeopleView, query: string): Loaded<PeopleList> {
  const today = useToday()
  const source = useFilterSource(useRotationScope().rotation?.id ?? null)
  const tags = useTags()
  const categories = useTagCategories()
  const types = useLeaveTypes()
  const soldiers = source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS
  const placements = usePlacementHints(soldiers)
  const span = useMemo(() => (today === null ? null : { from: today, to: addDays(today, MANAGE.rowDays - 1) }), [today])
  const leaves = useLeaves(view.days ? span : null)
  const checks = useMemo(() => soldiers.map((soldier) => checkOn(LEAVE_PERMISSIONS.view, soldier.id)), [soldiers])
  const can = useCan(checks)

  return useMemo((): Loaded<PeopleList> => {
    if (source.status !== 'ready') return source
    if (tags.status !== 'ready') return tags
    if (categories.status !== 'ready') return categories
    if (types.status !== 'ready') return types
    if (today === null || !placements.settled) return { status: 'loading' }
    if (view.days && leaves.status !== 'ready') return leaves
    const fallback = defaultGrouping(source.value.units, null)
    const grouping = appliedGrouping(view.group, categories.value, fallback)
    const items = boardItems({
      ...source.value,
      soldiers: source.value.soldiers.filter((soldier) => matchesName(soldier, query)),
      days: [today],
      today,
      filter: view.inactive ? EVERY_STATUS : ACTIVE_ONLY,
      scopeUnitId: null,
      readsPlacements: placements.readsOrPending,
      marked: null,
      sorts: view.sort === 'name' ? BY_NAME : BY_RANK,
      daysAway: null,
      grouping,
      tags: tags.value,
      tagCategories: categories.value,
    })
    const tagById = new Map(tags.value.map((tag) => [tag.id, tag]))
    const held = new Map<SoldierId, Tag[]>()
    for (const row of source.value.soldierTags) {
      const tag = tagById.get(row.tag_id)
      if (tag === undefined || tag.archived_at !== null) continue
      held.set(row.soldier_id, [...(held.get(row.soldier_id) ?? []), tag])
    }
    const leaveRows = view.days && leaves.status === 'ready' ? leaves.value : []
    const rows = items.map((item): PeopleItem => {
      if (item.kind === 'group') return item
      const reads = view.days && can(checkOn(LEAVE_PERMISSIONS.view, item.soldier.id))
      return {
        ...item,
        tags: tagNames(item.soldier.id, held, categories.value),
        days: reads ? myDays(item.soldier.id, leaveRows, types.value, today, MANAGE.rowDays) : null,
      }
    })
    return {
      status: 'ready',
      value: {
        today,
        items: rows,
        count: rows.filter((item) => item.kind === 'soldier').length,
        grouping,
        defaultGrouping: fallback,
        categories: categories.value.filter(groupsByCategory),
      },
    }
  }, [source, tags, categories, types, today, placements, view, leaves, query, can])
}

/**
 * One soldier's days from today (the person card, D-482): NULL where the actor does not read the soldier's leaves, so
 * the card says nothing of where they are rather than "on base" it cannot know (rule 4).
 */
export function useSoldierDays(soldierId: SoldierId, count: number): Loaded<{ readonly today: CalendarDate; readonly days: readonly MyDay[] }> | null {
  const today = useToday()
  const checks = useMemo(() => [checkOn(LEAVE_PERMISSIONS.view, soldierId)], [soldierId])
  const { can, known } = useCanAnswers(checks)
  const [question] = checks
  const reads = question !== undefined && can(question)
  const span = useMemo(() => (today === null || !reads ? null : { from: today, to: addDays(today, count - 1) }), [today, reads, count])
  const leaves = useLeaves(span)
  const types = useLeaveTypes()
  return useMemo(() => {
    if (question === undefined || (known(question) && !reads)) return null
    if (today === null || !known(question)) return { status: 'loading' }
    if (leaves.status !== 'ready') return leaves
    if (types.status !== 'ready') return types
    return { status: 'ready', value: { today, days: myDays(soldierId, leaves.value, types.value, today, count) } }
  }, [question, known, reads, today, leaves, types, soldierId, count])
}

/** The head of a person card (D-482): who the soldier is, where they are placed today, and what they hold. */
export interface Person {
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  readonly unit: UnitState
  /** The tags held now, by name. */
  readonly tags: readonly string[]
}

/** One soldier the actor sees, for their card; NULL for one they do not see (a link may name anyone, D-076). */
export function usePerson(soldierId: SoldierId): Loaded<Person | null> {
  const today = useToday()
  const source = useFilterSource(useRotationScope().rotation?.id ?? null)
  const tags = useTags()
  const categories = useTagCategories()
  const reads = usePlacementReading(source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS)
  return useMemo((): Loaded<Person | null> => {
    if (source.status !== 'ready') return source
    if (tags.status !== 'ready') return tags
    if (categories.status !== 'ready') return categories
    const soldier = source.value.soldiers.find((candidate) => candidate.id === soldierId)
    if (soldier === undefined) return { status: 'ready', value: null }
    const unitById = new Map<UnitId, Unit>(source.value.unitTree.map((unit) => [unit.id, unit]))
    const own = membershipsBySoldier(source.value.memberships).get(soldierId) ?? []
    const tagById = new Map(tags.value.map((tag) => [tag.id, tag]))
    const held = source.value.soldierTags.flatMap((row) => {
      const tag = row.soldier_id === soldierId ? tagById.get(row.tag_id) : undefined
      return tag === undefined || tag.archived_at !== null ? [] : [tag]
    })
    return {
      status: 'ready',
      value: {
        soldier,
        rank: source.value.ranks.find((rank) => rank.id === soldier.command_rank_id) ?? null,
        unit: unitStateOn(own, unitById, soldierId, today, reads(soldierId)),
        tags: tagNames(soldierId, new Map([[soldierId, held]]), categories.value),
      },
    }
  }, [source, tags, categories, soldierId, today, reads])
}
