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

export interface CardSaveRequest {
  /** The soldier as the edit opened them: its version guards the save (D-012). */
  readonly soldier: Soldier
  /** The private row as the edit opened it; NULL with none. */
  readonly privateRow: SoldierPrivate | null
  readonly editable: CardEditable
  readonly values: CardEditValues
  /** The custom fields' values, from the form's property fields (D-016). */
  readonly properties: WithProperties
  /** The tags chosen, by category, with the tags as the edit opened them; NULL when they are not edited. */
  readonly tags: { readonly card: CardTags; readonly chosen: ReadonlyMap<TagCategoryId, readonly TagId[]> } | null
}

export interface CardSaved {
  /** Whether anything was sent: an edit that changed nothing saves nothing and offers no "ביטול". */
  readonly changed: boolean
  /** The request that puts back what the save changed, from the versions the save left. */
  readonly undo: CardSaveRequest
}

/** The scopes a set of tag inputs leaves. */
function scopesAfter(scopes: TagScopes, inputs: readonly SetSoldierTagsInput[]): TagScopes {
  return inputs.reduce(
    (current, input): TagScopes => (input.deployment_id === null ? { ...current, persistent: input.tag_ids } : { ...current, rotation: input.tag_ids }),
    scopes,
  )
}

const failed = (error: AppError): Result<CardSaved> => ({ ok: false, error })

/**
 * Saves the card: the profile (with its custom fields), the tags, then the private details. The first refusal stops
 * there and is the answer; what was saved before it stays, as each section of the full card saves alone.
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
      if (editable.profile) {
        const input = toUpdateSoldierInput(soldier, soldier.version, { ...profileOf(values, soldier), ...request.properties })
        if (input !== null) {
          const result = await soldiers.update(input)
          if (!result.ok) return failed(result.error)
          soldier = result.value
          changed = true
        }
      }
      let undoTags: CardSaveRequest['tags'] = null
      if (editable.tags && request.tags !== null) {
        const { card, chosen } = request.tags
        const inputs = toScopedTagInputs(soldier, soldier.version, card.rotationId, card.scopes, card.groups, chosen, card.lifetimes)
        for (const input of inputs) {
          const result = await soldiers.setTags(input)
          if (!result.ok) return failed(result.error)
        }
        if (inputs.length > 0) {
          changed = true
          // Each set moves the soldier's version by one (D-130).
          soldier = { ...soldier, version: soldier.version + inputs.length }
          const after: CardTags = { ...card, scopes: scopesAfter(card.scopes, inputs) }
          undoTags = { card: after, chosen: new Map(card.groups.map((group) => [group.category.id, cardTagsSelected(card, group)])) }
        }
      }
      if (editable.private) {
        const input = toUpdatePrivateInput(soldier.id, row, values)
        if (input !== null) {
          const result = await soldiers.updatePrivate(input)
          if (!result.ok) return failed(result.error)
          row = result.value
          changed = true
        }
      }
      const undo: CardSaveRequest = {
        soldier,
        privateRow: row,
        editable,
        values: before,
        properties: { properties: request.soldier.properties },
        tags: undoTags,
      }
      return { ok: true, value: { changed, undo } }
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
