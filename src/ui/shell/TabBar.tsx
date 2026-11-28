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
// stands at the bar's end. On a wide screen the same destinations stand in the side rail on the inline start, each
// with its name under its icon, the action circle first (D-460, D-491); the rail never slides away.

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

/** What a press on a destination does, and whether "ניהול" counts what waits behind it. */
function useTabs(current: TabId) {
  const place = useShellPlace()
  const panel = usePanel()
  const chrome = useShellChrome()
  const { goToToday } = useDateWindow()
  // What waits behind "ניהול": the join requests the actor reviews (D-150), so none hides behind the tab (D-254).
  const links = useLinkReviewAccess()
  const waiting = links.allowed ? links.pending : 0
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
  const nameOf = (tab: TabId) => {
    const label = t(TABS[tab].labelKey)
    return tab === 'manage' && waiting > 0 ? [label, String(waiting), t('navigation.waiting')].join(WORD) : label
  }
  const newLeave = () => {
    panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY })
  }
  return { chrome, press, nameOf, counted: (tab: TabId) => tab === 'manage' && waiting > 0, newLeave }
}

/** The dot of what waits behind a destination. */
function WaitingDot() {
  return <span aria-hidden className="absolute end-sm top-sm size-dot rounded-full border border-surface bg-status-pending-line" />
}

export function TabBar({ tabs, current, action }: TabBarProps) {
  const { chrome, press, nameOf, counted, newLeave } = useTabs(current)
  if (chrome.covered) return null
  const newLeaveLabel = t('leaves.new')
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
          return (
            <TooltipTrigger key={tab} delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
              <AriaButton
                aria-label={nameOf(tab)}
                aria-current={active ? 'page' : false}
                onPress={() => {
                  press(tab)
                }}
                className={`relative inline-flex size-tab cursor-pointer items-center justify-center rounded-full ${FOCUS} ${
                  active ? 'bg-tab-active text-action-solid shadow-rim' : 'text-text-muted data-hovered:bg-inner'
                }`}
              >
                <Icon aria-hidden size={SHELL.tabIconPx} strokeWidth={active ? SHELL.tabStroke.active : SHELL.tabStroke.idle} />
                {counted(tab) ? <WaitingDot /> : null}
              </AriaButton>
              <NameTooltip>{t(labelKey)}</NameTooltip>
            </TooltipTrigger>
          )
        })}
      </GlassCapsule>
      {action && current === 'today' ? (
        <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
          <AriaButton
            aria-label={newLeaveLabel}
            onPress={newLeave}
            className={`pointer-events-auto inline-flex size-action shrink-0 cursor-pointer items-center justify-center rounded-full bg-action-solid text-on-action shadow-primary ${FOCUS}`}
          >
            <Plus aria-hidden size={SHELL.tabIconPx} strokeWidth={SHELL.tabStroke.action} />
          </AriaButton>
          <NameTooltip>{newLeaveLabel}</NameTooltip>
        </TooltipTrigger>
      ) : null}
    </nav>
  )
}

/**
 * The side rail of a wide screen (D-460, D-491): the destinations stacked on the inline start, each its icon with its
 * name under it, the one in sight on the lighter capsule. On "היום" the action circle comes first, as the bar's own
 * circle does there. The rail stays while a page scrolls and while a tray is up: the tray has its own place.
 */
export function SideRail({ tabs, current, action }: TabBarProps) {
  const { press, nameOf, counted, newLeave } = useTabs(current)
  return (
    <nav aria-label={t('workspace.navigation')} className="rail-safe flex w-rail shrink-0 flex-col items-center gap-md border-e border-divider-strong">
      {action && current === 'today' ? (
        <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
          <AriaButton
            aria-label={t('leaves.new')}
            onPress={newLeave}
            className={`inline-flex size-action shrink-0 cursor-pointer items-center justify-center rounded-full bg-action-solid text-on-action shadow-primary ${FOCUS}`}
          >
            <Plus aria-hidden size={SHELL.tabIconPx} strokeWidth={SHELL.tabStroke.action} />
          </AriaButton>
          <NameTooltip>{t('leaves.new')}</NameTooltip>
        </TooltipTrigger>
      ) : null}
      {tabs.map((tab) => {
        const { Icon, labelKey } = TABS[tab]
        const active = tab === current
        return (
          <AriaButton
            key={tab}
            aria-label={nameOf(tab)}
            aria-current={active ? 'page' : false}
            onPress={() => {
              press(tab)
            }}
            className={`group relative flex w-full cursor-pointer flex-col items-center gap-xs rounded-control py-xs ${FOCUS} ${active ? 'text-action-solid' : 'text-text-muted'}`}
          >
            <span
              aria-hidden
              className={`inline-flex h-control w-tab items-center justify-center rounded-full ${active ? 'bg-tab-active shadow-rim' : 'group-data-hovered:bg-inner'}`}
            >
              <Icon size={SHELL.railIconPx} strokeWidth={active ? SHELL.tabStroke.active : SHELL.tabStroke.idle} />
            </span>
            <span aria-hidden className={`text-caption ${active ? 'font-bold' : 'font-semibold'}`}>
              {t(labelKey)}
            </span>
            {counted(tab) ? <WaitingDot /> : null}
          </AriaButton>
        )
      })}
    </nav>
  )
}
