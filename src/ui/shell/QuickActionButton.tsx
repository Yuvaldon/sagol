import { NEW_ENTITY, PANEL_IDS, TOOLTIP } from '@config'
import { t, type I18nKey } from '@i18n'
import { usePanel, useQuickAction, type QuickAction } from '@logic'
import { CalendarPlus, Plus, type LucideIcon } from 'lucide-react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'

// The role's quick action (D-266, D-296): a filled round button at the bottom strip's inline end. Logic decides which
// one by the role and the mode; a role and mode with none show nothing (D-076).

const ACTIONS = {
  new_leave: { Icon: Plus, labelKey: 'leaves.new', panel: PANEL_IDS.leaves },
  open_rotation: { Icon: CalendarPlus, labelKey: 'workspace.openRotation', panel: PANEL_IDS.deployments },
} as const satisfies Record<QuickAction, { readonly Icon: LucideIcon; readonly labelKey: I18nKey; readonly panel: string }>

export function QuickActionButton() {
  const panel = usePanel()
  const action = useQuickAction()
  if (action === null) return null
  const { Icon, labelKey, panel: target } = ACTIONS[action]
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        aria-label={t(labelKey)}
        onPress={() => {
          panel.open(target, { entity: NEW_ENTITY })
        }}
        className="flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-pill bg-action-solid text-on-action outline-focus outline-offset-2 data-focus-visible:outline-2"
      >
        <Icon aria-hidden size={18} strokeWidth={2.4} />
      </AriaButton>
      <NameTooltip>{t(labelKey)}</NameTooltip>
    </TooltipTrigger>
  )
}
