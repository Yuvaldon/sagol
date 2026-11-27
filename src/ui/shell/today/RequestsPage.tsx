import { PANEL_IDS } from '@config'
import { t } from '@i18n'
import { usePanel, usePendingRequests, useShellPlace } from '@logic'
import { ArrowRight } from 'lucide-react'
import { CardDoor } from '../../kit/Card'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { IconButton } from '../../primitives/Button'
import { ApproveNowSwitch } from '../ApproveNowSwitch'
import { PageFrame, PageHeading } from '../PageFrame'
import { RequestRows } from './Requests'

// Every request that waits for the actor (D-459): the page behind the title of "בקשות לאישור". It replaces "awaiting
// me" of D-255. The requests that closed, which the board does not draw, are a door away.

export function RequestsPage() {
  const place = useShellPlace()
  const panel = usePanel()
  const pending = usePendingRequests()
  return (
    <PageFrame>
      <header className="flex items-center gap-xs">
        <IconButton labelKey="shell.back" onPress={place.closePage}>
          <ArrowRight aria-hidden size={20} />
        </IconButton>
        <PageHeading opens className="text-title font-bold tracking-tight">
          {t('today.approvals')}
        </PageHeading>
      </header>
      <ApproveNowSwitch />
      <section aria-label={t('inbox.pendingLabel')} className="flex flex-col rounded-card bg-surface p-lg">
        {pending.status === 'failed' ? (
          <FailureNotice error={pending.error} />
        ) : pending.status === 'loading' ? (
          <LoadingNotice />
        ) : pending.value.length === 0 ? (
          <EmptyNotice titleKey="inbox.emptyPendingTitle" bodyKey="inbox.emptyPendingBody" headingLevel={2} />
        ) : (
          <RequestRows leaves={pending.value} />
        )}
      </section>
      <CardDoor
        labelKey="today.closedDoor"
        onPress={() => {
          panel.open(PANEL_IDS.leaveClosed)
        }}
      />
    </PageFrame>
  )
}
