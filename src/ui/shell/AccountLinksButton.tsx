import { PANEL_IDS } from '@config'
import { t } from '@i18n'
import { useLinkReviewAccess, usePanel } from '@logic'
import { UserCheck } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'

// The account-links module in the bar (D-150): for who may review requests to link, with the number waiting for them.
// Its name is read with the number, so it is written out rather than set as a label, as the inbox's is.

export function AccountLinksButton() {
  const panel = usePanel()
  const isDesktop = useIsDesktop()
  const { allowed, pending } = useLinkReviewAccess()
  if (!allowed) return null
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.accountLinks)
      }}
      className="relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text outline-focus outline-offset-2 md:min-h-control md:bg-inner md:px-md data-focus-visible:outline-2 data-hovered:bg-line"
    >
      <UserCheck aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span className={isDesktop ? '' : 'sr-only'}>{t('accountLinks.open')}</span>
      {pending === 0 ? null : (
        <span className="absolute end-none top-xs inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums md:static">
          {pending}
          <span className="sr-only"> {t('accountLinks.pendingCount')}</span>
        </span>
      )}
    </AriaButton>
  )
}
