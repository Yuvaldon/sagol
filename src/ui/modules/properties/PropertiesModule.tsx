import { NEW_ENTITY, PANEL_IDS } from '@config'
import { PropertyDataType, PropertyEntityType, type AppError, type Issue, type PropertyDefinition } from '@contracts'
import { t } from '@i18n'
import {
  definitionsOf,
  hasOptions,
  newPropertyDefinitionValues,
  newPropertyOption,
  propertyDefinitionFormIssues,
  propertyDefinitionFormValues,
  usePanel,
  usePropertyDefinitionCommands,
  usePropertyDefinitions,
  usePropertyPermissions,
  type PropertyDefinitionFormValues,
  type PropertyOptionFormValues,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button as AriaButton, Heading } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, issueError, validatorResult } from '../../patterns/forms'
import { Button, IconButton } from '../../primitives/Button'
import { ColorField } from '../../primitives/ColorField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SwitchField } from '../../primitives/SwitchField'
import { TextField } from '../../primitives/fields'
import { DATA_TYPE_KEYS, ENTITY_TYPE_KEYS } from './labels'

// The custom properties module (D-016): the definitions of each entity type, in the order their fields appear in the
// entity's form. Up and down in the row menu reorder them. The entity type and the data type are chosen at creation.

const PROPERTY_FIELDS: readonly string[] = ['label', 'entity_type', 'data_type', 'is_required', 'options']

/** The fields of the form, the label of each option row among them, so an answer on a row lands on it. */
function fieldsOf(values: PropertyDefinitionFormValues): string[] {
  return [...PROPERTY_FIELDS, ...values.options.map((_, index) => `options.${String(index)}.label`)]
}

const ENTITY_OPTIONS: SelectOption<PropertyEntityType>[] = PropertyEntityType.options.map((type) => ({
  key: type,
  label: { key: ENTITY_TYPE_KEYS[type] },
  value: type,
}))

const DATA_TYPE_OPTIONS: SelectOption<PropertyDataType>[] = PropertyDataType.options.map((type) => ({
  key: type,
  label: { key: DATA_TYPE_KEYS[type] },
  value: type,
}))

function moved<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  const next = [...items]
  const [item] = next.splice(index, 1)
  if (item === undefined || target < 0 || target > items.length - 1) return [...items]
  next.splice(target, 0, item)
  return next
}

/** The options of a select or multi-select property: their order here is their order in its field. */
function OptionsEditor({
  options,
  onChange,
  errorOf,
  groupError,
}: {
  readonly options: readonly PropertyOptionFormValues[]
  readonly onChange: (options: PropertyOptionFormValues[]) => void
  readonly errorOf: (index: number) => ReturnType<typeof issueError>
  readonly groupError: ReturnType<typeof issueError>
}) {
  const headingId = useId()
  const change = (index: number, patch: Partial<PropertyOptionFormValues>) => {
    onChange(options.map((option, at) => (at === index ? { ...option, ...patch } : option)))
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-sm">
      <Heading id={headingId} level={3} className="text-label font-semibold text-text-muted">
        {t('properties.options')}
      </Heading>
      {options.length === 0 ? <p className="text-name text-text-muted">{t('properties.noOptions')}</p> : null}
      {groupError === null ? null : <p className="text-label text-status-rejected">{t(groupError)}</p>}
      <ol className="flex flex-col gap-sm">
        {options.map((option, index) => (
          <li key={option.id} className="flex flex-col gap-xs rounded-control border border-line p-sm">
            <TextField
              labelKey="properties.optionLabel"
              name={`options.${String(index)}.label`}
              isRequired
              value={option.label}
              onChange={(label) => {
                change(index, { label })
              }}
              error={errorOf(index)}
            />
            <ColorField
              labelKey="palette.label"
              name={`options.${String(index)}.color_key`}
              value={option.color_key}
              onChange={(color_key) => {
                change(index, { color_key })
              }}
              error={null}
            />
            <div className="flex justify-end gap-2xs">
              {index > 0 ? (
                <IconButton
                  labelKey="common.stepUp"
                  onPress={() => {
                    onChange(moved(options, index, -1))
                  }}
                >
                  <ArrowUp aria-hidden size={14} />
                </IconButton>
              ) : null}
              {index < options.length - 1 ? (
                <IconButton
                  labelKey="common.stepDown"
                  onPress={() => {
                    onChange(moved(options, index, 1))
                  }}
                >
                  <ArrowDown aria-hidden size={14} />
                </IconButton>
              ) : null}
              <IconButton
                labelKey="properties.removeOption"
                onPress={() => {
                  onChange(options.filter((_, at) => at !== index))
                }}
              >
                <X aria-hidden size={14} />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          onPress={() => {
            onChange([...options, newPropertyOption()])
          }}
        >
          <Plus aria-hidden size={14} />
          {t('properties.addOption')}
        </Button>
      </div>
    </section>
  )
}

function PropertyForm({
  definition,
  all,
  onReload,
}: {
  readonly definition: PropertyDefinition | null
  readonly all: readonly PropertyDefinition[]
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, update } = usePropertyDefinitionCommands()
  const [opened] = useState(definition)
  const [state, setState] = useState(CLEAN_FORM)
  // Option rows are not fields of their own: once a submit was tried, their issues are read from the values.
  const [attempted, setAttempted] = useState(false)
  const backToList = () => {
    panel.open(PANEL_IDS.properties)
  }

  const form = useForm({
    defaultValues: opened === null ? newPropertyDefinitionValues('soldier') : propertyDefinitionFormValues(opened),
    validators: { onSubmit: ({ value }) => validatorResult(propertyDefinitionFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run({ values: value, all })
          : await update.run({ definition: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, fieldsOf(value)))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'properties.newTitle' : 'properties.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        setAttempted(true)
        void form.handleSubmit()
      }}
    >
      <form.Field name="label">
        {(field) => (
          <TextField
            labelKey="properties.label"
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
        <>
          <form.Field name="entity_type">
            {(field) => (
              <SelectField
                labelKey="properties.entityType"
                name={field.name}
                value={field.state.value}
                options={ENTITY_OPTIONS}
                onChange={field.handleChange}
                error={fieldError(field.state.meta.errors, field.name, state.answered)}
              />
            )}
          </form.Field>
          <form.Field name="data_type">
            {(field) => (
              <SelectField
                labelKey="properties.dataType"
                name={field.name}
                value={field.state.value}
                options={DATA_TYPE_OPTIONS}
                onChange={field.handleChange}
                error={fieldError(field.state.meta.errors, field.name, state.answered)}
              />
            )}
          </form.Field>
          <p className="text-name text-text-muted">{t('properties.fixedHint')}</p>
        </>
      ) : (
        <p className="text-name text-text-muted">{[t(ENTITY_TYPE_KEYS[opened.entity_type]), t(DATA_TYPE_KEYS[opened.data_type])].join(' · ')}</p>
      )}
      <form.Field name="is_required">
        {(field) => <SwitchField labelKey="properties.required" name={field.name} value={field.state.value} onChange={field.handleChange} />}
      </form.Field>
      <form.Subscribe selector={(current) => current.values}>
        {(values) =>
          hasOptions(values.data_type) ? (
            <form.Field name="options">
              {(field) => {
                const own: Issue[] = attempted ? propertyDefinitionFormIssues(values) : []
                return (
                  <OptionsEditor
                    options={field.state.value}
                    onChange={field.handleChange}
                    errorOf={(index) => issueError(own, state.answered, `options.${String(index)}.label`)}
                    groupError={issueError(own, state.answered, 'options')}
                  />
                )
              }}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
    </EntityForm>
  )
}

function PropertyEditor(props: { readonly definition: PropertyDefinition | null; readonly all: readonly PropertyDefinition[] }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <PropertyForm
      key={generation}
      {...props}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function PropertyRow({
  definition,
  canUpdate,
  actions,
}: {
  readonly definition: PropertyDefinition
  readonly canUpdate: boolean
  readonly actions: readonly RowAction[]
}) {
  const panel = usePanel()
  const text = (
    <span className="flex min-w-none flex-col">
      <span className="truncate text-name font-semibold">{definition.label}</span>
      <span className="truncate text-label text-text-muted">
        {[t(DATA_TYPE_KEYS[definition.data_type]), ...(definition.is_required ? [t('properties.requiredMark')] : [])].join(' · ')}
      </span>
    </span>
  )
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.properties, { entity: definition.id })
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

/** One entity type's definitions, a list named by its heading. */
function EntitySection({ title, children }: { readonly title: string; readonly children: ReactNode }) {
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

export function PropertiesModule() {
  const panel = usePanel()
  const definitions = usePropertyDefinitions()
  const permissions = usePropertyPermissions()
  const commands = usePropertyDefinitionCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<PropertyDefinition | null>(null)

  if (definitions.status === 'failed') return <FailureNotice error={definitions.error} />
  if (definitions.status === 'loading') return <LoadingNotice />

  const all = definitions.value
  const sections = PropertyEntityType.options.map((type) => ({ type, definitions: definitionsOf(all, type) }))
  const live = sections.flatMap((section) => section.definitions)
  const newDefinition = () => {
    setFailure(null)
    panel.open(PANEL_IDS.properties, { entity: NEW_ENTITY })
  }

  if (panel.entity === NEW_ENTITY && permissions.create) return <PropertyEditor definition={null} all={all} />
  if (panel.entity !== null) {
    // Only who may change a definition opens its form (D-076).
    const definition = permissions.update ? live.find((candidate) => candidate.id === panel.entity) : undefined
    if (definition === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('properties.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.properties)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <PropertyEditor key={definition.id} definition={definition} all={all} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="properties.emptyTitle" bodyKey={permissions.create ? 'properties.emptyBody' : 'properties.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newDefinition}>
            <Plus aria-hidden size={14} />
            {t('properties.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const step = (definition: PropertyDefinition, direction: -1 | 1) => {
    setFailure(null)
    void commands.step.run({ definition, direction, all }).then((result) => {
      if (!result.ok) setFailure(result.error)
    })
  }

  const actionsOf = (definition: PropertyDefinition, siblings: readonly PropertyDefinition[]): RowAction[] => {
    const index = siblings.findIndex((row) => row.id === definition.id)
    return [
      ...(permissions.update && index > 0
        ? [{ id: 'up', labelKey: 'common.stepUp' as const, icon: <ArrowUp aria-hidden size={14} />, onAction: () => { step(definition, -1) } }]
        : []),
      ...(permissions.update && index >= 0 && index < siblings.length - 1
        ? [{ id: 'down', labelKey: 'common.stepDown' as const, icon: <ArrowDown aria-hidden size={14} />, onAction: () => { step(definition, 1) } }]
        : []),
      ...(permissions.archive
        ? [
            {
              id: 'archive',
              labelKey: 'common.archive' as const,
              icon: <Archive aria-hidden size={14} />,
              onAction: () => {
                setFailure(null)
                setArchiving(definition)
              },
            },
          ]
        : []),
    ]
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('properties.hint')}</p>
      {failure === null ? null : <FailureNotice error={failure} />}
      {sections.map((section) => (
        <EntitySection key={section.type} title={t(ENTITY_TYPE_KEYS[section.type])}>
          {section.definitions.length === 0 ? (
            <li className="p-xs text-name text-text-muted">{t('properties.emptyEntity')}</li>
          ) : (
            section.definitions.map((definition) => (
              <PropertyRow
                key={definition.id}
                definition={definition}
                canUpdate={permissions.update}
                actions={actionsOf(definition, section.definitions)}
              />
            ))
          )}
        </EntitySection>
      ))}
      {permissions.create ? (
        <div>
          <Button onPress={newDefinition}>
            <Plus aria-hidden size={14} />
            {t('properties.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="properties.archiveTitle"
          hintKey="properties.archiveBody"
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
