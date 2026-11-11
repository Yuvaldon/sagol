import { PANEL_IDS, PHONE_BAR_MODULES } from '@config'
import { t, type I18nKey } from '@i18n'
import { useLinkReviewAccess, useModuleAccess, usePanel, usePendingRequests, useRulesDay } from '@logic'
import { Inbox, KeyRound, MoreHorizontal, Network, Scale, Shield, Tag, Tags, UserCheck, Users, type LucideIcon } from 'lucide-react'
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'
import { IconButton } from '../primitives/Button'
import { useGrantsAccess, useInboxAccess } from './inboxAccess'

// The modules in the bar (D-116, D-165): each one only for who may open it. On a phone the first few sit in the bar
// and the rest are listed under "more", so the bar does not outgrow the screen.

interface ModuleEntry {
  readonly id: string
  readonly Icon: LucideIcon
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** What waits for the actor, read with the module's name (D-120, D-150). */
  readonly count: { readonly value: number; readonly labelKey: I18nKey } | null
}

function useModuleEntries(): ModuleEntry[] {
  const access = useModuleAccess()
  const panel = usePanel()
  const rules = useRulesDay()
  const inbox = useInboxAccess()
  const pending = usePendingRequests()
  const links = useLinkReviewAccess()
  const grants = useGrantsAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  const entries: (ModuleEntry | false)[] = [
    inbox && {
      id: 'inbox',
      Icon: Inbox,
      labelKey: 'inbox.open',
      onPress: opener(PANEL_IDS.leaveInbox),
      count: { value: pending.status === 'ready' ? pending.value.length : 0, labelKey: 'inbox.pendingCount' },
    },
    links.allowed && {
      id: 'accountLinks',
      Icon: UserCheck,
      labelKey: 'accountLinks.open',
      onPress: opener(PANEL_IDS.accountLinks),
      count: { value: links.pending, labelKey: 'accountLinks.pendingCount' },
    },
    access.units && { id: 'units', Icon: Network, labelKey: 'units.open', onPress: opener(PANEL_IDS.units), count: null },
    access.soldiers && { id: 'soldiers', Icon: Users, labelKey: 'soldiers.open', onPress: opener(PANEL_IDS.soldiers), count: null },
    access.tags && { id: 'tags', Icon: Tag, labelKey: 'tags.open', onPress: opener(PANEL_IDS.tags), count: null },
    access.rules && { id: 'rules', Icon: Scale, labelKey: 'rules.open', onPress: rules.open, count: null },
    access.leaveTypes && {
      id: 'leaveTypes',
      Icon: Tags,
      labelKey: 'leaveTypes.open',
      onPress: opener(PANEL_IDS.leaveTypes),
      count: null,
    },
    access.roles && { id: 'roles', Icon: Shield, labelKey: 'roles.open', onPress: opener(PANEL_IDS.roles), count: null },
    grants && { id: 'grants', Icon: KeyRound, labelKey: 'grants.open', onPress: opener(PANEL_IDS.accessGrants), count: null },
  ]
  return entries.filter((entry) => entry !== false)
}

/** Icon and name on desktop, the icon alone on a phone, its name still read aloud, with the number waiting. */
function ModuleButton({ entry, isDesktop }: { readonly entry: ModuleEntry; readonly isDesktop: boolean }) {
  const count = entry.count === null || entry.count.value === 0 ? null : entry.count
  return (
    <AriaButton
      onPress={entry.onPress}
      className="relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-xs rounded-pill px-sm text-control font-semibold whitespace-nowrap text-text outline-focus outline-offset-2 md:min-h-control md:bg-inner md:px-md data-focus-visible:outline-2 data-hovered:bg-line"
    >
      <entry.Icon aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
      <span className={isDesktop ? '' : 'sr-only'}>{t(entry.labelKey)}</span>
      {count === null ? null : (
        <span className="absolute end-none top-xs inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums md:static">
          {count.value}
          <span className="sr-only"> {t(count.labelKey)}</span>
        </span>
      )}
    </AriaButton>
  )
}

function MoreMenu({ entries }: { readonly entries: readonly ModuleEntry[] }) {
  return (
    <MenuTrigger>
      <IconButton labelKey="more.open">
        <MoreHorizontal aria-hidden size={18} />
      </IconButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu className="flex max-w-menu flex-col gap-2xs outline-none">
          {entries.map((entry) => (
            <MenuItem
              key={entry.id}
              id={entry.id}
              textValue={t(entry.labelKey)}
              onAction={entry.onPress}
              className="flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none data-focused:bg-inner"
            >
              <entry.Icon aria-hidden size={16} />
              {t(entry.labelKey)}
              {entry.count === null || entry.count.value === 0 ? null : (
                <span className="inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums">
                  {entry.count.value}
                  <span className="sr-only"> {t(entry.count.labelKey)}</span>
                </span>
              )}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

export function ModuleButtons() {
  const isDesktop = useIsDesktop()
  const entries = useModuleEntries()
  // "More" takes a place of its own only when it holds more than one module.
  const inBar = isDesktop || entries.length <= PHONE_BAR_MODULES + 1 ? entries : entries.slice(0, PHONE_BAR_MODULES)
  const rest = entries.slice(inBar.length)
  return (
    <>
      {inBar.map((entry) => (
        <ModuleButton key={entry.id} entry={entry} isDesktop={isDesktop} />
      ))}
      {rest.length === 0 ? null : <MoreMenu entries={rest} />}
    </>
  )
}
