import type { LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, usePresence, usePresenceDay, useViewFilter, type PresenceEntry } from '@logic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { Heading } from 'react-aria-components'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { Button, IconButton } from '../../primitives/Button'
import { toneOf } from '../../theme/palette'

// Present and absent lists of one day (D-134): who the board's soldier filter selects that day, each once, absent
// first. An absent entry names why; a present one may carry a pending request or a marker.

const SEPARATOR = ' · '

const typeName = (type: LeaveType | null) => type?.name ?? t('leaves.unknownType')

function Entry({ entry }: { readonly entry: PresenceEntry }) {
  const notes = [
    ...entry.absences.map(typeName),
    ...(entry.pending ? [t('presence.pending')] : []),
    ...entry.markers.map(typeName),
  ]
  const [why] = entry.absences
  return (
    <li className="flex min-h-touch items-center gap-sm border-b border-line py-xs md:min-h-control">
      {why === undefined ? null : <span aria-hidden className={`size-dot shrink-0 rounded-pill ${toneOf(why?.color_key ?? null).fill}`} />}
      <span className="flex min-w-none flex-col">
        <span className="truncate text-name font-semibold">
          {fullName(entry.soldier)}
          {entry.rank === null ? null : (
            <span className="ms-xs font-normal text-text-muted">{entry.rank.short_title ?? entry.rank.title}</span>
          )}
        </span>
        {notes.length === 0 ? null : <span className="truncate text-micro text-text-muted">{notes.join(SEPARATOR)}</span>}
      </span>
    </li>
  )
}

function List({ titleKey, emptyKey, entries }: { readonly titleKey: I18nKey; readonly emptyKey: I18nKey; readonly entries: readonly PresenceEntry[] }) {
  const headingId = useId()
  return (
    <section className="flex flex-col gap-xs">
      <Heading id={headingId} level={3} className="flex items-baseline gap-sm text-body font-bold">
        {t(titleKey)}
        <span className="text-name font-normal tabular-nums text-text-muted">{entries.length}</span>
      </Heading>
      {entries.length === 0 ? (
        <p className="text-name text-text-muted">{t(emptyKey)}</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col">
          {entries.map((entry) => (
            <Entry key={entry.soldier.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function PresenceModule() {
  const { day, today, shift, goToToday } = usePresenceDay()
  const { filter } = useViewFilter()
  const presence = usePresence(day, filter)

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-xs">
        <IconButton
          labelKey="presence.previousDay"
          onPress={() => {
            shift(-1)
          }}
        >
          <ChevronRight aria-hidden size={16} />
        </IconButton>
        <h3 aria-live="polite" className="min-w-none flex-1 text-center text-body font-bold tabular-nums">
          {day === null ? null : formatDate(day, 'full')}
        </h3>
        <IconButton
          labelKey="presence.nextDay"
          onPress={() => {
            shift(1)
          }}
        >
          <ChevronLeft aria-hidden size={16} />
        </IconButton>
        {day === null || day === today ? null : <Button onPress={goToToday}>{t('presence.today')}</Button>}
      </div>
      <p className="text-name text-text-muted">{t('presence.hint')}</p>
      {presence.status === 'failed' ? <FailureNotice error={presence.error} /> : null}
      {presence.status === 'loading' ? <LoadingNotice /> : null}
      {presence.status === 'ready' ? (
        <>
          <List titleKey="presence.absent" emptyKey="presence.noneAbsent" entries={presence.value.absent} />
          <List titleKey="presence.present" emptyKey="presence.nonePresent" entries={presence.value.present} />
        </>
      ) : null}
    </div>
  )
}
