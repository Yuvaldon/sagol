import type { AppError, Soldier, TagCategory, TagCategoryId, TagId } from '@contracts'
import { t } from '@i18n'
import {
  soldierTagGroups,
  tagColorOf,
  tagsBySoldier,
  toggledTags,
  useCanSetTags,
  useSetSoldierTags,
  useSoldierTags,
  useTagCategories,
  useTags,
  type SoldierTagGroup,
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
// A held tag archived since shows "בארכיון" and can be removed, never added.

const NO_ISSUE_FIELDS: readonly string[] = []

function choicesOf(group: SoldierTagGroup, categories: readonly TagCategory[]): Choice[] {
  return group.choices.map((choice) => ({
    key: choice.tag.id,
    label: { text: choice.tag.name },
    dot: toneOf(tagColorOf(choice.tag, categories)).fill,
    note: choice.archived ? 'soldiers.tagArchived' : null,
  }))
}

function TagsDialog({
  soldier,
  held,
  groups,
  categories,
  onClose,
}: {
  readonly soldier: Soldier
  readonly held: readonly TagId[]
  readonly groups: readonly SoldierTagGroup[]
  readonly categories: readonly TagCategory[]
  /** Called with the version the dialog saved from, or NULL when nothing was saved. */
  readonly onClose: (savedFrom: number | null) => void
}) {
  const setTags = useSetSoldierTags()
  const [opened] = useState(soldier.version)
  const [chosen, setChosen] = useState<ReadonlyMap<TagCategoryId, readonly TagId[]>>(new Map())
  const [failure, setFailure] = useState<AppError | null>(null)
  const selectedOf = (group: SoldierTagGroup) => chosen.get(group.category.id) ?? group.selected
  const choose = (group: SoldierTagGroup, tagIds: readonly TagId[]) => {
    setChosen((current) => new Map(current).set(group.category.id, tagIds))
  }

  async function save() {
    setFailure(null)
    const result = await setTags.run({ soldier, openedVersion: opened, held, groups, chosen })
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
        {groups.map((group) => {
          const label = { text: group.category.name }
          const selected = selectedOf(group)
          const current = { ...group, selected }
          return group.category.selection_mode === 'single' ? (
            <RadioList
              key={group.category.id}
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
              key={group.category.id}
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
  const canSet = useCanSetTags(soldier)
  const [editing, setEditing] = useState(false)

  if (rows.status === 'failed') return <FailureNotice error={rows.error} />
  if (categories.status === 'failed') return <FailureNotice error={categories.error} />
  if (tags.status === 'failed') return <FailureNotice error={tags.error} />
  if (rows.status === 'loading' || categories.status === 'loading' || tags.status === 'loading') return <LoadingNotice />

  const held = tagsBySoldier(rows.value).get(soldier.id) ?? []
  const groups = soldierTagGroups(categories.value, tags.value, held)
  const shown = groups.filter((group) => group.selected.length > 0)
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
          held={held}
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
