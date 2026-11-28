import { SHELL } from '@config'
import { CalendarDate, type CommandRank, type JsonValue, type PropertyDefinition, type TagId } from '@contracts'
import { t } from '@i18n'
import {
  cardTagsSelected,
  chosenAfter,
  definitionsOf,
  fullName,
  openMembershipOf,
  optionsOf,
  useCommandRanks,
  useMemberships,
  usePropertyDefinitions,
  useSoldierPagePermissions,
  useSoldiers,
  useTagCategories,
  useTags,
  useUnits,
  type CardTags,
} from '@logic'
import { Check, Copy, Pencil, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { rankOptions } from '../../modules/soldiers/rankOptions'
import { FailureNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { fieldError, issueError } from '../../patterns/forms'
import { PropertyFields } from '../../patterns/properties/PropertyFields'
import { propertyFieldName } from '../../patterns/properties/usePropertyFields'
import { IconButton } from '../../primitives/Button'
import { SelectField } from '../../primitives/SelectField'
import { TextField } from '../../primitives/fields'
import { TagPicker } from './TagPicker'
import type { ProfileEdit } from './useProfileEdit'

// The profile of "אני" and the person card, one component (the handoff's "the profile is my person card", D-489): the
// tags, the personal number and the phone with copy, and, expanded, the details and the custom fields. The pencil turns
// the same fields into inputs in place, each by its permission; ✕ puts back, ✓ saves and the toast offers "ביטול"
// (OI-401). The unit is never edited here: a transfer is the card's "⋯" (D-483).

const SEPARATOR = ', '
const NO_ROWS: readonly never[] = []

/**
 * A value with its label and a copy button: the personal number and the phone are copied all day (the handoff's Me).
 * The answer shows under the value, where the eye already is.
 */
export function CopyField({ labelKey, value }: { readonly labelKey: 'soldiers.personalId' | 'soldiers.phone'; readonly value: string }) {
  const [answer, setAnswer] = useState<'manage.person.copied' | 'presence.copyFailed' | null>(null)
  useEffect(() => {
    if (answer === null) return undefined
    const timer = setTimeout(() => {
      setAnswer(null)
    }, SHELL.toastMs)
    return () => {
      clearTimeout(timer)
    }
  }, [answer])
  return (
    <div className="flex min-w-none flex-1 items-end gap-xs">
      <div className="flex min-w-none flex-col">
        <span className="text-small text-text-muted">{t(labelKey)}</span>
        <span dir="ltr" className="truncate text-start text-heading font-bold tabular-nums">
          {value}
        </span>
        <span role="status" className="text-small text-text-muted">
          {answer === null ? null : t(answer)}
        </span>
      </div>
      <IconButton
        labelKey={labelKey === 'soldiers.personalId' ? 'manage.person.copyPersonalId' : 'manage.person.copyPhone'}
        onPress={() => {
          // An insecure page or an old browser has no clipboard at all.
          if (typeof navigator.clipboard?.writeText !== 'function') {
            setAnswer('presence.copyFailed')
            return
          }
          navigator.clipboard.writeText(value).then(
            () => {
              setAnswer('manage.person.copied')
            },
            () => {
              setAnswer('presence.copyFailed')
            },
          )
        }}
      >
        <Copy aria-hidden size={18} />
      </IconButton>
    </div>
  )
}

/** The pencil, or ✕ and ✓ while editing; with nothing the actor may change, nothing. */
export function EditControls({ edit, after = null }: { readonly edit: ProfileEdit; readonly after?: ReactNode }) {
  if (edit.editing) {
    return (
      <div className="flex items-center gap-xs">
        <IconButton labelKey="profile.cancel" onPress={edit.cancel}>
          <X aria-hidden size={20} />
        </IconButton>
        <AriaButton
          aria-label={t('profile.save')}
          isDisabled={edit.isPending}
          onPress={edit.save}
          className="inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full bg-action-solid text-on-action shadow-primary outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <Check aria-hidden size={20} />
        </AriaButton>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-xs">
      {edit.can ? (
        <IconButton labelKey="profile.edit" onPress={edit.start}>
          <Pencil aria-hidden size={20} />
        </IconButton>
      ) : null}
      {after}
    </div>
  )
}

/** The tags held now, as chips; in the edit, each with ✕ and "+" at the end (the handoff's Notion-like multi-select). */
function Tags({ edit, names }: { readonly edit: ProfileEdit; readonly names: readonly string[] }) {
  const categories = useTagCategories()
  const tags = useTags()
  const card = edit.opened?.tags ?? null
  if (!edit.editing || !edit.editable.tags || card === null || categories.status !== 'ready' || tags.status !== 'ready') {
    if (names.length === 0) return null
    return (
      <ul aria-label={t('soldiers.tagsTitle')} className="flex flex-wrap gap-xs">
        {names.map((name) => (
          <li key={name} className="rounded-full bg-action-soft px-cozy py-xs text-small font-semibold text-on-action-soft">
            {name}
          </li>
        ))}
      </ul>
    )
  }
  const selectedOf = (group: CardTags['groups'][number]) => edit.chosen.get(group.category.id) ?? cardTagsSelected(card, group)
  const held = new Set(card.groups.flatMap(selectedOf))
  const byId = new Map(tags.value.map((tag) => [tag.id, tag]))
  const toggle = (group: CardTags['groups'][number], tagId: TagId, on: boolean) => {
    edit.setChosen(chosenAfter(edit.chosen, card, group, tagId, on))
  }
  return (
    <ul aria-label={t('soldiers.tagsTitle')} className="flex flex-wrap items-center gap-xs">
      {card.groups.flatMap((group) =>
        selectedOf(group).map((tagId) => (
          <li key={tagId} className="inline-flex min-h-touch items-center gap-2xs rounded-full bg-action-soft ps-cozy text-small font-semibold text-on-action-soft">
            {byId.get(tagId)?.name ?? ''}
            <IconButton
              labelKey="profile.tagRemove"
              onPress={() => {
                toggle(group, tagId, false)
              }}
            >
              <X aria-hidden size={14} />
            </IconButton>
          </li>
        )),
      )}
      <li>
        <TagPicker
          groups={card.groups}
          categories={categories.value}
          tags={tags.value}
          stateOf={(tagId) => (held.has(tagId) ? 'on' : 'off')}
          onToggle={toggle}
          onCreated={(tag) => {
            // A tag made here is not in the groups the edit opened on: it joins its category's choice at once.
            const single = categories.value.find((category) => category.id === tag.category_id)?.selection_mode === 'single'
            const group = card.groups.find((candidate) => candidate.category.id === tag.category_id)
            const before = group === undefined ? (edit.chosen.get(tag.category_id) ?? []) : selectedOf(group)
            edit.setChosen(new Map(edit.chosen).set(tag.category_id, single ? [tag.id] : [...before, tag.id]))
          }}
        />
      </li>
    </ul>
  )
}

const errorOf = (edit: ProfileEdit, name: string) => fieldError([], name, edit.answered)

/** The personal number and the phone: copied, or typed in the edit (D-018). */
function Contact({ edit }: { readonly edit: ProfileEdit }) {
  if (edit.editing && edit.editable.private) {
    return (
      <div className="grid grid-cols-2 gap-md">
        <TextField labelKey="soldiers.personalId" name="personal_id" inputMode="numeric" dir="ltr" value={edit.values.personal_id} onChange={(value) => { edit.set('personal_id', value) }} error={errorOf(edit, 'personal_id')} />
        <TextField labelKey="soldiers.phone" name="phone" inputMode="tel" dir="ltr" value={edit.values.phone} onChange={(value) => { edit.set('phone', value) }} error={errorOf(edit, 'phone')} />
      </div>
    )
  }
  if (!edit.viewPrivate || edit.row === null) return null
  const personalId = edit.row.personal_id ?? ''
  const phone = edit.row.phone ?? ''
  if (personalId === '' && phone === '') return null
  return (
    <div className="flex gap-lg">
      {personalId === '' ? null : <CopyField labelKey="soldiers.personalId" value={personalId} />}
      {phone === '' ? null : <CopyField labelKey="soldiers.phone" value={phone} />}
    </div>
  )
}

function DetailRow({ label, value, ltr = false }: { readonly label: string; readonly value: string; readonly ltr?: boolean }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-md border-b border-divider py-xs">
      <dt className="shrink-0 text-body text-text-muted">{label}</dt>
      <dd dir={ltr && value !== '' ? 'ltr' : undefined} className="min-w-none truncate text-body">
        {value === '' ? t('soldiers.emptyValue') : value}
      </dd>
    </div>
  )
}

/** A custom field's value in words: an option's label, a soldier's or a unit's name, a date, yes or no. */
function propertyText(definition: PropertyDefinition, value: JsonValue | undefined, names: { readonly soldier: (id: string) => string; readonly unit: (id: string) => string }): string {
  if (value === undefined || value === null) return ''
  const optionLabel = (id: JsonValue) => optionsOf(definition).find((option) => option.id === id)?.label ?? ''
  switch (definition.data_type) {
    case 'boolean':
      return t(value === true ? 'properties.yes' : 'properties.no')
    case 'select':
      return optionLabel(value)
    case 'multi_select':
      return Array.isArray(value) ? value.map(optionLabel).join(SEPARATOR) : ''
    case 'date': {
      const date = CalendarDate.safeParse(value)
      return date.success ? formatDate(date.data) : ''
    }
    case 'soldier_ref':
      return typeof value === 'string' ? names.soldier(value) : ''
    case 'unit_ref':
      return typeof value === 'string' ? names.unit(value) : ''
    case 'number':
    case 'text':
      return String(value)
  }
}

/** "שדות נוספים": the organization's custom fields, in its order (D-016); inputs in the edit, for who may change them. */
function MoreFields({ edit }: { readonly edit: ProfileEdit }) {
  const definitions = usePropertyDefinitions()
  const soldiers = useSoldiers()
  const units = useUnits()
  const defs = definitions.status === 'ready' ? definitionsOf(definitions.value, 'soldier') : []
  if (defs.length === 0) return null
  if (edit.editing && edit.editable.profile) {
    return (
      <section className="flex flex-col gap-md">
        <h3 className="text-small font-bold text-text-muted">{t('profile.moreFields')}</h3>
        <PropertyFields
          fields={{ definitions: defs, values: edit.properties, set: edit.setProperty, withProperties: {}, fieldNames: defs.map(propertyFieldName) }}
          errorOf={(name) => issueError([], edit.answered, name)}
        />
      </section>
    )
  }
  const soldierNames = new Map<string, string>((soldiers.status === 'ready' ? soldiers.value : NO_ROWS).map((soldier) => [soldier.id, fullName(soldier)]))
  const unitNames = new Map<string, string>((units.status === 'ready' ? units.value : NO_ROWS).map((unit) => [unit.id, unit.name]))
  const names = { soldier: (id: string) => soldierNames.get(id) ?? '', unit: (id: string) => unitNames.get(id) ?? '' }
  return (
    <section className="flex flex-col">
      <h3 className="text-small font-bold text-text-muted">{t('profile.moreFields')}</h3>
      <dl className="flex flex-col">
        {defs.map((definition) => (
          <DetailRow key={definition.id} label={definition.label} value={propertyText(definition, edit.soldier.properties[definition.id], names)} />
        ))}
      </dl>
    </section>
  )
}

/** "פרטים": the name and the command rank in the edit, the nickname, since when in the unit, the email. */
function Details({ edit }: { readonly edit: ProfileEdit }) {
  const units = useUnits()
  const permissions = useSoldierPagePermissions(edit.soldier, units.status === 'ready' ? units.value : NO_ROWS)
  const memberships = useMemberships()
  const ranks = useCommandRanks()
  const profile = edit.editing && edit.editable.profile
  const email = edit.editing && edit.editable.private
  const open = permissions.viewMemberships && memberships.status === 'ready' ? openMembershipOf(memberships.value, edit.soldier.id) : null
  const rankList: readonly CommandRank[] = ranks.status === 'ready' ? ranks.value : NO_ROWS
  return (
    <section className="flex flex-col gap-xs">
      <h3 className="text-small font-bold text-text-muted">{t('profile.details')}</h3>
      {profile ? (
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-md">
            <TextField labelKey="soldiers.firstName" name="first_name" isRequired value={edit.values.first_name} onChange={(value) => { edit.set('first_name', value) }} error={errorOf(edit, 'first_name')} />
            <TextField labelKey="soldiers.lastName" name="last_name" isRequired value={edit.values.last_name} onChange={(value) => { edit.set('last_name', value) }} error={errorOf(edit, 'last_name')} />
          </div>
          <TextField labelKey="soldiers.nickname" name="nickname" value={edit.values.nickname} onChange={(value) => { edit.set('nickname', value) }} error={errorOf(edit, 'nickname')} />
          <SelectField
            labelKey="soldiers.rank"
            name="command_rank_id"
            value={edit.values.command_rank_id}
            options={rankOptions(rankList, edit.soldier.command_rank_id)}
            onChange={(value) => {
              edit.set('command_rank_id', value)
            }}
            error={errorOf(edit, 'command_rank_id')}
          />
        </div>
      ) : null}
      <dl className="flex flex-col">
        {profile ? null : <DetailRow label={t('soldiers.nickname')} value={edit.soldier.nickname ?? ''} />}
        {open === null ? null : <DetailRow label={t('profile.placedSince')} value={formatDate(open.valid_from)} />}
        {email || !edit.viewPrivate ? null : <DetailRow label={t('profile.email')} value={edit.row?.invite_email ?? ''} ltr />}
      </dl>
      {email ? (
        <TextField labelKey="profile.email" name="invite_email" inputMode="email" dir="ltr" value={edit.values.invite_email} onChange={(value) => { edit.set('invite_email', value) }} error={errorOf(edit, 'invite_email')} />
      ) : null}
    </section>
  )
}

/**
 * The profile's body: the tags, the contact, and, expanded or in the edit, the details and the custom fields. The name,
 * the unit and the controls are the holder's: the open block of "אני", or the card's head.
 */
export function ProfileBody({ edit, tags, expanded }: { readonly edit: ProfileEdit; readonly tags: readonly string[]; readonly expanded: boolean }) {
  return (
    <div className="flex flex-col gap-lg">
      <Tags edit={edit} names={tags} />
      <Contact edit={edit} />
      {expanded || edit.editing ? (
        <>
          <Details edit={edit} />
          <MoreFields edit={edit} />
        </>
      ) : null}
      {edit.failure === null ? null : <FailureNotice error={edit.failure} />}
    </div>
  )
}
