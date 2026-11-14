import type { CalendarDate, Deployment, Soldier, SoldierId, Unit, UnitId, UnitMembership } from '@contracts'
import { ancestorsOf, compareDates, descendantsOf, spanCovers, spansOverlap, type UnitTree } from '@domain'
import type { DateWindow } from '../view-state/window'
import type { DashboardRowInput } from './tally'

// The board's unit and rows (D-349, D-362, D-403): which units the actor may pick, which one is shown, who its rows are.

/** The direct child of `unitId` on the way from `memberUnit` up, `unitId` itself for its own members, or NULL. */
function subUnitOf(tree: UnitTree, unitId: UnitId, memberUnit: UnitId): UnitId | null | undefined {
  if (memberUnit === unitId) return null
  const path = [memberUnit, ...ancestorsOf(tree, memberUnit)]
  const at = path.indexOf(unitId)
  return at > 0 ? path[at - 1] : undefined
}

export interface RowsInput {
  readonly tree: UnitTree
  readonly unitId: UnitId
  readonly window: DateWindow
  readonly rotation: Deployment | null
  readonly servesInRotation: ((soldierId: SoldierId, day: CalendarDate) => boolean) | null
  readonly today: CalendarDate
  readonly memberships: readonly UnitMembership[]
}

/**
 * The rows of the unit (P-3): who serves in the span in the unit's tree. In a rotation, its days, with a membership in
 * the tree that day or the rotation's unit in the tree; in a routine range, a membership in the tree that day.
 */
export function rowsOf(input: RowsInput & { readonly readable: readonly Soldier[] }): DashboardRowInput[] {
  const { tree, unitId, window, rotation, servesInRotation } = input
  const inTree = new Set<UnitId>([unitId, ...descendantsOf(tree, unitId)])
  const rotationInTree = rotation !== null && inTree.has(rotation.unit_id)
  const span = { valid_from: window.from, valid_to: window.to }
  return input.readable.flatMap((soldier) => {
    const own = input.memberships.filter(
      (membership) => membership.soldier_id === soldier.id && inTree.has(membership.unit_id) && spansOverlap(membership, span),
    )
    if (own.length === 0 && !rotationInTree) return []
    const inUnit = (day: CalendarDate) => own.some((membership) => spanCovers(membership, day))
    const serves =
      servesInRotation === null
        ? inUnit
        : (day: CalendarDate) => servesInRotation(soldier.id, day) && (rotationInTree || inUnit(day))
    if (!window.days.some(serves)) return []
    // The sub-unit of the membership that holds today, else of the first in the span; a primary one before others.
    const ordered = [...own].sort(
      (a, b) =>
        Number(spanCovers(b, input.today)) - Number(spanCovers(a, input.today)) ||
        Number(b.membership_type === 'primary') - Number(a.membership_type === 'primary') ||
        compareDates(a.valid_from, b.valid_from),
    )
    const first = ordered[0]
    const subUnitId = first === undefined ? null : (subUnitOf(tree, unitId, first.unit_id) ?? null)
    return [{ soldier, subUnitId, serves }]
  })
}

/**
 * The live units the actor reads whole in the span, in tree order: the actor reads the unit's leaves whole (`whole`, the
 * `whole_unit` target, D-403), a unit or one above it holds a membership of a readable soldier, and none of a soldier the
 * actor sees but may not read, so a platoon's commander cannot pick the company and see the platoon's figures under its
 * name (D-349).
 */
export function pickableUnits(
  units: readonly Unit[],
  tree: UnitTree,
  known: ReadonlySet<SoldierId>,
  readable: ReadonlySet<SoldierId>,
  memberships: readonly UnitMembership[],
  window: DateWindow,
  whole: (unitId: UnitId) => boolean,
): Unit[] {
  const span = { valid_from: window.from, valid_to: window.to }
  const held = new Set<UnitId>()
  const partial = new Set<UnitId>()
  for (const membership of memberships) {
    if (!known.has(membership.soldier_id) || !spansOverlap(membership, span)) continue
    const into = readable.has(membership.soldier_id) ? held : partial
    for (const unitId of [membership.unit_id, ...ancestorsOf(tree, membership.unit_id)]) into.add(unitId)
  }
  return units.filter((unit) => held.has(unit.id) && !partial.has(unit.id) && whole(unit.id))
}

/** The board's unit: the URL's when it may be picked, else the actor's own unit today, else the first. */
export function chosenUnit(pickable: readonly Unit[], asked: UnitId | undefined, own: UnitId | null): UnitId | null {
  const ids = new Set(pickable.map((unit) => unit.id))
  if (asked !== undefined && ids.has(asked)) return asked
  if (own !== null && ids.has(own)) return own
  return pickable[0]?.id ?? null
}
