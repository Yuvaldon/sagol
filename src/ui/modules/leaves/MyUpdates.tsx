import { PANEL_IDS } from '@config'
import { t } from '@i18n'
import { useMarkUpdatesSeen, useMyUpdates, usePanel, useSoldiersWithArchived, useTimezone, type MyUpdateLine } from '@logic'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from 'react-aria-components'
import { formatInstant } from '../../patterns/dates'
import { leaveDatesText, personNames, updateText } from './leaveText'

// "עדכונים" on שלי (D-350, D-354): what others did on my leaves, newest first. Unread lines are bold. The section is
// open while something is unread and closed to its header when all is read; opening it marks up to the newest line
// seen. A line opens the leave's details.

const WORD_SEPARATOR = ' '
const LINE_SEPARATOR = ' · '

function UpdateRow({ line, text, at }: { readonly line: MyUpdateLine; readonly text: string; readonly at: string }) {
  const panel = usePanel()
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.leaves, { entity: line.leave.id })
      }}
      className="flex min-h-touch w-full min-w-none cursor-pointer flex-col gap-2xs border-b border-line px-xs py-xs text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
    >
      <span className={line.unread ? 'truncate text-name font-bold' : 'truncate text-name'}>{text}</span>
      <span className="truncate text-micro text-text-muted tabular-nums">{[leaveDatesText(line.leave), at].join(LINE_SEPARATOR)}</span>
    </AriaButton>
  )
}

export function MyUpdates() {
  const updates = useMyUpdates()
  const ready = updates?.status === 'ready' ? updates.value : null
  // A soldier without a linked account, or a read that failed, sees no section: the requests below still show.
  if (ready === null) return null
  return <UpdatesSection lines={ready.lines} unread={ready.unread} newest={ready.newest} />
}

function UpdatesSection({ lines, unread, newest }: { readonly lines: readonly MyUpdateLine[]; readonly unread: number; readonly newest: string | null }) {
  const unreadIds = () => new Set(lines.filter((line) => line.unread).map((line) => line.update.id))
  const [expanded, setExpanded] = useState(unread > 0)
  // Lines unread when the section was opened stay bold after they are marked seen, until the next visit.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => (unread > 0 ? unreadIds() : new Set()))
  const mark = useMarkUpdatesSeen()
  const timezone = useTimezone()
  const soldiers = useSoldiersWithArchived()
  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : [])
  // Marking seen never reports a failure (D-350): the next visit tries again. Only the opening marks, so an update
  // that arrives while the section is open stays unread.
  const markShown = () => {
    if (newest !== null && unread > 0) void mark(newest)
  }
  // A section that opened by itself marks once, when it is first shown.
  const markOnShow = useRef(expanded)
  useEffect(() => {
    if (!markOnShow.current) return
    markOnShow.current = false
    if (newest !== null && unread > 0) void mark(newest)
  }, [newest, unread, mark])
  const onExpandedChange = (next: boolean) => {
    if (next) {
      setOpened(unreadIds())
      markShown()
    }
    setExpanded(next)
  }

  return (
    <Disclosure isExpanded={expanded} onExpandedChange={onExpandedChange} className="group flex flex-col gap-xs">
      <Heading level={3}>
        <AriaButton
          slot="trigger"
          className="flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control text-start outline-focus data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          <span className="min-w-none flex-1 truncate text-label font-semibold text-text-muted">{t('myLeaves.updatesTitle')}</span>
          {unread > 0 ? (
            <span className="inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums">
              {unread}
              <span className="sr-only">{WORD_SEPARATOR + t('myLeaves.updatesUnread')}</span>
            </span>
          ) : null}
          <ChevronDown aria-hidden size={14} className="shrink-0 text-text-muted group-data-expanded:rotate-180" />
        </AriaButton>
      </Heading>
      <DisclosurePanel>
        {lines.length === 0 ? (
          <p className="text-name text-text-muted">{t('myLeaves.updatesEmpty')}</p>
        ) : (
          <ul aria-label={t('myLeaves.updatesTitle')} className="flex flex-col">
            {lines.map((line) => (
              <li key={line.update.id}>
                <UpdateRow
                  line={{ ...line, unread: line.unread || opened.has(line.update.id) }}
                  text={updateText(line, nameOf)}
                  at={timezone === null ? '' : formatInstant(line.update.created_at, timezone)}
                />
              </li>
            ))}
          </ul>
        )}
      </DisclosurePanel>
    </Disclosure>
  )
}
