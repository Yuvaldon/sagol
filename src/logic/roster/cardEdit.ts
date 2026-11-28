import { TagLifetime, type AppError, type SoldierTag, type Tag, type TagCategory, type CommandRankId, type DeploymentId, type Issue, type Result, type SetSoldierTagsInput, type Soldier, type SoldierPrivate, type TagCategoryId, type TagId } from '@contracts'
import { useMemo } from 'react'
import { useCan } from '../permissions/hooks'
import { checkOn } from '../permissions/checks'
import type { WithProperties } from '../properties/properties'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { useTagCategories, useTags, useSoldierTags } from '../tags/hooks'
import { heldInScopes, initialLifetimes, selectedInScope, soldierTagGroups, soldierTagScopes, toScopedTagInputs, toggledTags, type SoldierTagGroup, type TagScopes } from '../tags/tags'
import type { Loaded } from '../queries/loaded'
import { useRotationScope } from '../view-state/rotation'
import { privateFormIssues, soldierFormIssues, toUpdatePrivateInput, toUpdateSoldierInput } from './forms'

// The in-place edit of a person card and of the profile of "אני", one component (D-489, OI-401): the pencil turns the
// card's own fields into inputs, each by its permission, and ✓ saves them together: the profile, then the tags, then the
// private details, each by its own command and version. A save returns what puts it back, for the toast's "ביטול".

/** The card's fields as the inputs hold them; '' is empty. */
export interface CardEditValues {
  readonly first_name: string
  readonly last_name: string
  readonly nickname: string
  readonly command_rank_id: CommandRankId | null
  readonly personal_id: string
  readonly invite_email: string
  readonly phone: string
}

/** What of the card the actor may change (a hint: each command decides again). */
export interface CardEditable {
  /** The name, the nickname, the command rank and the custom fields (`soldiers:update`). */
  readonly profile: boolean
  /** The personal number, the invite email and the phone (`soldier_private:update`, which needs reading them, D-096). */
  readonly private: boolean
  /** The tags: who may update the soldier sets them (D-130). */
  readonly tags: boolean
}

export function cardEditValues(soldier: Soldier, row: SoldierPrivate | null): CardEditValues {
  return {
    first_name: soldier.first_name,
    last_name: soldier.last_name,
    nickname: soldier.nickname ?? '',
    command_rank_id: soldier.command_rank_id,
    personal_id: row?.personal_id ?? '',
    invite_email: row?.invite_email ?? '',
    phone: row?.phone ?? '',
  }
}

/** The profile's own fields: the private ones are another command's, and the profile's schema refuses them. */
function profileOf(values: CardEditValues, soldier: Soldier) {
  const { first_name, last_name, nickname, command_rank_id } = values
  return { first_name, last_name, nickname, command_rank_id, status: soldier.status }
}

/** The answers of the fields the actor may change, before anything is sent. */
export function cardEditIssues(soldier: Soldier, editable: CardEditable, values: CardEditValues): Issue[] {
  return [
    ...(editable.profile ? soldierFormIssues(soldier.id, profileOf(values, soldier)) : []),
    ...(editable.private ? privateFormIssues(soldier.id, values) : []),
  ]
}

/** A soldier's tags as the card edits them: by category, each kept in the lifetime it holds now (D-222). */
export interface CardTags {
  readonly rotationId: DeploymentId | null
  readonly scopes: TagScopes
  readonly groups: readonly SoldierTagGroup[]
  readonly lifetimes: ReadonlyMap<TagCategoryId, TagLifetime>
}

/** What a group holds now, in the lifetime the card keeps it in. */
export function cardTagsSelected(tags: CardTags, group: SoldierTagGroup): TagId[] {
  return selectedInScope(group, tags.scopes, tags.lifetimes.get(group.category.id) ?? TagLifetime.enum.persistent)
}

export function cardTagsOf(
  rows: readonly SoldierTag[],
  soldier: Soldier,
  rotationId: DeploymentId | null,
  categories: readonly TagCategory[],
  tags: readonly Tag[],
): CardTags {
  const scopes = soldierTagScopes(rows, soldier.id, rotationId)
  const groups = soldierTagGroups(categories, tags, heldInScopes(scopes))
  return { rotationId, scopes, groups, lifetimes: initialLifetimes(groups, scopes, rotationId) }
}

/** The soldier's tags for the card, in the rotation in scope (D-258); NULL while any read is out. */
export function useCardTags(soldier: Soldier): Loaded<CardTags> {
  const rows = useSoldierTags()
  const categories = useTagCategories()
  const tags = useTags()
  const rotationId = useRotationScope().rotation?.id ?? null
  return useMemo((): Loaded<CardTags> => {
    if (rows.status !== 'ready') return rows
    if (categories.status !== 'ready') return categories
    if (tags.status !== 'ready') return tags
    return { status: 'ready', value: cardTagsOf(rows.value, soldier, rotationId, categories.value, tags.value) }
  }, [rows, categories, tags, soldier, rotationId])
}

/** A tag chosen or let go in the card's picker: a single-choice category holds one (D-065). */
export function chosenAfter(
  chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>,
  tags: CardTags,
  group: SoldierTagGroup,
  tagId: TagId,
  on: boolean,
): ReadonlyMap<TagCategoryId, readonly TagId[]> {
  const selected = chosen.get(group.category.id) ?? cardTagsSelected(tags, group)
  return new Map(chosen).set(group.category.id, toggledTags({ ...group, selected }, tagId, on))
}

/**
 * A tag made in the edit's picker ("הוסף: X") joins the card the edit opened on: into its category's group, or a new group
 * when the category had no live tag, so it is shown and saved. Its category keeps the lifetime it holds now, or its own
 * default for a new group (D-222); with no rotation, everything is persistent.
 */
export function cardTagsWith(card: CardTags, tag: Tag, category: TagCategory): CardTags {
  const choice = { tag, archived: false }
  const own = card.groups.find((group) => group.category.id === category.id)
  if (own !== undefined) {
    if (own.choices.some((existing) => existing.tag.id === tag.id)) return card
    return { ...card, groups: card.groups.map((group) => (group === own ? { ...group, choices: [...group.choices, choice] } : group)) }
  }
  const lifetime = card.rotationId === null ? TagLifetime.enum.persistent : category.default_lifetime
  return {
    ...card,
    groups: [...card.groups, { category, choices: [choice], selected: [] }],
    lifetimes: new Map(card.lifetimes).set(category.id, lifetime),
  }
}

/** The tags of a save: chosen by category over the card, or the exact sets an undo puts back. */
export type CardTagsChange =
  | { readonly card: CardTags; readonly chosen: ReadonlyMap<TagCategoryId, readonly TagId[]> }
  | { readonly restore: TagScopes; readonly from: TagScopes; readonly rotationId: DeploymentId | null }

export interface CardSaveRequest {
  /** The soldier as the edit opened them: its version guards the save (D-012). */
  readonly soldier: Soldier
  /** The private row as the edit opened it; NULL with none. */
  readonly privateRow: SoldierPrivate | null
  readonly editable: CardEditable
  readonly values: CardEditValues
  /** The custom fields' values, from the form's property fields (D-016). */
  readonly properties: WithProperties
  /** The tags; NULL when they are not edited. */
  readonly tags: CardTagsChange | null
}

export interface CardSaved {
  /** Whether anything was saved: an edit that changed nothing offers no "ביטול". */
  readonly changed: boolean
  /** The request that puts back what was saved, from the versions the save left. */
  readonly undo: CardSaveRequest
  /** What the save left: the soldier's version, the private row and the tags' scopes, for an edit that goes on (D-490). */
  readonly left: { readonly soldier: Soldier; readonly privateRow: SoldierPrivate | null; readonly scopes: TagScopes | null }
  /** The first refusal, which stopped the rest; NULL when all was saved. What was saved before it stands. */
  readonly refusal: AppError | null
}

/** The scopes a set of tag inputs leaves. */
function scopesAfter(scopes: TagScopes, inputs: readonly SetSoldierTagsInput[]): TagScopes {
  return inputs.reduce(
    (current, input): TagScopes => (input.deployment_id === null ? { ...current, persistent: input.tag_ids } : { ...current, rotation: input.tag_ids }),
    scopes,
  )
}

function sameSet(a: readonly TagId[], b: readonly TagId[]): boolean {
  return a.length === b.length && a.every((tagId) => b.includes(tagId))
}

/** The sets that put `from` back to `restore`, each guarded by the version it is saved at. */
function restoreInputs(soldier: Soldier, change: Extract<CardTagsChange, { restore: TagScopes }>): SetSoldierTagsInput[] {
  const sets: { deployment_id: DeploymentId | null; tag_ids: TagId[] }[] = []
  if (!sameSet(change.restore.persistent, change.from.persistent)) sets.push({ deployment_id: null, tag_ids: [...change.restore.persistent] })
  if (change.rotationId !== null && !sameSet(change.restore.rotation, change.from.rotation)) {
    sets.push({ deployment_id: change.rotationId, tag_ids: [...change.restore.rotation] })
  }
  return sets.map((set, index) => ({ soldier_id: soldier.id, expected_version: soldier.version + index, ...set }))
}

/**
 * Saves the card: the profile (with its custom fields), the tags, then the private details. The first refusal stops
 * there and is said; what was saved before it stands, with its "ביטול", and the versions it left go on with the edit
 * (D-490).
 */
export function useCardSave() {
  const { data } = usePorts()
  const { soldiers } = data.commands
  return useCommand(
    [QUERY_KEYS.soldiers, QUERY_KEYS.soldierPrivate, QUERY_KEYS.soldierTags],
    async (request: CardSaveRequest): Promise<Result<CardSaved>> => {
      const { editable, values } = request
      let soldier = request.soldier
      let row = request.privateRow
      const before = cardEditValues(request.soldier, request.privateRow)
      let changed = false
      let undoTags: CardTagsChange | null = null
      let scopes: TagScopes | null = request.tags === null ? null : 'card' in request.tags ? request.tags.card.scopes : request.tags.from
      const answer = (refusal: AppError | null): Result<CardSaved> => ({
        ok: true,
        value: {
          changed,
          undo: { soldier, privateRow: row, editable, values: before, properties: { properties: request.soldier.properties }, tags: undoTags },
          left: { soldier, privateRow: row, scopes },
          refusal,
        },
      })
      if (editable.profile) {
        const input = toUpdateSoldierInput(soldier, soldier.version, { ...profileOf(values, soldier), ...request.properties })
        if (input !== null) {
          const result = await soldiers.update(input)
          if (!result.ok) return answer(result.error)
          soldier = result.value
          changed = true
        }
      }
      if (editable.tags && request.tags !== null && scopes !== null) {
        const change = request.tags
        const rotationId = 'card' in change ? change.card.rotationId : change.rotationId
        const inputs =
          'card' in change
            ? toScopedTagInputs(soldier, soldier.version, change.card.rotationId, change.card.scopes, change.card.groups, change.chosen, change.card.lifetimes)
            : restoreInputs(soldier, change)
        const opened = scopes
        for (const input of inputs) {
          const result = await soldiers.setTags(input)
          if (!result.ok) return answer(result.error)
          // Each set moves the soldier's version by one (D-130); a set saved stands, whatever follows.
          soldier = { ...soldier, version: soldier.version + 1 }
          scopes = scopesAfter(scopes, [input])
          changed = true
          undoTags = { restore: opened, from: scopes, rotationId }
        }
      }
      if (editable.private) {
        const input = toUpdatePrivateInput(soldier.id, row, values)
        if (input !== null) {
          const result = await soldiers.updatePrivate(input)
          if (!result.ok) return answer(result.error)
          row = result.value
          changed = true
        }
      }
      return answer(null)
    },
  )
}

/** What of the card the actor may change, for one soldier. */
export function useCardEditable(soldier: Soldier): CardEditable {
  const checks = useMemo(
    () => [
      checkOn({ resource: 'soldiers', action: 'update' }, soldier.id),
      checkOn({ resource: 'soldier_private', action: 'view' }, soldier.id),
      checkOn({ resource: 'soldier_private', action: 'update' }, soldier.id),
    ],
    [soldier.id],
  )
  const can = useCan(checks)
  const [update, view, updatePrivate] = checks.map(can)
  const live = soldier.archived_at === null
  return useMemo(
    () => ({ profile: live && update === true, private: live && view === true && updatePrivate === true, tags: live && update === true }),
    [live, update, view, updatePrivate],
  )
}
