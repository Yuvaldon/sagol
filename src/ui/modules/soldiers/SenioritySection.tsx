import type { AppError, CalendarDate, Issue, SeniorityOverride, Soldier } from '@contracts'
import { t } from '@i18n'
import {
  currentOverride,
  newSeniorityOverrideValues,
  overridesOf,
  seniorityOverrideIssues,
  useSeniorityOverrideCommands,
  useSeniorityOverrides,
  useSeniorityPermissions,
  type SeniorityOverrideFormValues,
} from '@logic'
import { Plus, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { fieldError, formStateOf } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { TextField } from '../../primitives/fields'

// Personal seniority (D-029, D-179): an override is created and revoked, never edited. A revoked one stays as history.
// The section shows only for who may read the soldier's overrides (D-076).

const OVERRIDE_FIELDS: readonly string[] = ['seniority', 'valid_from', 'valid_to', 'reason']
const PART_SEPARATOR = ' · '

function CreateDialog({ soldier, today, onClose }: { readonly soldier: Soldier; readonly today: CalendarDate; readonly onClose: () => void }) {
  const { create } = useSeniorityOverrideCommands(soldier.id)
  const [values, setValues] = useState<SeniorityOverrideFormValues>(() => newSeniorityOverrideValues(today))
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)
  const change = (patch: Partial<SeniorityOverrideFormValues>) => {
    setValues((current) => ({ ...current, ...patch }))
  }

  async function submit() {
    setFailure(null)
    const issues = seniorityOverrideIssues(soldier.id, values)
    setAnswered(issues)
    if (issues.length > 0) return
    const result = await create.run(values)
    if (result.ok) {
      onClose()
      return
    }
    const state = formStateOf(result.error, OVERRIDE_FIELDS)
    setAnswered(state.answered)
    setFailure(state.failure)
  }

  return (
    <SmallDialog
      titleKey="seniority.newTitle"
      hintKey="seniority.newHint"
      confirmKey="common.create"
      isPending={create.isPending}
      onCancel={onClose}
      onConfirm={() => {
        void submit()
      }}
    >
      <TextField
        labelKey="seniority.value"
        name="seniority"
        inputMode="numeric"
        dir="ltr"
        isRequired
        value={values.seniority}
        onChange={(seniority) => {
          change({ seniority })
        }}
        error={fieldError([], 'seniority', answered)}
      />
      <div className="grid grid-cols-2 gap-md">
        <DateField
          labelKey="seniority.from"
          name="valid_from"
          value={values.valid_from}
          onChange={(validFrom) => {
            change({ valid_from: validFrom })
          }}
          error={fieldError([], 'valid_from', answered)}
        />
        <DateField
          labelKey="seniority.to"
          name="valid_to"
          value={values.valid_to}
          onChange={(validTo) => {
            change({ valid_to: validTo })
          }}
          error={fieldError([], 'valid_to', answered)}
        />
      </div>
      <p className="text-micro text-text-muted">{t('seniority.toHint')}</p>
      <TextField
        labelKey="seniority.reason"
        name="reason"
        value={values.reason}
        onChange={(reason) => {
          change({ reason })
        }}
        error={fieldError([], 'reason', answered)}
      />
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}

function OverrideRow({
  override,
  isCurrent,
  canRevoke,
  onRevoke,
}: {
  readonly override: SeniorityOverride
  readonly isCurrent: boolean
  readonly canRevoke: boolean
  readonly onRevoke: () => void
}) {
  const revoked = override.revoked_at !== null
  const dates = [
    formatDate(override.valid_from),
    override.valid_to === null ? t('seniority.permanent') : formatDate(override.valid_to),
  ].join(` ${t('seniority.until')} `)
  return (
    <li className="flex items-center gap-sm border-b border-line py-sm">
      <span className={`flex min-w-none flex-1 flex-col gap-2xs ${revoked ? 'text-text-muted' : ''}`}>
        <span className="flex items-center gap-sm">
          <span className="text-name font-semibold">
            {t('seniority.value')} <span className="tabular-nums">{override.seniority}</span>
          </span>
          {isCurrent ? (
            <span className="shrink-0 rounded-pill bg-inner px-sm text-micro font-semibold">{t('seniority.current')}</span>
          ) : null}
          {revoked ? <span className="shrink-0 text-micro">{t('seniority.revoked')}</span> : null}
        </span>
        <span className="text-micro text-text-muted tabular-nums">
          {[dates, ...(override.reason === null ? [] : [override.reason])].join(PART_SEPARATOR)}
        </span>
      </span>
      {canRevoke && !revoked ? (
        <Button onPress={onRevoke}>
          <Undo2 aria-hidden size={14} />
          {t('seniority.revoke')}
        </Button>
      ) : null}
    </li>
  )
}

function SeniorityList({ soldier, today, canCreate, canRevoke }: {
  readonly soldier: Soldier
  readonly today: CalendarDate
  readonly canCreate: boolean
  readonly canRevoke: boolean
}) {
  const overrides = useSeniorityOverrides()
  const { revoke } = useSeniorityOverrideCommands(soldier.id)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<SeniorityOverride | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  if (overrides.status === 'failed') return <FailureNotice error={overrides.error} />
  if (overrides.status === 'loading') return <LoadingNotice />
  const rows = overridesOf(overrides.value, soldier.id)
  const current = currentOverride(overrides.value, soldier.id, today)

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <h3 className="text-body font-bold">{t('seniority.title')}</h3>
        {canCreate ? (
          <Button
            onPress={() => {
              setFailure(null)
              setCreating(true)
            }}
          >
            <Plus aria-hidden size={14} />
            {t('seniority.new')}
          </Button>
        ) : null}
      </div>
      <p className="text-micro text-text-muted">{t('seniority.hint')}</p>
      {failure === null ? null : <FailureNotice error={failure} />}
      {rows.length === 0 ? (
        <p className="text-name text-text-muted">{t('seniority.none')}</p>
      ) : (
        <ul aria-label={t('seniority.listLabel')} className="flex flex-col">
          {rows.map((override) => (
            <OverrideRow
              key={override.id}
              override={override}
              isCurrent={current?.id === override.id}
              canRevoke={canRevoke}
              onRevoke={() => {
                setFailure(null)
                setRevoking(override)
              }}
            />
          ))}
        </ul>
      )}
      {creating ? (
        <CreateDialog
          soldier={soldier}
          today={today}
          onClose={() => {
            setCreating(false)
          }}
        />
      ) : null}
      {revoking === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="seniority.revokeTitle"
          hintKey="seniority.revokeBody"
          confirmKey="seniority.revoke"
          isPending={revoke.isPending}
          onCancel={() => {
            setRevoking(null)
          }}
          onConfirm={() => {
            void revoke.run(revoking).then((result) => {
              setRevoking(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </section>
  )
}

export function SenioritySection({ soldier, today }: { readonly soldier: Soldier; readonly today: CalendarDate | null }) {
  const permissions = useSeniorityPermissions(soldier.id)
  if (!permissions.view || today === null) return null
  return <SeniorityList soldier={soldier} today={today} canCreate={permissions.create} canRevoke={permissions.revoke} />
}
