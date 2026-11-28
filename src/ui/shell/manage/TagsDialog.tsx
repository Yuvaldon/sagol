import { TagSelectionMode, type SoldierId, type TagId } from '@contracts'
import { t } from '@i18n'
import { heldByMany, soldierTagGroups, useRotationScope, useSetTagsOfMany, useSoldierTags, useSoldiers, useTagCategories, useTags } from '@logic'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { LoadingNotice } from '../../patterns/Notices'
import { useNotices } from '../notices'
import { TagPickerList, type PickState } from '../person/TagPicker'

// "תגיות" of the multi-select tray (OI-400, D-489): the tag picker over the chosen soldiers. A ✓ is held by all, a dash by
// some; a press sets the tag on all or off all. "שמירה" saves each soldier's sets by their own command; the toast says
// how many were tagged and the first refusal, and the refused stay chosen.

const WORD = ' '
const NO_ROWS: readonly never[] = []

/** `onClose` gets the soldiers the save refused, to keep them chosen; NULL when the dialog was let go. */
export function TagsDialog({ soldierIds, onClose }: { readonly soldierIds: readonly SoldierId[]; readonly onClose: (refused: readonly SoldierId[] | null) => void }) {
  const soldiers = useSoldiers()
  const rows = useSoldierTags()
  const categories = useTagCategories()
  const tags = useTags()
  const rotationId = useRotationScope().rotation?.id ?? null
  const save = useSetTagsOfMany()
  const notices = useNotices()
  const [changes, setChanges] = useState<readonly (readonly [TagId, boolean])[]>([])
  const ready = soldiers.status === 'ready' && rows.status === 'ready' && categories.status === 'ready' && tags.status === 'ready'
  const chosen = soldiers.status === 'ready' ? soldiers.value.filter((soldier) => soldierIds.includes(soldier.id)) : NO_ROWS
  const held = ready ? heldByMany(rows.value, chosen, rotationId, categories.value, tags.value) : new Map<TagId, 'all' | 'some'>()
  const groups = ready ? soldierTagGroups(categories.value, tags.value, []) : NO_ROWS
  const groupOf = (tagId: TagId) => groups.find((group) => group.choices.some((choice) => choice.tag.id === tagId))
  const stateOf = (tagId: TagId): PickState => {
    // In a single-choice category, a later choice of another tag lets go of this one (D-065).
    const group = groupOf(tagId)
    if (group?.category.selection_mode === TagSelectionMode.enum.single) {
      const own = new Set(group.choices.map((choice) => choice.tag.id))
      const latest = changes.findLast(([id, on]) => own.has(id) && on)
      if (latest !== undefined && latest[0] !== tagId && changes.lastIndexOf(latest) > changes.findLastIndex(([id]) => id === tagId)) return 'off'
    }
    const last = changes.findLast(([id]) => id === tagId)
    if (last !== undefined) return last[1] ? 'on' : 'off'
    const now = held.get(tagId)
    return now === 'all' ? 'on' : now === 'some' ? 'some' : 'off'
  }
  const submit = async () => {
    if (!ready) return
    // The soldiers as they are now: each save is guarded by its own version (D-130).
    const result = await save.run({ soldiers: chosen, rows: rows.value, rotationId, categories: categories.value, tags: tags.value, changes })
    if (!result.ok) {
      onClose([...soldierIds])
      notices.fail(result.error)
      return
    }
    const answers = [...result.value]
    const refused = answers.flatMap(([soldierId, answer]) => (answer.ok ? [] : [soldierId]))
    // Only who got a change counts as tagged: a soldier who already held the choice was sent nothing (D-490).
    const tagged = answers.filter(([, answer]) => answer.ok && answer.changed).length
    const firstRefusal = answers.find(([, answer]) => !answer.ok)?.[1]
    onClose(refused)
    notices.report(
      [t('profile.tagsDone'), String(tagged), t('profile.soldiersWord')].join(WORD),
      firstRefusal === undefined || firstRefusal.ok ? null : firstRefusal.error,
    )
  }
  return (
    <SmallDialog
      titleKey="profile.tagsFor"
      confirmKey="common.save"
      isPending={save.isPending || !ready || changes.length === 0}
      onCancel={() => {
        onClose(null)
      }}
      onConfirm={() => {
        void submit()
      }}
    >
      {ready ? (
        <TagPickerList
          groups={groups}
          categories={categories.value}
          tags={tags.value}
          stateOf={stateOf}
          onToggle={(_group, tagId, on) => {
            setChanges((current) => [...current, [tagId, on]])
          }}
          onCreated={(tag) => {
            setChanges((current) => [...current, [tag.id, true]])
          }}
        />
      ) : (
        <LoadingNotice />
      )}
    </SmallDialog>
  )
}
