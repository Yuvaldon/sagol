import { SETUP_SECTIONS, type SetupPanel, type SetupSectionId, type WorkModule } from '@config'
import type { I18nKey } from '@i18n'
import { usePendingRequests, useRotationScope, useRoundPlanning, useSetupAccess, useShellPlace } from '@logic'
import { useInboxAccess } from '../inboxAccess'
import { useNavigationEntries, useSetupEntries, type ModuleEntry } from '../moduleEntries'

// What "ניהול" holds for an actor (D-455, D-456): the designed tools first, then the tools that keep their current
// screens, then "הגדרות", the page of what a unit defines once. A row exists only for who may open its module.

/** The designed tools, in the package's order; leave-round planning stands between the join requests and the rules (D-482). */
export const DESIGNED_TOOLS: readonly WorkModule[] = ['soldiers', 'account_links', 'rules']
/** The place of the planner's row among them: after the join requests. */
export const ROUND_ROW_AFTER: WorkModule = 'account_links'
/** The tools with no new design yet, after the gap. The unit tree comes first among them, from the settings' modules. */
export const KEPT_TOOLS: readonly WorkModule[] = ['deployments', 'dashboard']

const SECTION_KEYS: Readonly<Record<SetupSectionId, I18nKey>> = {
  structure: 'navigation.sections.structure',
  access: 'navigation.sections.access',
  catalogs: 'navigation.sections.catalogs',
  data: 'navigation.sections.data',
  advanced: 'navigation.sections.advanced',
}

const LINE_KEYS: Readonly<Record<SetupPanel | 'access_grants', I18nKey>> = {
  units: 'navigation.lines.units',
  command_ranks: 'navigation.lines.command_ranks',
  roles: 'navigation.lines.roles',
  access_grants: 'navigation.lines.access_grants',
  leave_types: 'navigation.lines.leave_types',
  tags: 'navigation.lines.tags',
  properties: 'navigation.lines.properties',
  data_transfer: 'navigation.lines.data_transfer',
  tag_categories: 'navigation.lines.tag_categories',
}

export interface SettingsItem {
  readonly id: string
  readonly entry: ModuleEntry
  /** One plain line saying what the module is for (D-250). */
  readonly lineKey: I18nKey
}

export interface SettingsSection {
  readonly id: SetupSectionId
  readonly titleKey: I18nKey
  readonly items: readonly SettingsItem[]
}

/**
 * The settings page's modules, by section (D-285). The unit tree is a row of "ניהול" itself (D-456), so it is not
 * repeated here; personal grants sit with the roles they extend.
 */
export function useSettingsSections(): readonly SettingsSection[] {
  const setup = useSetupEntries()
  const work = useNavigationEntries()
  return SETUP_SECTIONS.map((section) => {
    const items: SettingsItem[] = section.panels.flatMap((id: SetupPanel) => {
      const entry = setup.get(id)
      return entry === undefined || id === 'units' ? [] : [{ id, entry, lineKey: LINE_KEYS[id] }]
    })
    const grants = work.get('access_grants')
    if (section.id === 'access' && grants !== undefined) items.push({ id: 'access_grants', entry: grants, lineKey: LINE_KEYS.access_grants })
    return { id: section.id, titleKey: SECTION_KEYS[section.id], items }
  }).filter((section) => section.items.length > 0)
}

/**
 * The page of requests (D-467, D-474): what waits for the actor, and the door to the requests that closed. "היום" shows
 * its card only while something waits (D-459), so this row is the way to the page at any time. A request surface exists
 * only while a rotation a request can be about does (D-218).
 */
export function useInboxEntry(): ModuleEntry | null {
  const place = useShellPlace()
  const approves = useInboxAccess()
  const { requests } = useRotationScope()
  const pending = usePendingRequests()
  if (!approves || !requests) return null
  return {
    id: 'inbox',
    labelKey: 'inbox.open',
    onPress: () => {
      place.openPage('requests')
    },
    count: { value: pending.status === 'ready' ? pending.value.length : 0, labelKey: 'inbox.pendingCount' },
  }
}

/** Whether "ניהול" is a destination for this actor: at least one of its rows is theirs (D-455). */
export function useManageAccess(): boolean {
  const work = useNavigationEntries()
  const setup = useSetupEntries()
  const steps = useSetupAccess()
  const inbox = useInboxEntry()
  const round = useRoundPlanning()
  return work.size > 0 || setup.size > 0 || steps.length > 0 || inbox !== null || round !== null
}
