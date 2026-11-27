import type { CalendarDate, UnitId } from '@contracts'
import { t } from '@i18n'
import { useDateWindow, useDayViolations, usePanel, useRuleConflicts, useRulesDay, useShellPlace, useViewFilter, type WindowConflict } from '@logic'
import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Heading } from 'react-aria-components'
import { CardDoor } from '../../kit/Card'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { IconButton } from '../../primitives/Button'
import { RuleViolations } from '../../patterns/rules/RuleViolations'
import { boundText, useRuleNames } from '../../patterns/rules/ruleText'

// The rules drawer of the board (D-140, D-141): the broken rules of a day pressed on the heat row, and the configuration
// conflicts on the board's days. The rules are the page "כללי נוכחות" (D-482), a door away.

const PART_SEPARATOR = ' · '
const NAME_SEPARATOR = ', '
const DATE_SEPARATOR = ', '

function Section({ title, hint, actions, children }: { readonly title: string; readonly hint?: string; readonly actions?: ReactNode; readonly children: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm">
        <Heading id={headingId} level={3} className="text-label font-semibold text-text-muted">
          {title}
        </Heading>
        {actions}
      </div>
      {hint === undefined ? null : <p className="text-micro text-text-muted">{hint}</p>}
      {children}
    </section>
  )
}

/** The day pressed on the heat row, for the board's unit (D-141). */
function DaySection({ day, unitId, onClose }: { readonly day: CalendarDate; readonly unitId: UnitId | null; readonly onClose: () => void }) {
  const violations = useDayViolations(day, unitId)
  return (
    <Section
      title={[t('rules.dayTitle'), formatDate(day, 'dayMonth')].join(PART_SEPARATOR)}
      actions={
        <IconButton labelKey="rules.closeDay" onPress={onClose}>
          <X aria-hidden size={14} />
        </IconButton>
      }
    >
      {violations.status === 'failed' ? <FailureNotice error={violations.error} /> : null}
      {violations.status === 'loading' ? <LoadingNotice /> : null}
      {violations.status === 'ready' && violations.value.length === 0 ? <p className="text-name text-text-muted">{t('rules.dayNone')}</p> : null}
      {violations.status === 'ready' && violations.value.length > 0 ? <RuleViolations violations={violations.value} /> : null}
    </Section>
  )
}

function ConflictsSection({ conflicts }: { readonly conflicts: readonly WindowConflict[] }) {
  const names = useRuleNames()
  return (
    <Section title={t('rules.conflictsTitle')} hint={t('rules.conflictsHint')}>
      {conflicts.length === 0 ? (
        <p className="text-name text-text-muted">{t('rules.noConflicts')}</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {conflicts.map((conflict) => (
            <li
              key={JSON.stringify([conflict.scope_unit_id, conflict.group, conflict.rule_ids, conflict.days])}
              className="flex flex-col gap-xs rounded-control border border-status-rejected p-sm text-micro"
            >
              <span className="text-name font-semibold">{conflict.rule_ids.map(names.rule).join(NAME_SEPARATOR)}</span>
              <span className="text-text-muted">
                {[names.unit(conflict.scope_unit_id), ...(conflict.group === null ? [] : [names.group(conflict.group)])].join(PART_SEPARATOR)}
              </span>
              <span className="tabular-nums">
                {[
                  boundText('rules.requiresAtLeast', conflict.required_min, false),
                  boundText('rules.allowsAtMost', conflict.allowed_max, false),
                ].join(' ')}
              </span>
              <span className="tabular-nums text-text-muted">{conflict.days.map((day) => formatDate(day, 'dayMonth')).join(DATE_SEPARATOR)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function RulesModule() {
  const place = useShellPlace()
  const panel = usePanel()
  const { window } = useDateWindow()
  const { unit } = useViewFilter()
  const rulesDay = useRulesDay()
  const conflicts = useRuleConflicts(window)
  return (
    <div className="flex flex-col gap-xl">
      {rulesDay.day === null ? null : (
        <DaySection day={rulesDay.day} unitId={unit.kind === 'unit' ? unit.unitId : null} onClose={rulesDay.open} />
      )}
      {conflicts.status === 'ready' ? <ConflictsSection conflicts={conflicts.value} /> : null}
      {/* The rules themselves, their switches and their archive are the page "כללי נוכחות" (D-482). */}
      <CardDoor
        labelKey="manage.rules.all"
        onPress={() => {
          // The page is named first, on the drawer's own entry, and the drawer then closes as it always does (D-477).
          place.openPage('rules')
          panel.close()
        }}
      />
    </div>
  )
}
