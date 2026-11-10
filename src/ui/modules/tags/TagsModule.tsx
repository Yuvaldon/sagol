import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, Tag, TagCategory, TagCategoryId } from '@contracts'
import { t } from '@i18n'
import {
  liveCategories,
  newTagValues,
  tagColorOf,
  tagFormIssues,
  tagFormValues,
  tagSections,
  tagsOfCategory,
  usePanel,
  useTagCategories,
  useTagCommands,
  useTagPermissions,
  useTags,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button as AriaButton, Heading } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { ColorField } from '../../primitives/ColorField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { toneOf } from '../../theme/palette'

// The tags section of the tags drawer (D-130): tags under their categories, each with its color. Up and down in the
// row menu order a tag inside its category. A tag's category is chosen when it is created.

const TAG_FIELDS: readonly string[] = ['name', 'category_id', 'color_key']

function categoryOptions(categories: readonly TagCategory[]): SelectOption<TagCategoryId | null>[] {
  return liveCategories(categories).map((category) => ({ key: category.id, label: { text: category.name }, value: category.id }))
}

function TagForm({
  tag,
  categories,
  tags,
  onReload,
}: {
  readonly tag: Tag | null
  readonly categories: readonly TagCategory[]
  readonly tags: readonly Tag[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, update } = useTagCommands()
  const [opened] = useState(tag)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.tags)
  }
  const firstCategory = liveCategories(categories)[0]?.id ?? null

  const form = useForm({
    defaultValues: opened === null ? newTagValues(firstCategory) : tagFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(tagFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run({ values: value, all: tags })
          : await update.run({ tag: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, TAG_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'tags.newTitle' : 'tags.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            labelKey="tags.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      {opened === null ? (
        <form.Field name="category_id">
          {(field) => (
            <SelectField
              labelKey="tags.category"
              name={field.name}
              value={field.state.value}
              options={categoryOptions(categories)}
              onChange={field.handleChange}
              error={fieldError(field.state.meta.errors, field.name, state.answered)}
            />
          )}
        </form.Field>
      ) : null}
      <form.Field name="color_key">
        {(field) => (
          <ColorField
            labelKey="palette.label"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <p className="text-name text-text-muted">{t('tags.colorHint')}</p>
    </EntityForm>
  )
}

function TagEditor(props: { readonly tag: Tag | null; readonly categories: readonly TagCategory[]; readonly tags: readonly Tag[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <TagForm
      key={generation}
      {...props}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function TagRow({
  tag,
  color,
  canUpdate,
  actions,
}: {
  readonly tag: Tag
  readonly color: string | null
  readonly canUpdate: boolean
  readonly actions: readonly RowAction[]
}) {
  const panel = usePanel()
  const text = <span className="truncate text-name font-semibold">{tag.name}</span>
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      <span aria-hidden className={`ms-xs size-dot shrink-0 rounded-pill ${toneOf(color).fill}`} />
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.tags, { entity: tag.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {text}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

/** One category's tags, a list named by the category's heading. */
function CategorySection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const headingId = useId()
  return (
    <section className="flex flex-col">
      <Heading id={headingId} level={3} className="px-xs pb-xs text-label font-semibold text-text-muted">
        {title}
      </Heading>
      <ul aria-labelledby={headingId} className="flex flex-col">
        {children}
      </ul>
    </section>
  )
}

export function TagsModule() {
  const panel = usePanel()
  const tags = useTags()
  const categories = useTagCategories()
  const permissions = useTagPermissions()
  const commands = useTagCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Tag | null>(null)

  if (tags.status === 'failed') return <FailureNotice error={tags.error} />
  if (categories.status === 'failed') return <FailureNotice error={categories.error} />
  if (tags.status === 'loading' || categories.status === 'loading') return <LoadingNotice />

  const all = tags.value
  const sections = tagSections(categories.value, all)
  const live = sections.flatMap((section) => section.tags)
  const newTag = () => {
    setFailure(null)
    panel.open(PANEL_IDS.tags, { entity: NEW_ENTITY })
  }

  if (sections.length === 0) {
    return (
      <EmptyNotice titleKey="tags.needsCategoryTitle" bodyKey="tags.needsCategoryBody">
        {permissions.create ? (
          <Button
            variant="primary"
            onPress={() => {
              panel.open(PANEL_IDS.tagCategories, { entity: NEW_ENTITY })
            }}
          >
            <Plus aria-hidden size={14} />
            {t('tagCategories.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  if (panel.entity === NEW_ENTITY) return <TagEditor tag={null} categories={categories.value} tags={all} />
  if (panel.entity !== null) {
    const tag = live.find((candidate) => candidate.id === panel.entity)
    if (tag === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('tags.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.tags)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <TagEditor key={tag.id} tag={tag} categories={categories.value} tags={all} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="tags.emptyTitle" bodyKey={permissions.create ? 'tags.emptyBody' : 'tags.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newTag}>
            <Plus aria-hidden size={14} />
            {t('tags.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const step = (tag: Tag, direction: -1 | 1) => {
    setFailure(null)
    void commands.step.run({ tag, direction, all }).then((result) => {
      if (!result.ok) setFailure(result.error)
    })
  }

  const actionsOf = (tag: Tag): RowAction[] => {
    const siblings = tagsOfCategory(all, tag.category_id)
    const index = siblings.findIndex((row) => row.id === tag.id)
    return [
      ...(permissions.update && index > 0
        ? [{ id: 'up', labelKey: 'common.stepUp' as const, icon: <ArrowUp aria-hidden size={14} />, onAction: () => { step(tag, -1) } }]
        : []),
      ...(permissions.update && index >= 0 && index < siblings.length - 1
        ? [{ id: 'down', labelKey: 'common.stepDown' as const, icon: <ArrowDown aria-hidden size={14} />, onAction: () => { step(tag, 1) } }]
        : []),
      ...(permissions.archive
        ? [
            {
              id: 'archive',
              labelKey: 'common.archive' as const,
              icon: <Archive aria-hidden size={14} />,
              onAction: () => {
                setFailure(null)
                setArchiving(tag)
              },
            },
          ]
        : []),
    ]
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('tags.hint')}</p>
      {failure === null ? null : <FailureNotice error={failure} />}
      {sections.map((section) => (
        <CategorySection key={section.category.id} title={section.category.name}>
          {section.tags.length === 0 ? (
            <li className="p-xs text-name text-text-muted">{t('tags.emptyCategory')}</li>
          ) : (
            section.tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                color={tagColorOf(tag, categories.value)}
                canUpdate={permissions.update}
                actions={actionsOf(tag)}
              />
            ))
          )}
        </CategorySection>
      ))}
      {permissions.create ? (
        <div>
          <Button onPress={newTag}>
            <Plus aria-hidden size={14} />
            {t('tags.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="tags.archiveTitle"
          hintKey="tags.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}
