import { PANEL_IDS, SETUP_SECTIONS, WORK_SECTIONS, type SetupPanel, type WorkModule } from '@config'
import type { I18nKey } from '@i18n'
import { useLinkReviewAccess, useModuleAccess, usePanel, useShellPlace, useTransferAccess } from '@logic'
import { useGrantsAccess } from './inboxAccess'

// The modules of the workspace (D-116, D-167, D-173): each one only for who may open it. They are the rows of "ניהול"
// and of its settings page (D-456). The designed tools open their pages (D-482); the others their modules.

export interface ModuleEntry {
  readonly id: string
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** What waits for the actor, read with the module's name (D-120, D-150). */
  readonly count: { readonly value: number; readonly labelKey: I18nKey } | null
}

/** The work modules this actor may open; a module they may not open is absent (D-076, D-285). */
export function useNavigationEntries(): ReadonlyMap<WorkModule, ModuleEntry> {
  const access = useModuleAccess()
  const panel = usePanel()
  const place = useShellPlace()
  const links = useLinkReviewAccess()
  const grants = useGrantsAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  // Checked by assignment below: every work module needs an entry (D-178).
  const entries = {
    dashboard: access.dashboard && {
      id: 'dashboard',
      labelKey: 'dashboard.open',
      onPress: opener(PANEL_IDS.dashboard),
      count: null,
    },
    soldiers: access.soldiers && {
      id: 'soldiers',
      labelKey: 'soldiers.open',
      onPress: () => {
        place.openPage('soldiers')
      },
      count: null,
    },
    rules: access.rules && {
      id: 'rules',
      labelKey: 'rules.open',
      onPress: () => {
        place.openPage('rules')
      },
      count: null,
    },
    deployments: access.deployments && {
      id: 'deployments',
      labelKey: 'deployments.open',
      onPress: opener(PANEL_IDS.deployments),
      count: null,
    },
    access_grants: grants && { id: 'grants', labelKey: 'grants.open', onPress: opener(PANEL_IDS.accessGrants), count: null },
    account_links: links.allowed && {
      id: 'accountLinks',
      labelKey: 'accountLinks.open',
      onPress: () => {
        place.openPage('joins')
      },
      count: { value: links.pending, labelKey: 'accountLinks.pendingCount' },
    },
  } satisfies Readonly<Record<WorkModule, ModuleEntry | false>>
  const byModule: Readonly<Record<string, ModuleEntry | false>> = entries
  const allowed = new Map<WorkModule, ModuleEntry>()
  for (const section of WORK_SECTIONS) {
    for (const module of section.modules) {
      const entry = byModule[module]
      if (entry !== undefined && entry !== false) allowed.set(module, entry)
    }
  }
  return allowed
}

/**
 * The setup's modules this actor may open (D-285), each by the module's first panel. A module of several tabs opens
 * on the first one they may read: unit types alone still open the structure.
 */
export function useSetupEntries(): ReadonlyMap<SetupPanel, ModuleEntry> {
  const access = useModuleAccess()
  const panel = usePanel()
  const transfer = useTransferAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  const entries: Readonly<Record<SetupPanel, ModuleEntry | false>> = {
    units: (access.units || access.unitLevels) && {
      id: 'units',
      labelKey: 'units.open',
      onPress: opener(access.units ? PANEL_IDS.units : PANEL_IDS.unitLevels),
      count: null,
    },
    command_ranks: access.commandRanks && {
      id: 'commandRanks',
      labelKey: 'commandRanks.open',
      onPress: opener(PANEL_IDS.commandRanks),
      count: null,
    },
    roles: access.roles && { id: 'roles', labelKey: 'roles.open', onPress: opener(PANEL_IDS.roles), count: null },
    leave_types: access.leaveTypes && {
      id: 'leaveTypes',
      labelKey: 'leaveTypes.open',
      onPress: opener(PANEL_IDS.leaveTypes),
      count: null,
    },
    tags: access.tags && { id: 'tags', labelKey: 'tags.open', onPress: opener(PANEL_IDS.tags), count: null },
    properties: access.properties && {
      id: 'properties',
      labelKey: 'properties.open',
      onPress: opener(PANEL_IDS.properties),
      count: null,
    },
    data_transfer: transfer.any && {
      id: 'dataTransfer',
      labelKey: 'transfer.open',
      onPress: opener(PANEL_IDS.dataTransfer),
      count: null,
    },
    tag_categories: access.tags && {
      id: 'tagCategories',
      labelKey: 'tagCategories.open',
      onPress: opener(PANEL_IDS.tagCategories),
      count: null,
    },
  }
  const allowed = new Map<SetupPanel, ModuleEntry>()
  for (const section of SETUP_SECTIONS) {
    for (const id of section.panels) {
      const entry = entries[id]
      if (entry !== false) allowed.set(id, entry)
    }
  }
  return allowed
}
