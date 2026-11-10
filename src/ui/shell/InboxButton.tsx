import { PANEL_IDS } from '@config'
import { t } from '@i18n'
import { usePanel, usePendingRequests } from '@logic'
import { Inbox } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'
import { useInboxAccess } from './inboxAccess'

// The requests inbox in the bar (D-120): for who may approve at least one soldier they see, with the number of
// requests waiting for them. Its name is read with the number, so it is written out rather than set as a label.

export function InboxButton() {
  const panel = usePanel()
  const isDesktop = useIsDesktop()
  const pending = usePendingRequests()
  const count = pending.status === 'ready' ? pending.value.length : 0
  if (!useInboxAccess()) return null
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.leaveInbox)
      }}
      className="relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text outline-focus outline-offset-2 md:min-h-control md:bg-inner md:px-md data-focus-visible:outline-2 data-hovered:bg-line"
    >
      <Inbox aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span className={isDesktop ? '' : 'sr-only'}>{t('inbox.open')}</span>
      {count === 0 ? null : (
        <span className="absolute end-none top-xs inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums md:static">
          {count}
          <span className="sr-only"> {t('inbox.pendingCount')}</span>
        </span>
      )}
    </AriaButton>
  )
}
