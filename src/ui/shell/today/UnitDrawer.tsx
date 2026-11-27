import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, usePresence, type PresenceEntry } from '@logic'
import { useId } from 'react'
import { Badge } from '../../kit/Badge'
import { PersonRow } from '../../kit/PersonRow'
import { StopDrawer } from '../../kit/StopDrawer'
import { typeNameOf } from '../../modules/leaves/leaveText'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'

// The unit's drawer (D-454): who of the unit is away on a day and who is on base, the absent first. It reads what the
// board reads (D-134): a soldier whose leaves the actor may not read is not listed as present or absent by guess.

const SEPARATOR = ' · '
const WORD = ' '

function People({ titleKey, entries, absent }: { readonly titleKey: I18nKey; readonly entries: readonly PresenceEntry[]; readonly absent: boolean }) {
  const id = useId()
  if (entries.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h3 id={id} className="flex items-baseline gap-xs text-small font-semibold text-text-muted">
        {t(titleKey)}
        <span className="tabular-nums">{entries.length}</span>
      </h3>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.soldier.id}>
            <PersonRow
              name={fullName(entry.soldier)}
              detail={[entry.rank?.title, ...(absent ? entry.absences.map(typeNameOf) : [])].filter((part) => part !== undefined).join(SEPARATOR) || undefined}
              trailing={!absent && entry.pending ? <Badge tone="pending">{t('leaves.badgePending')}</Badge> : null}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function UnitDrawer({ name, day, onClose }: { readonly name: string; readonly day: CalendarDate; readonly onClose: () => void }) {
  const presence = usePresence(day, null)
  const detail =
    presence.status === 'ready'
      ? [
          formatDate(day, 'full'),
          [
            String(presence.value.present.length),
            t('kit.fractionOf'),
            String(presence.value.present.length + presence.value.absent.length),
            t('today.onBase'),
          ].join(WORD),
        ].join(SEPARATOR)
      : formatDate(day, 'full')
  return (
    <StopDrawer title={name} detail={detail} onClose={onClose}>
      {presence.status === 'failed' ? (
        <FailureNotice error={presence.error} />
      ) : presence.status === 'loading' ? (
        <LoadingNotice />
      ) : (
        <div className="flex flex-col gap-lg">
          <People titleKey="presence.absent" entries={presence.value.absent} absent />
          <People titleKey="presence.present" entries={presence.value.present} absent={false} />
        </div>
      )}
    </StopDrawer>
  )
}
