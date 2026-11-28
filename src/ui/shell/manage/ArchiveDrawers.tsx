import type { AppError, AvailabilityRule, Result, Soldier } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  archivedRows,
  fullName,
  useAvailabilityRulesWithArchived,
  useRosterPermissions,
  useRulePermissions,
  useRuleCommands,
  useSoldierCommands,
  useSoldiersWithArchived,
  useUnits,
} from '@logic'
import { ArchiveRestore, ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { StopDrawer } from '../../kit/StopDrawer'
import { restoreFailureKey } from '../../patterns/restoreFailure'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { useRuleNames, ruleSummary } from '../../patterns/rules/ruleText'
import { Button } from '../../primitives/Button'
import { useNotices } from '../notices'

// The archive of a tool, as a drawer of its own (the handoff's availability-rules archive, D-461, D-482): the archived
// rows the actor may bring back, each opening in the same drawer with "החזרה מהארכיון". A restored row returns to its
// place in its list; the toast says so. Only rows the actor may restore are listed (D-076).

const WORD = ' '

interface Archived {
  readonly id: string
}

interface ArchiveDrawerProps<Row extends Archived> {
  readonly rows: readonly Row[] | null
  readonly failure: AppError | null
  readonly nameOf: (row: Row) => string
  readonly detailOf: (row: Row) => string | null
  readonly restore: { readonly run: (row: Row) => Promise<Result<unknown>>; readonly isPending: boolean }
  readonly bodyKey: I18nKey
  readonly onClose: () => void
}

const ROW = 'flex min-h-touch w-full cursor-pointer flex-col justify-center gap-2xs px-lg py-sm text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner'

function ArchiveDrawer<Row extends Archived>({ rows, failure, nameOf, detailOf, restore, bodyKey, onClose }: ArchiveDrawerProps<Row>) {
  const notices = useNotices()
  const [open, setOpen] = useState<Row | null>(null)
  const [refusal, setRefusal] = useState<I18nKey | null>(null)
  const count = rows?.length ?? null
  const shown = open === null ? null : (rows?.find((row) => row.id === open.id) ?? null)
  return (
    <StopDrawer inUrl title={t('manage.archive.title')} detail={count === null ? undefined : String(count)} onClose={onClose}>
      {failure !== null ? (
        <FailureNotice error={failure} />
      ) : rows === null ? (
        <LoadingNotice />
      ) : shown !== null ? (
        <div className="flex flex-col gap-md">
          <AriaButton
            onPress={() => {
              setOpen(null)
              setRefusal(null)
            }}
            className="flex min-h-touch w-fit cursor-pointer items-center gap-xs rounded-control text-small font-semibold text-text-muted outline-focus outline-offset-2 data-focus-visible:outline-2"
          >
            <ArrowRight aria-hidden size={16} />
            {t('manage.archive.back')}
          </AriaButton>
          <section className="flex flex-col gap-2xs rounded-card bg-surface p-lg">
            <h3 className="text-heading font-bold">{nameOf(shown)}</h3>
            {detailOf(shown) === null ? null : <p className="text-small text-text-muted">{detailOf(shown)}</p>}
          </section>
          <p className="text-small text-text-muted">{t(bodyKey)}</p>
          {refusal === null ? null : (
            <p role="alert" className="text-small text-status-error">
              {t(refusal)}
            </p>
          )}
          <Button
            variant="primary"
            isDisabled={restore.isPending}
            onPress={() => {
              setRefusal(null)
              void restore.run(shown).then((result) => {
                if (!result.ok) {
                  setRefusal(restoreFailureKey(result.error))
                  return
                }
                setOpen(null)
                notices.say([nameOf(shown), t('manage.archive.restored')].join(WORD))
              })
            }}
          >
            <ArchiveRestore aria-hidden size={16} />
            {t('manage.archive.restore')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-lg text-center text-body text-text-muted">{t('manage.archive.empty')}</p>
      ) : (
        <ul aria-label={t('archived.listLabel')} className="flex flex-col overflow-hidden rounded-card bg-surface">
          {rows.map((row) => {
            const detail = detailOf(row)
            return (
              <li key={row.id} className="border-b border-divider-strong last:border-b-0">
                <AriaButton
                  onPress={() => {
                    setOpen(row)
                  }}
                  className={ROW}
                >
                  <span className="truncate text-body font-semibold">{nameOf(row)}</span>
                  {detail === null ? null : <span className="truncate text-small text-text-muted">{detail}</span>}
                </AriaButton>
              </li>
            )
          })}
        </ul>
      )}
    </StopDrawer>
  )
}

const NO_UNITS: readonly never[] = []

/** The soldiers' archive (D-371): who the actor may archive comes back from here. */
export function SoldierArchiveDrawer({ onClose }: { readonly onClose: () => void }) {
  const withArchived = useSoldiersWithArchived()
  const units = useUnits()
  const commands = useSoldierCommands()
  const archived = useMemo(() => (withArchived.status === 'ready' ? archivedRows(withArchived.value) : []), [withArchived])
  const permissions = useRosterPermissions(archived, units.status === 'ready' ? units.value : NO_UNITS)
  const rows: readonly Soldier[] | null = withArchived.status === 'ready' ? archived.filter((soldier) => permissions.archive(soldier)) : null
  return (
    <ArchiveDrawer
      rows={rows}
      failure={withArchived.status === 'failed' ? withArchived.error : null}
      nameOf={fullName}
      detailOf={() => null}
      restore={commands.restore}
      bodyKey="archived.restoreSoldierBody"
      onClose={onClose}
    />
  )
}

/** The availability rules' archive (D-461): an archived rule stops overriding until it is restored. */
export function RuleArchiveDrawer({ onClose }: { readonly onClose: () => void }) {
  const rules = useAvailabilityRulesWithArchived()
  const units = useUnits()
  const commands = useRuleCommands()
  const names = useRuleNames()
  const archived = useMemo(() => (rules.status === 'ready' ? archivedRows(rules.value) : []), [rules])
  const permissions = useRulePermissions(units.status === 'ready' ? units.value : NO_UNITS, archived)
  const rows: readonly AvailabilityRule[] | null = rules.status === 'ready' ? archived.filter((rule) => permissions.archive(rule)) : null
  return (
    <ArchiveDrawer
      rows={rows}
      failure={rules.status === 'failed' ? rules.error : null}
      nameOf={(rule) => rule.name}
      detailOf={(rule) => ruleSummary(rule, names)}
      restore={commands.restore}
      bodyKey="manage.archive.restoreRuleBody"
      onClose={onClose}
    />
  )
}
