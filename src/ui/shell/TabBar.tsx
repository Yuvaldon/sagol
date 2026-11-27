import { NEW_ENTITY, PANEL_IDS, SHELL, TOOLTIP, type TabId } from '@config'
import { t, type I18nKey } from '@i18n'
import { useDateWindow, useLinkReviewAccess, usePanel, useShellPlace } from '@logic'
import { ChartNoAxesGantt, ClipboardCheck, House, Plus, User, type LucideIcon } from 'lucide-react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { GlassCapsule } from '../kit/Glass'
import { NameTooltip } from '../primitives/Button'
import { useShellChrome } from './chrome'

// The tab bar (D-455): the destinations as icons on one floating glass capsule, each with its name read aloud and
// shown as a tooltip. The one in sight sits in a lighter capsule with a night-blue icon. The bar slides away while a
// page scrolls down and returns when it scrolls up, or as soon as the keyboard reaches it. On "היום" the action circle
// stands at the bar's end.

const TABS: Readonly<Record<TabId, { readonly Icon: LucideIcon; readonly labelKey: I18nKey }>> = {
  today: { Icon: House, labelKey: 'shell.tabToday' },
  board: { Icon: ChartNoAxesGantt, labelKey: 'workspace.board' },
  manage: { Icon: ClipboardCheck, labelKey: 'navigation.tab' },
  me: { Icon: User, labelKey: 'shell.tabMe' },
}

const WORD = ' '
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'

export interface TabBarProps {
  /** The destinations this actor has, in the bar's order (D-455). */
  readonly tabs: readonly TabId[]
  /** The destination in sight. */
  readonly current: TabId
  /** Whether the actor may request a leave for themself now: the action circle. */
  readonly action: boolean
}

export function TabBar({ tabs, current, action }: TabBarProps) {
  const place = useShellPlace()
  const panel = usePanel()
  const chrome = useShellChrome()
  const { goToToday } = useDateWindow()
  // What waits behind "ניהול": the join requests the actor reviews (D-150), so none hides behind the tab (D-254).
  const links = useLinkReviewAccess()
  const waiting = links.allowed ? links.pending : 0
  if (chrome.covered) return null
  const press = (tab: TabId) => {
    if (tab !== current) {
      place.openTab(tab)
      return
    }
    // The tab in sight leads back to where the destination starts: its first screen at its top, the board on today.
    place.closePage()
    chrome.toTop()
    if (tab === 'board') goToToday()
  }
  const newLeave = t('leaves.new')
  return (
    <nav
      aria-label={t('workspace.navigation')}
      onFocus={chrome.showBar}
      className={`pointer-events-none absolute inset-x-lg bottom-lg flex items-center justify-center gap-sm transition duration-drawer ease-standard motion-reduce:transition-none ${
        chrome.barHidden ? 'translate-y-page-end opacity-0' : ''
      }`}
    >
      <GlassCapsule>
        {tabs.map((tab) => {
          const { Icon, labelKey } = TABS[tab]
          const active = tab === current
          const label = t(labelKey)
          const counted = tab === 'manage' && waiting > 0
          return (
            <TooltipTrigger key={tab} delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
              <AriaButton
                aria-label={counted ? [label, String(waiting), t('navigation.waiting')].join(WORD) : label}
                aria-current={active ? 'page' : false}
                onPress={() => {
                  press(tab)
                }}
                className={`relative inline-flex size-tab cursor-pointer items-center justify-center rounded-full ${FOCUS} ${
                  active ? 'bg-tab-active text-action-solid shadow-rim' : 'text-text-muted data-hovered:bg-inner'
                }`}
              >
                <Icon aria-hidden size={SHELL.tabIconPx} strokeWidth={active ? SHELL.tabStroke.active : SHELL.tabStroke.idle} />
                {counted ? <span aria-hidden className="absolute end-sm top-sm size-dot rounded-full border border-surface bg-status-pending-line" /> : null}
              </AriaButton>
              <NameTooltip>{label}</NameTooltip>
            </TooltipTrigger>
          )
        })}
      </GlassCapsule>
      {action && current === 'today' ? (
        <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
          <AriaButton
            aria-label={newLeave}
            onPress={() => {
              panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY })
            }}
            className={`pointer-events-auto inline-flex size-action shrink-0 cursor-pointer items-center justify-center rounded-full bg-action-solid text-on-action shadow-primary ${FOCUS}`}
          >
            <Plus aria-hidden size={SHELL.tabIconPx} strokeWidth={SHELL.tabStroke.action} />
          </AriaButton>
          <NameTooltip>{newLeave}</NameTooltip>
        </TooltipTrigger>
      ) : null}
    </nav>
  )
}
