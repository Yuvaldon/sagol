import { NEW_ENTITY, PANEL_IDS, TOOLTIP } from '@config'
import { t } from '@i18n'
import { useLeaveCreation, usePanel, useRotationScope, useSoldiers } from '@logic'
import { Plus } from 'lucide-react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'

// The role's quick action (D-266): a filled round button at the bottom strip's inline end. Until the mode exists it
// is "בקשה חדשה", for who may create a leave for a soldier they see (D-076, OI-219), while a rotation a request can be
// about exists (D-218).

const NO_SOLDIERS: readonly never[] = []

export function NewLeaveButton() {
  const panel = usePanel()
  const soldiers = useSoldiers()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  const { requests } = useRotationScope()
  if (!creation.any || !requests) return null
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        aria-label={t('leaves.new')}
        onPress={() => {
          panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY })
        }}
        className="flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-pill bg-action-solid text-on-action outline-focus outline-offset-2 data-focus-visible:outline-2"
      >
        <Plus aria-hidden size={18} strokeWidth={2.4} />
      </AriaButton>
      <NameTooltip>{t('leaves.new')}</NameTooltip>
    </TooltipTrigger>
  )
}
