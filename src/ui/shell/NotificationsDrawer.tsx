import { PANEL_IDS } from '@config'
import { t } from '@i18n'
import { useMarkUpdatesSeen, useMyLeavesAccess, useMyUpdates, usePanel, useSoldiersWithArchived, useTimezone, type MyUpdateLine } from '@logic'
import { useEffect, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { StopDrawer } from '../kit/StopDrawer'
import { leaveDatesText, personNames, updateText } from '../modules/leaves/leaveText'
import { formatInstant } from '../patterns/dates'
import { FailureNotice, LoadingNotice } from '../patterns/Notices'

// The notifications drawer of the corner bell (the handoff's shared drawer "notifications", OI-391, D-488): what others
// did on the actor's own requests in the last days (D-352), newest first. What was unread when it opened is bold, and
// opening marks up to the newest line seen; a line opens its leave's card in the drawer's place (D-487).

const SEPARATOR = ' · '

function Line({ line, text, at, unread }: { readonly line: MyUpdateLine; readonly text: string; readonly at: string; readonly unread: boolean }) {
  const panel = usePanel()
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.leaves, { entity: line.leave.id })
      }}
      className="flex min-h-touch w-full min-w-none cursor-pointer flex-col gap-2xs border-b border-divider px-xs py-sm text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
    >
      <span className={unread ? 'text-body font-bold' : 'text-body'}>{text}</span>
      <span className="truncate text-small text-text-muted tabular-nums">{[leaveDatesText(line.leave), at].join(SEPARATOR)}</span>
    </AriaButton>
  )
}

function Lines({ lines, newest }: { readonly lines: readonly MyUpdateLine[]; readonly newest: string | null }) {
  const mark = useMarkUpdatesSeen()
  const timezone = useTimezone()
  const soldiers = useSoldiersWithArchived()
  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : [])
  // What was unread when the drawer opened stays bold until it closes; the marking never reports a failure (D-352).
  const [unread] = useState<ReadonlySet<string>>(() => new Set(lines.filter((line) => line.unread).map((line) => line.update.id)))
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current || newest === null || unread.size === 0) return
    marked.current = true
    void mark(newest)
  }, [mark, newest, unread])
  if (lines.length === 0) return <p className="text-body text-text-muted">{t('me.notificationsEmpty')}</p>
  return (
    <ul aria-label={t('me.notificationsTitle')} className="flex flex-col">
      {lines.map((line) => (
        <li key={line.update.id}>
          <Line
            line={line}
            text={updateText(line, nameOf)}
            at={timezone === null ? '' : formatInstant(line.update.created_at, timezone)}
            unread={line.unread || unread.has(line.update.id)}
          />
        </li>
      ))}
    </ul>
  )
}

export function NotificationsDrawer() {
  const panel = usePanel()
  const updates = useMyUpdates()
  const mine = useMyLeavesAccess()
  const here = panel.panel === PANEL_IDS.notifications
  // The drawer is the bell's: an address that names it for who has no bell is put right, once the answer is in (D-490).
  const stray = here && mine !== null && mine.known && !mine.view
  const { close } = panel
  useEffect(() => {
    if (stray) close()
  }, [stray, close])
  if (!here || stray || mine === null || !mine.known) return null
  return (
    <StopDrawer inUrl title={t('me.notificationsTitle')} detail={t('me.notificationsAbout')} onClose={panel.close}>
      {updates === null ? (
        <p className="text-body text-text-muted">{t('me.notificationsEmpty')}</p>
      ) : updates.status === 'failed' ? (
        <FailureNotice error={updates.error} />
      ) : updates.status === 'loading' ? (
        <LoadingNotice />
      ) : (
        <Lines lines={updates.value.lines} newest={updates.value.newest} />
      )}
    </StopDrawer>
  )
}
