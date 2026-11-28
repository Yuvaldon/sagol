import type { AppError, Tag, TagCategory, TagId } from '@contracts'
import { t } from '@i18n'
import { liveCategories, useTagCommands, useTagPermissions, type SoldierTagGroup } from '@logic'
import { Check, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton, Dialog, DialogTrigger, Heading } from 'react-aria-components'
import { FailureNotice } from '../../patterns/Notices'
import { Popover } from '../../primitives/overlays'
import { TextField } from '../../primitives/fields'

// The tag picker of the card's edit and of the tray (the handoff's Notion-like multi-select, D-489): "+" at the end of
// the chips opens a list attached to it, with a search, grouped by category, a ✓ beside what is held (a dash for what
// only some of the chosen hold). Who may create tags gets "הוסף: X" for a name no tag has; with several categories it
// asks which one first. A single-choice category keeps one (D-065).

const WORD = ' '
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const ROW = `flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control px-sm text-start text-body data-hovered:bg-inner ${FOCUS}`

export type PickState = 'on' | 'some' | 'off'

export interface TagPickerProps {
  /** The categories and their tags the soldier may hold, in order. */
  readonly groups: readonly SoldierTagGroup[]
  readonly categories: readonly TagCategory[]
  readonly tags: readonly Tag[]
  readonly stateOf: (tagId: TagId) => PickState
  readonly onToggle: (group: SoldierTagGroup, tagId: TagId, on: boolean) => void
  /** A tag made here is chosen at once. */
  readonly onCreated: (tag: Tag) => void
}

function matches(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
}

export function TagPickerList({ groups, categories, tags, stateOf, onToggle, onCreated }: TagPickerProps) {
  const permissions = useTagPermissions()
  const commands = useTagCommands()
  const [query, setQuery] = useState('')
  const [asking, setAsking] = useState(false)
  const [failure, setFailure] = useState<AppError | null>(null)
  const name = query.trim()
  const live = liveCategories(categories)
  const exists = tags.some((tag) => tag.archived_at === null && tag.name === name)
  const create = async (category: TagCategory) => {
    setFailure(null)
    const result = await commands.create.run({ values: { name, category_id: category.id, color_key: null }, all: tags })
    if (!result.ok) {
      setFailure(result.error)
      return
    }
    setAsking(false)
    setQuery('')
    onCreated(result.value)
  }
  const shown = groups
    .map((group) => ({ group, choices: group.choices.filter((choice) => !choice.archived || stateOf(choice.tag.id) !== 'off').filter((choice) => matches(choice.tag.name, query)) }))
    .filter((entry) => entry.choices.length > 0)
  return (
    <div className="flex flex-col gap-sm">
      <TextField labelKey="profile.tagSearch" name="tag_search" value={query} onChange={setQuery} error={null} autoFocus />
      <div className="flex max-h-list flex-col gap-sm overflow-y-auto">
        {shown.map(({ group, choices }) => (
          <section key={group.category.id} aria-label={group.category.name} className="flex flex-col">
            <h3 className="px-sm text-small font-semibold text-text-muted">{group.category.name}</h3>
            {choices.map((choice) => {
              const state = stateOf(choice.tag.id)
              return (
                <AriaButton
                  key={choice.tag.id}
                  aria-pressed={state === 'some' ? 'mixed' : state === 'on'}
                  aria-description={state === 'some' ? t('profile.tagSome') : undefined}
                  onPress={() => {
                    onToggle(group, choice.tag.id, state !== 'on')
                  }}
                  className={ROW}
                >
                  <span className="min-w-none flex-1 truncate">{choice.tag.name}</span>
                  {state === 'on' ? <Check aria-hidden size={18} className="shrink-0" /> : state === 'some' ? <Minus aria-hidden size={18} className="shrink-0" /> : null}
                </AriaButton>
              )
            })}
          </section>
        ))}
        {shown.length === 0 && name !== '' ? <p className="px-sm text-small text-text-muted">{t('profile.tagNoMatch')}</p> : null}
      </div>
      {permissions.create && name !== '' && !exists && live.length > 0 ? (
        asking ? (
          <section aria-label={t('profile.tagCategory')} className="flex flex-col">
            <h3 className="px-sm text-small font-semibold text-text-muted">{t('profile.tagCategory')}</h3>
            {live.map((category) => (
              <AriaButton
                key={category.id}
                isDisabled={commands.create.isPending}
                onPress={() => {
                  void create(category)
                }}
                className={ROW}
              >
                {category.name}
              </AriaButton>
            ))}
          </section>
        ) : (
          <AriaButton
            isDisabled={commands.create.isPending}
            onPress={() => {
              // With one category there is nothing to ask.
              const [only, ...more] = live
              if (only !== undefined && more.length === 0) void create(only)
              else setAsking(true)
            }}
            className={`${ROW} font-semibold`}
          >
            <Plus aria-hidden size={18} className="shrink-0" />
            <span className="truncate">{[t('profile.tagCreate'), name].join(WORD)}</span>
          </AriaButton>
        )
      ) : null}
      {failure === null ? null : <FailureNotice error={failure} />}
    </div>
  )
}

/** The "+" chip and the list it opens. */
export function TagPicker(props: TagPickerProps) {
  return (
    <DialogTrigger>
      <AriaButton
        aria-label={t('profile.tagAdd')}
        className={`inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-full border border-dashed border-line-dashed text-text-muted ${FOCUS}`}
      >
        <Plus aria-hidden size={18} />
      </AriaButton>
      <Popover placement="bottom start" className="glass-menu w-menu max-w-full rounded-panel p-sm">
        <Dialog aria-label={t('profile.tagAdd')} className="outline-none">
          <Heading slot="title" className="sr-only">
            {t('profile.tagAdd')}
          </Heading>
          <TagPickerList {...props} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
