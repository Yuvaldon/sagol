import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, TagCategory, TagSelectionMode } from '@contracts'
import { t } from '@i18n'
import {
  NEW_TAG_CATEGORY_VALUES,
  liveCategories,
  tagCategoryFormIssues,
  tagCategoryFormValues,
  usePanel,
  useTagCategories,
  useTagCategoryCommands,
  useTagPermissions,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
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

// The categories section of the tags drawer (D-130): an ordered list, each with its color and selection mode. Up
// and down in the row menu set the order, as for leave type groups (D-113).

const CATEGORY_FIELDS: readonly string[] = ['name', 'selection_mode', 'color_key']

const MODE_OPTIONS: readonly SelectOption<TagSelectionMode>[] = [
  { key: 'multiple', label: { key: 'tagCategories.selectionMultiple' }, value: 'multiple' },
  { key: 'single', label: { key: 'tagCategories.selectionSingle' }, value: 'single' },
]

function CategoryForm({
  category,
  categories,
  onReload,
}: {
  readonly category: TagCategory | null
  readonly categories: readonly TagCategory[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, update } = useTagCategoryCommands()
  const [opened] = useState(category)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.tagCategories)
  }

  const form = useForm({
    defaultValues: opened === null ? NEW_TAG_CATEGORY_VALUES : tagCategoryFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(tagCategoryFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run({ values: value, all: categories })
          : await update.run({ category: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, CATEGORY_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'tagCategories.newTitle' : 'tagCategories.editTitle'}
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
            labelKey="tagCategories.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="selection_mode">
        {(field) => (
          <SelectField
            labelKey="tagCategories.selectionMode"
            name={field.name}
            value={field.state.value}
            options={MODE_OPTIONS}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
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
    </EntityForm>
  )
}

function CategoryEditor({ category, categories }: { readonly category: TagCategory | null; readonly categories: readonly TagCategory[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <CategoryForm
      key={generation}
      category={category}
      categories={categories}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

export function TagCategoriesModule() {
  const panel = usePanel()
  const categories = useTagCategories()
  const permissions = useTagPermissions()
  const commands = useTagCategoryCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<TagCategory | null>(null)

  if (categories.status === 'failed') return <FailureNotice error={categories.error} />
  if (categories.status === 'loading') return <LoadingNotice />

  const live = liveCategories(categories.value)
  const newCategory = () => {
    setFailure(null)
    panel.open(PANEL_IDS.tagCategories, { entity: NEW_ENTITY })
  }

  if (panel.entity === NEW_ENTITY) return <CategoryEditor category={null} categories={categories.value} />
  if (panel.entity !== null) {
    const category = live.find((candidate) => candidate.id === panel.entity)
    if (category === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('tagCategories.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.tagCategories)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <CategoryEditor key={category.id} category={category} categories={categories.value} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="tagCategories.emptyTitle" bodyKey={permissions.create ? undefined : 'tagCategories.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newCategory}>
            <Plus aria-hidden size={14} />
            {t('tagCategories.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const step = (category: TagCategory, direction: -1 | 1) => {
    setFailure(null)
    void commands.step.run({ category, direction, all: categories.value }).then((result) => {
      if (!result.ok) setFailure(result.error)
    })
  }

  const actionsOf = (category: TagCategory, index: number): RowAction[] => [
    ...(permissions.update && index > 0
      ? [{ id: 'up', labelKey: 'common.stepUp' as const, icon: <ArrowUp aria-hidden size={14} />, onAction: () => { step(category, -1) } }]
      : []),
    ...(permissions.update && index < live.length - 1
      ? [{ id: 'down', labelKey: 'common.stepDown' as const, icon: <ArrowDown aria-hidden size={14} />, onAction: () => { step(category, 1) } }]
      : []),
    ...(permissions.archive
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive' as const,
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(category)
            },
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-md">
      {failure === null ? null : <FailureNotice error={failure} />}
      <ul aria-label={t('tagCategories.listLabel')} className="flex flex-col">
        {live.map((category, index) => {
          const text = (
            <span className="flex min-w-none flex-col">
              <span className="truncate text-name font-semibold">{category.name}</span>
              {category.selection_mode === 'single' ? (
                <span className="truncate text-micro text-text-muted">{t('tagCategories.single')}</span>
              ) : null}
            </span>
          )
          return (
            <li key={category.id} className="flex items-center gap-2xs border-b border-line bg-surface">
              <span aria-hidden className={`ms-xs size-dot shrink-0 rounded-pill ${toneOf(category.color_key).fill}`} />
              {permissions.update ? (
                <AriaButton
                  onPress={() => {
                    panel.open(PANEL_IDS.tagCategories, { entity: category.id })
                  }}
                  className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
                >
                  {text}
                </AriaButton>
              ) : (
                <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
              )}
              <ActionMenu labelKey="common.actions" actions={actionsOf(category, index)} />
            </li>
          )
        })}
      </ul>
      {permissions.create ? (
        <div>
          <Button onPress={newCategory}>
            <Plus aria-hidden size={14} />
            {t('tagCategories.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="tagCategories.archiveTitle"
          hintKey="tagCategories.archiveBody"
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
