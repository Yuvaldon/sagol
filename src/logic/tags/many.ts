import type { AppError, DeploymentId, Permission, Soldier, SoldierId, SoldierTag, Tag, TagCategory, TagCategoryId, TagId } from '@contracts'
import { useCallback, useMemo } from 'react'
import { checkOn } from '../permissions/checks'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { heldInScopes, initialLifetimes, selectedInScope, soldierTagGroups, soldierTagScopes, toScopedTagInputs, toggledTags, type SoldierTagGroup } from './tags'

// "תגיות" of the multi-select tray of "חיילים" (OI-400, D-489): the picker shows what every chosen soldier holds and what
// some hold; a tag chosen is added to each, one let go is taken from each, and a single-choice category keeps one. Each
// soldier's sets are saved by their own command, one after another, as "העברה" does; a refusal does not stop the rest.

const UPDATE: Permission = { resource: 'soldiers', action: 'update' }

/** Whether a tag is held by every chosen soldier, by some, or by none (absent). */
export type HeldBy = 'all' | 'some'

/** What the chosen soldiers hold, each in the lifetime their category is kept in now (D-222). */
export function heldByMany(
  rows: readonly SoldierTag[],
  soldiers: readonly Soldier[],
  rotationId: DeploymentId | null,
  categories: readonly TagCategory[],
  tags: readonly Tag[],
): ReadonlyMap<TagId, HeldBy> {
  const counts = new Map<TagId, number>()
  for (const soldier of soldiers) {
    const scopes = soldierTagScopes(rows, soldier.id, rotationId)
    const groups = soldierTagGroups(categories, tags, heldInScopes(scopes))
    const lifetimes = initialLifetimes(groups, scopes, rotationId)
    for (const group of groups) {
      for (const tagId of selectedInScope(group, scopes, lifetimes.get(group.category.id) ?? group.category.default_lifetime)) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
  }
  return new Map([...counts].map(([tagId, count]) => [tagId, count === soldiers.length ? 'all' : 'some']))
}

/** A group's tags after the changes: each tag set on or off, in the order the actor made them. */
export function changedSelection(group: SoldierTagGroup, selected: readonly TagId[], changes: readonly (readonly [TagId, boolean])[]): readonly TagId[] {
  const own = new Set(group.choices.map((choice) => choice.tag.id))
  return changes.reduce<readonly TagId[]>(
    (current, [tagId, on]) => (own.has(tagId) ? toggledTags({ ...group, selected: current }, tagId, on) : current),
    selected,
  )
}

/** Each soldier's answer, by id. */
/** Each soldier's answer, by id: saved (`changed` when a set was sent), or refused with the reason. */
export type TagAnswer = { readonly ok: true; readonly changed: boolean } | { readonly ok: false; readonly error: AppError }
export type TagAnswers = ReadonlyMap<SoldierId, TagAnswer>

export interface ManyTagsRequest {
  readonly soldiers: readonly Soldier[]
  readonly rows: readonly SoldierTag[]
  readonly rotationId: DeploymentId | null
  readonly categories: readonly TagCategory[]
  readonly tags: readonly Tag[]
  /** The tags set on (added to each) or off (taken from each), in order. */
  readonly changes: readonly (readonly [TagId, boolean])[]
}

export function useSetTagsOfMany() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.soldierTags, QUERY_KEYS.soldiers], async (request: ManyTagsRequest) => {
    const answers = new Map<SoldierId, TagAnswer>()
    for (const soldier of request.soldiers) {
      const scopes = soldierTagScopes(request.rows, soldier.id, request.rotationId)
      const groups = soldierTagGroups(request.categories, request.tags, heldInScopes(scopes))
      const lifetimes = initialLifetimes(groups, scopes, request.rotationId)
      const chosen = new Map<TagCategoryId, readonly TagId[]>(
        groups.map((group) => {
          const selected = selectedInScope(group, scopes, lifetimes.get(group.category.id) ?? group.category.default_lifetime)
          return [group.category.id, changedSelection(group, selected, request.changes)]
        }),
      )
      const inputs = toScopedTagInputs(soldier, soldier.version, request.rotationId, scopes, groups, chosen, lifetimes)
      // A soldier who already holds what was chosen gets no command, and is not counted as tagged (D-490).
      let answer: TagAnswer = { ok: true, changed: inputs.length > 0 }
      for (const input of inputs) {
        const result = await data.commands.soldiers.setTags(input)
        if (!result.ok) {
          answer = { ok: false, error: result.error }
          break
        }
      }
      answers.set(soldier.id, answer)
    }
    const done: { ok: true; value: TagAnswers } = { ok: true, value: answers }
    return done
  })
}

/** Who of the soldiers the actor may tag: who may update them (D-130). A hint: each command decides again. */
export function useTagSetters(soldiers: readonly Soldier[]): (soldierId: SoldierId) => boolean {
  const checks = useMemo(() => soldiers.map((soldier) => checkOn(UPDATE, soldier.id)), [soldiers])
  const can = useCan(checks)
  return useCallback((soldierId: SoldierId) => can(checkOn(UPDATE, soldierId)), [can])
}
