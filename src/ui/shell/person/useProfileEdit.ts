import type { AppError, Issue, Soldier, SoldierPrivate, TagCategoryId, TagId } from '@contracts'
import { t } from '@i18n'
import {
  cardEditIssues,
  cardEditValues,
  definitionsOf,
  propertyFormValues,
  toStoredProperties,
  useCardEditable,
  useCardSave,
  useCardTags,
  usePropertyDefinitions,
  useSoldierPagePermissions,
  useSoldierPrivate,
  useUnits,
  type CardEditable,
  type CardEditValues,
  type CardTags,
  type PropertyFieldValue,
  type PropertyFormValues,
} from '@logic'
import { useState } from 'react'
import { formStateOf } from '../../patterns/forms'
import { propertyFieldName } from '../../patterns/properties/usePropertyFields'
import { useNotices } from '../notices'

// The state of the card's edit in place (OI-401, D-489), held by whoever places its ✕ and ✓: the open block of "אני",
// or the person card's tools. The fields it opens on are kept, so the save is guarded by their versions.

const NO_ROWS: readonly never[] = []
const NO_ISSUES: readonly Issue[] = []
const FIELDS: readonly string[] = ['first_name', 'last_name', 'nickname', 'command_rank_id', 'personal_id', 'invite_email', 'phone']
const NO_CHOSEN: ReadonlyMap<TagCategoryId, readonly TagId[]> = new Map()

/** What the edit opened on: the save is guarded by these versions (D-012). */
export interface Opened {
  readonly soldier: Soldier
  readonly row: SoldierPrivate | null
  readonly tags: CardTags | null
}

export interface ProfileEdit {
  readonly soldier: Soldier
  readonly editable: CardEditable
  /** Whether the actor may change anything here: the pencil shows only then (D-463). */
  readonly can: boolean
  readonly editing: boolean
  readonly isPending: boolean
  readonly start: () => void
  readonly cancel: () => void
  readonly save: () => void
  readonly values: CardEditValues
  readonly set: (field: keyof CardEditValues, value: string | null) => void
  readonly properties: PropertyFormValues
  readonly setProperty: (id: string, value: PropertyFieldValue) => void
  readonly chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>
  readonly setChosen: (next: ReadonlyMap<TagCategoryId, readonly TagId[]>) => void
  readonly opened: Opened | null
  readonly answered: readonly Issue[]
  readonly failure: AppError | null
  /** The private row as read, for who reads it (D-018). */
  readonly row: SoldierPrivate | null
  readonly viewPrivate: boolean
}

/** The edit's state, held by whoever places its ✕ and ✓: the block of "אני", or the card's tools. */
export function useProfileEdit(soldier: Soldier): ProfileEdit {
  const editable = useCardEditable(soldier)
  const units = useUnits()
  const permissions = useSoldierPagePermissions(soldier, units.status === 'ready' ? units.value : NO_ROWS)
  const privateRow = useSoldierPrivate(soldier.id, permissions.viewPrivate)
  const row = privateRow.status === 'ready' ? privateRow.value : null
  const cardTags = useCardTags(soldier)
  const definitions = usePropertyDefinitions()
  const save = useCardSave()
  const notices = useNotices()
  const [opened, setOpened] = useState<Opened | null>(null)
  const [values, setValues] = useState<CardEditValues>(() => cardEditValues(soldier, row))
  const [edited, setEdited] = useState<PropertyFormValues>({})
  const [chosen, setChosen] = useState<ReadonlyMap<TagCategoryId, readonly TagId[]>>(NO_CHOSEN)
  const [answered, setAnswered] = useState<readonly Issue[]>(NO_ISSUES)
  const [failure, setFailure] = useState<AppError | null>(null)
  const privateReady = !editable.private || privateRow.status === 'ready'
  const can = (editable.profile || editable.private || editable.tags) && privateReady
  const defs = definitions.status === 'ready' ? definitionsOf(definitions.value, 'soldier') : []
  const stored = opened?.soldier.properties ?? soldier.properties
  const properties = { ...propertyFormValues(defs, stored), ...edited }
  const reset = () => {
    setOpened(null)
    setEdited({})
    setChosen(NO_CHOSEN)
    setAnswered(NO_ISSUES)
    setFailure(null)
  }
  return {
    soldier,
    editable,
    can,
    editing: opened !== null,
    isPending: save.isPending,
    start: () => {
      setValues(cardEditValues(soldier, row))
      setOpened({ soldier, row, tags: cardTags.status === 'ready' ? cardTags.value : null })
    },
    cancel: reset,
    save: () => {
      if (opened === null) return
      const issues = cardEditIssues(opened.soldier, editable, values)
      setAnswered(issues)
      setFailure(null)
      if (issues.length > 0) return
      const withProperties = definitions.status === 'ready' ? { properties: toStoredProperties(defs, opened.soldier.properties, properties) } : {}
      void save
        .run({
          soldier: opened.soldier,
          privateRow: opened.row,
          editable,
          values,
          properties: withProperties,
          tags: opened.tags === null || chosen.size === 0 ? null : { card: opened.tags, chosen },
        })
        .then((result) => {
          if (!result.ok) {
            const state = formStateOf(result.error, [...FIELDS, ...defs.map(propertyFieldName)])
            setAnswered(state.answered)
            setFailure(state.failure)
            return
          }
          reset()
          if (!result.value.changed) return
          const { undo } = result.value
          notices.say(t('profile.saved'), {
            labelKey: 'profile.undo',
            run: () => {
              void save.run(undo).then((undone) => {
                if (!undone.ok) notices.fail(undone.error)
              })
            },
          })
        })
    },
    values,
    set: (field, value) => {
      setValues((current) => ({ ...current, [field]: value }))
    },
    properties,
    setProperty: (id, value) => {
      setEdited((current) => ({ ...current, [id]: value }))
    },
    chosen,
    setChosen,
    opened,
    answered,
    failure,
    row,
    viewPrivate: permissions.viewPrivate,
  }
}

