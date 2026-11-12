import type { AppError, DeploymentId, Soldier, TagCategory, TagCategoryId, TagId, TagLifetime } from '@contracts'
import { TagLifetime as Lifetime } from '@contracts'
import { t } from '@i18n'
import {
  copiedRotationTags,
  effectiveTagIds,
  heldInScopes,
  initialLifetimes,
  previousRotation,
  selectedInScope,
  soldierTagGroups,
  soldierTagScopes,
  tagColorOf,
  toggledTags,
  useCanSetTags,
  useDateWindow,
  useRotationScope,
  useSetScopedTags,
  useSoldierTags,
  useTagCategories,
  useTags,
  type SoldierTagGroup,
  type TagScopes,
} from '@logic'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formStateOf } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { CheckList, RadioList, type Choice } from '../../primitives/ChoiceList'
import { TagInPlace } from '../tags/TagsModule'
import { toneOf } from '../../theme/palette'

// A soldier's tags on their page (D-130): what they hold, by category, and an edit for who may update the soldier.
// A held tag archived since shows "בארכיון" and can be removed, never added. While a rotation is open, each category
// is kept either for good or for this rotation, and the card marks what holds for the rotation only (D-260, D-222).

const NO_ISSUE_FIELDS: readonly string[] = []

function choicesOf(group: SoldierTagGroup, categories: readonly TagCategory[]): Choice[] {
  return group.choices.map((choice) => ({
    key: choice.tag.id,
    label: { text: choice.tag.name },
    dot: toneOf(tagColorOf(choice.tag, categories)).fill,
    note: choice.archived ? 'soldiers.tagArchived' : null,
  }))
}

const LIFETIME_CHOICES: Choice[] = [
  { key: Lifetime.enum.persistent, label: { key: 'soldiers.tagLifetimePersistent' }, dot: null, note: null },
  { key: Lifetime.enum.rotation, label: { key: 'soldiers.tagLifetimeRotation' }, dot: null, note: null },
]

function lifetimeOf(key: string | null): TagLifetime {
  return key === Lifetime.enum.rotation ? Lifetime.enum.rotation : Lifetime.enum.persistent
}

function TagsDialog({
  soldier,
  rotationId,
  scopes,
  previous,
  groups,
  categories,
  onClose,
}: {
  readonly soldier: Soldier
  /** The open rotation of the mode, NULL in routine (D-257). */
  readonly rotationId: DeploymentId | null
  readonly scopes: TagScopes
  /** What the soldier held in the previous rotation, NULL when there is none to copy from (D-222). */
  readonly previous: readonly TagId[] | null
  readonly groups: readonly SoldierTagGroup[]
  readonly categories: readonly TagCategory[]
  /** Called with the version the dialog saved from, or NULL when nothing was saved. */
  readonly onClose: (savedFrom: number | null) => void
}) {
  const setTags = useSetScopedTags()
  const [opened] = useState(soldier.version)
  const [chosen, setChosen] = useState<ReadonlyMap<TagCategoryId, readonly TagId[]>>(new Map())
  const [lifetimes, setLifetimes] = useState(() => initialLifetimes(groups, scopes, rotationId))
  const [failure, setFailure] = useState<AppError | null>(null)
  const lifetimeOfGroup = (group: SoldierTagGroup) => lifetimes.get(group.category.id) ?? Lifetime.enum.persistent
  const selectedOf = (group: SoldierTagGroup) =>
    chosen.get(group.category.id) ?? selectedInScope(group, scopes, lifetimeOfGroup(group))
  const choose = (group: SoldierTagGroup, tagIds: readonly TagId[]) => {
    setChosen((current) => new Map(current).set(group.category.id, tagIds))
  }
  const copyPrevious = (ids: readonly TagId[]) => {
    const copied = copiedRotationTags(groups, ids)
    setChosen((current) => new Map([...current, ...copied.chosen]))
    setLifetimes((current) => new Map([...current, ...copied.lifetimes]))
  }

  async function save() {
    setFailure(null)
    const result = await setTags.run({ soldier, openedVersion: opened, rotationId, scopes, groups, chosen, lifetimes })
    if (result.ok) {
      onClose(opened)
      return
    }
    setFailure(formStateOf(result.error, NO_ISSUE_FIELDS).failure ?? result.error)
  }

  return (
    <SmallDialog
      titleKey="soldiers.tagsEdit"
      hintKey="soldiers.tagsHint"
      confirmKey="common.save"
      isPending={setTags.isPending}
      onCancel={() => {
        onClose(null)
      }}
      onConfirm={() => {
        void save()
      }}
    >
      <div className="flex max-h-list flex-col gap-md overflow-auto">
        {previous === null || previous.length === 0 ? null : (
          <Button
            onPress={() => {
              copyPrevious(previous)
            }}
          >
            {t('soldiers.tagsCopyPrevious')}
          </Button>
        )}
        {groups.map((group) => {
          const label = { text: group.category.name }
          const selected = selectedOf(group)
          const current = { ...group, selected }
          return (
            <div key={group.category.id} role="group" aria-label={group.category.name} className="flex flex-col gap-xs">
              {group.category.selection_mode === 'single' ? (
                <RadioList
                  label={label}
                  choices={choicesOf(group, categories)}
                  selected={selected[0] ?? null}
                  noneKey="tagCategories.selectionNone"
                  onChange={(key) => {
                    const tagId = group.choices.find((choice) => choice.tag.id === key)?.tag.id
                    choose(group, tagId === undefined ? [] : toggledTags(current, tagId, true))
                  }}
                />
              ) : (
                <CheckList
                  label={label}
                  choices={choicesOf(group, categories)}
                  selected={selected}
                  onChange={(keys) => {
                    choose(
                      group,
                      group.choices.filter((choice) => keys.includes(choice.tag.id)).map((choice) => choice.tag.id),
                    )
                  }}
                />
              )}
              {rotationId === null ? null : (
                <RadioList
                  label={{ key: 'soldiers.tagLifetime' }}
                  choices={LIFETIME_CHOICES}
                  selected={lifetimeOfGroup(group)}
                  onChange={(key) => {
                    const lifetime = lifetimeOf(key)
                    // The choice moves with the lifetime: what was chosen is what is kept, in the new scope.
                    choose(group, selected)
                    setLifetimes((currentLifetimes) => new Map(currentLifetimes).set(group.category.id, lifetime))
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
      <TagInPlace
        isMissing={groups.length === 0}
        onCreated={(tag) => {
          // The new tag is chosen at once: alone in a single-choice category, added to the rest otherwise.
          const single = categories.find((category) => category.id === tag.category_id)?.selection_mode === 'single'
          setChosen((current) => {
            const before = current.get(tag.category_id) ?? groups.find((group) => group.category.id === tag.category_id)?.selected ?? []
            return new Map(current).set(tag.category_id, single ? [tag.id] : [...before, tag.id])
          })
        }}
      />
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}

export function SoldierTagsSection({
  soldier,
  onSaved,
}: {
  readonly soldier: Soldier
  /** Called with the version the tags were saved from. */
  readonly onSaved: (savedFrom: number) => void
}) {
  const rows = useSoldierTags()
  const categories = useTagCategories()
  const tags = useTags()
  const { rotation } = useRotationScope()
  const { rotations } = useDateWindow()
  const canSet = useCanSetTags(soldier)
  const [editing, setEditing] = useState(false)

  if (rows.status === 'failed') return <FailureNotice error={rows.error} />
  if (categories.status === 'failed') return <FailureNotice error={categories.error} />
  if (tags.status === 'failed') return <FailureNotice error={tags.error} />
  if (rows.status === 'loading' || categories.status === 'loading' || tags.status === 'loading') return <LoadingNotice />

  // A closed rotation is history: its tags show, but changes go to the persistent set (D-258).
  const shownRotationId = rotation?.id ?? null
  const openRotationId = rotation !== null && rotation.closed_at === null ? rotation.id : null
  const scopes = soldierTagScopes(rows.value, soldier.id, openRotationId)
  const groups = soldierTagGroups(categories.value, tags.value, heldInScopes(scopes))
  const effective = effectiveTagIds(rows.value, soldier.id, shownRotationId, tags.value, categories.value)
  const forRotation = new Set(soldierTagScopes(rows.value, soldier.id, shownRotationId).rotation)
  const shown = soldierTagGroups(categories.value, tags.value, effective).filter((group) => group.selected.length > 0)
  const before = rotation === null || openRotationId === null ? null : previousRotation(rotations, rotation)
  const previous = before === null ? null : soldierTagScopes(rows.value, soldier.id, before.id).rotation
  // With no tag yet, the dialog offers one in place, or says who sets them up (D-285).
  const canEdit = canSet && soldier.archived_at === null
  // Nothing to show and nothing to choose: the section stays away (D-076).
  if (shown.length === 0 && !canEdit) return null
  const byId = new Map(tags.value.map((tag) => [tag.id, tag]))

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <h3 className="text-body font-bold">{t('soldiers.tagsTitle')}</h3>
        {canEdit ? (
          <Button
            onPress={() => {
              setEditing(true)
            }}
          >
            <Pencil aria-hidden size={14} />
            {t('soldiers.tagsEdit')}
          </Button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="text-name text-text-muted">{t('soldiers.tagsNone')}</p>
      ) : (
        <dl className="flex flex-col gap-md">
          {shown.map((group) => (
            <div key={group.category.id} className="flex flex-col gap-xs">
              <dt className="text-label font-semibold text-text-muted">{group.category.name}</dt>
              <dd className="flex flex-wrap gap-xs">
                {group.selected.map((tagId) => {
                  const tag = byId.get(tagId)
                  if (tag === undefined) return null
                  return (
                    <span key={tagId} className="inline-flex items-center gap-xs rounded-pill bg-inner px-sm py-2xs text-control">
                      <span aria-hidden className={`size-dot rounded-pill ${toneOf(tagColorOf(tag, categories.value)).fill}`} />
                      {tag.name}
                      {forRotation.has(tagId) ? <span className="text-micro text-text-muted">{t('soldiers.tagForRotation')}</span> : null}
                      {tag.archived_at === null ? null : <span className="text-micro text-text-muted">{t('soldiers.tagArchived')}</span>}
                    </span>
                  )
                })}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {editing ? (
        <TagsDialog
          soldier={soldier}
          rotationId={openRotationId}
          scopes={scopes}
          previous={previous}
          groups={groups}
          categories={categories.value}
          onClose={(savedFrom) => {
            setEditing(false)
            if (savedFrom !== null) onSaved(savedFrom)
          }}
        />
      ) : null}
    </section>
  )
}
