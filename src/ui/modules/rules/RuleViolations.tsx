import type { RuleViolation } from '@contracts'
import { t } from '@i18n'
import { fullName } from '@logic'
import { formatDate } from '../../patterns/dates'
import { boundText, useRuleNames } from './ruleText'

// The broken rules of a change or of a day (D-138): each rule with its unit, its group and its bound, and for each
// day the counts and who is unavailable, also soldiers the actor cannot see. Hard and soft differ by a word and a
// form, not by color alone.

const PART_SEPARATOR = ' · '
const WORD_SEPARATOR = ' '
const NAME_SEPARATOR = ', '
const LABEL_SEPARATOR = ': '

function EnforcementChip({ enforcement }: { readonly enforcement: RuleViolation['enforcement'] }) {
  const hard = enforcement === 'hard'
  return (
    <span
      className={`shrink-0 rounded-pill px-sm text-micro font-semibold ${hard ? 'bg-status-rejected text-on-action' : 'border border-dashed border-status-pending text-status-pending-text'}`}
    >
      {t(hard ? 'rules.hard' : 'rules.soft')}
    </span>
  )
}

export function RuleViolations({ violations }: { readonly violations: readonly RuleViolation[] }) {
  const names = useRuleNames()
  return (
    <ul aria-label={t('rules.violationsLabel')} className="flex flex-col gap-sm">
      {violations.map((violation) => {
        const key = [violation.rule_id, violation.scope_unit_id, violation.bound, JSON.stringify(violation.group)].join('|')
        const where = [names.unit(violation.scope_unit_id), ...(violation.group === null ? [] : [names.group(violation.group)])]
        return (
          <li key={key} className="flex flex-col gap-xs rounded-control border border-line bg-surface p-sm">
            <div className="flex items-center justify-between gap-sm">
              <span className="min-w-none truncate text-name font-semibold">{names.rule(violation.rule_id)}</span>
              <EnforcementChip enforcement={violation.enforcement} />
            </div>
            <span className="text-micro text-text-muted">{where.join(PART_SEPARATOR)}</span>
            <ul className="flex flex-col gap-2xs">
              {violation.days.map((day) => (
                <li key={day.date} className="flex flex-col text-micro">
                  <span className="tabular-nums">
                    {[
                      formatDate(day.date, 'dayMonth'),
                      boundText(violation.bound === 'min' ? 'rules.min' : 'rules.max', day.required, false),
                      [t('rules.available'), String(day.actual)].join(WORD_SEPARATOR),
                    ].join(PART_SEPARATOR)}
                  </span>
                  {day.unavailable.length === 0 ? null : (
                    <span className="text-text-muted">
                      {[t('rules.unavailable'), day.unavailable.map(fullName).toSorted((a, b) => a.localeCompare(b)).join(NAME_SEPARATOR)].join(
                        LABEL_SEPARATOR,
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
