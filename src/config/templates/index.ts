import type {
  AvailabilityEffect,
  PERMISSION_ACTIONS_BY_RESOURCE,
  PermissionResource,
  RuleEnforcement,
  RuleMetric,
  RuleScopeMode,
  ScopeAnchorType,
  TagLifetime,
  TagSelectionMode,
} from '@contracts'
import type { IconKeyName } from '../icons'
import type { PaletteKey } from '../palette'

// Unit templates (D-261, D-223): a starter unit as keys and relations only. Every name is in i18n under
// `templates.<template>.<part>.<key>`; the logic layer turns the adjusted template into the ordinary commands, and
// nothing of a template is stored.

/** A role's pairs, each action one its resource allows (D-040). */
export type TemplatePermissions = {
  readonly [Resource in PermissionResource]?: readonly (typeof PERMISSION_ACTIONS_BY_RESOURCE)[Resource][number][]
}

export interface TemplateLevel {
  readonly key: string
}

export interface TemplateRank {
  readonly key: string
  readonly seniority: number
  readonly color: PaletteKey
}

export interface TemplateRole {
  readonly key: string
  readonly color: PaletteKey
  readonly permissions: TemplatePermissions
}

/** A rank's role, with the scope its holders get (D-029). Only the anchors a template can resolve on its own. */
export interface TemplateBinding {
  readonly rank: string
  readonly role: string
  readonly anchor: Extract<ScopeAnchorType, 'self' | 'organization' | 'home_unit'>
}

export interface TemplateTagCategory {
  readonly key: string
  readonly selection: TagSelectionMode
  readonly lifetime: TagLifetime
  readonly color: PaletteKey
  readonly tags: readonly { readonly key: string; readonly color: PaletteKey }[]
}

export interface TemplateLeaveGroup {
  readonly key: string
  readonly types: readonly {
    readonly key: string
    readonly color: PaletteKey
    readonly icon: IconKeyName
    readonly effect: AvailabilityEffect
    readonly requiresReason: boolean
  }[]
}

/** A presence rule on the root unit: its whole tree, or each unit of one of the template's levels. */
export interface TemplateRule {
  readonly key: string
  readonly scope: Extract<RuleScopeMode, 'unit_tree' | 'each_descendant_at_level'>
  /** The template level of `each_descendant_at_level`. */
  readonly level: string | null
  readonly metric: RuleMetric
  readonly min: number
  readonly enforcement: RuleEnforcement
}

/** How many units of a level the commander may ask for, and how many the template offers. */
export interface TemplateCount {
  readonly min: number
  readonly max: number
  readonly initial: number
}

/** The structure: the root's level, an optional headquarters under it, and sections of sub-sections. */
export interface TemplateStructure {
  readonly rootLevel: string
  /** A unit under the root with no level, so per-level rules skip it. */
  readonly headquarters: boolean
  readonly section: { readonly level: string; readonly count: TemplateCount }
  readonly subsection: { readonly level: string; readonly count: TemplateCount }
}

export interface UnitTemplate {
  readonly levels: readonly TemplateLevel[]
  readonly structure: TemplateStructure | null
  readonly ranks: readonly TemplateRank[]
  readonly roles: readonly TemplateRole[]
  readonly bindings: readonly TemplateBinding[]
  readonly tagCategories: readonly TemplateTagCategory[]
  readonly leaveGroups: readonly TemplateLeaveGroup[]
  readonly rules: readonly TemplateRule[]
}

const READ = ['view'] as const
const MANAGE = ['view', 'create', 'update', 'delete'] as const
const LEAVES_ALL = ['view', 'create', 'update', 'delete', 'duplicate', 'approve', 'export'] as const
const TALK = ['view', 'create'] as const

/** What every holder reads of the unit's setup. */
const SETUP_READ = {
  organization: READ,
  unit_levels: READ,
  units: READ,
  command_ranks: READ,
  tags: READ,
  leave_types: READ,
  deployments: READ,
  availability_rules: READ,
  properties: READ,
} as const satisfies TemplatePermissions

/** The company's commanders: run the unit, its soldiers and its requests; access and transfer stay with the owner. */
const COMPANY_COMMAND = {
  ...SETUP_READ,
  unit_levels: MANAGE,
  units: MANAGE,
  command_ranks: MANAGE,
  soldiers: MANAGE,
  soldier_private: ['view', 'update'],
  memberships: ['view', 'update'],
  seniority_overrides: ['view', 'create', 'delete'],
  tags: MANAGE,
  leave_types: MANAGE,
  deployments: MANAGE,
  availability_rules: MANAGE,
  properties: MANAGE,
  roles: READ,
  leaves: LEAVES_ALL,
  leave_comments: TALK,
  internal_comments: TALK,
  accounts: ['view', 'approve'],
} as const satisfies TemplatePermissions

/** A platoon's commanders: their platoon's soldiers and requests, approval included (D-265). */
const PLATOON_COMMAND = {
  ...SETUP_READ,
  soldiers: ['view', 'update'],
  memberships: READ,
  leaves: LEAVES_ALL,
  leave_comments: TALK,
  internal_comments: TALK,
} as const satisfies TemplatePermissions

/** A squad's commander: sees the squad and asks for its soldiers, without approving (D-265). */
const SQUAD_COMMAND = {
  ...SETUP_READ,
  soldiers: READ,
  memberships: READ,
  leaves: ['view', 'create'],
  leave_comments: TALK,
} as const satisfies TemplatePermissions

/** A soldier: their own days and requests. */
const SOLDIER = {
  ...SETUP_READ,
  leaves: ['view', 'create', 'update', 'delete'],
  leave_comments: TALK,
} as const satisfies TemplatePermissions

/** "פלוגה": a company with its headquarters and platoons of squads (D-261). */
export const COMPANY_TEMPLATE = {
  levels: [{ key: 'company' }, { key: 'platoon' }, { key: 'squad' }],
  structure: {
    rootLevel: 'company',
    headquarters: true,
    section: { level: 'platoon', count: { min: 1, max: 9, initial: 3 } },
    subsection: { level: 'squad', count: { min: 0, max: 9, initial: 3 } },
  },
  ranks: [
    { key: 'company_commander', seniority: 60, color: 'red' },
    { key: 'deputy_commander', seniority: 50, color: 'orange' },
    { key: 'platoon_commander', seniority: 40, color: 'blue' },
    { key: 'platoon_sergeant', seniority: 30, color: 'indigo' },
    { key: 'squad_commander', seniority: 20, color: 'teal' },
    { key: 'fighter', seniority: 10, color: 'gray' },
  ],
  roles: [
    { key: 'company_command', color: 'red', permissions: COMPANY_COMMAND },
    { key: 'platoon_command', color: 'blue', permissions: PLATOON_COMMAND },
    { key: 'squad_command', color: 'teal', permissions: SQUAD_COMMAND },
    { key: 'soldier', color: 'gray', permissions: SOLDIER },
  ],
  bindings: [
    { rank: 'company_commander', role: 'company_command', anchor: 'organization' },
    { rank: 'deputy_commander', role: 'company_command', anchor: 'organization' },
    { rank: 'platoon_commander', role: 'platoon_command', anchor: 'home_unit' },
    { rank: 'platoon_sergeant', role: 'platoon_command', anchor: 'home_unit' },
    { rank: 'squad_commander', role: 'squad_command', anchor: 'home_unit' },
    { rank: 'fighter', role: 'soldier', anchor: 'self' },
  ],
  tagCategories: [
    {
      key: 'qualifications',
      selection: 'multiple',
      lifetime: 'persistent',
      color: 'purple',
      tags: [
        { key: 'medic', color: 'red' },
        { key: 'driver', color: 'amber' },
        { key: 'signaler', color: 'cyan' },
        { key: 'machine_gunner', color: 'green' },
        { key: 'sniper', color: 'indigo' },
      ],
    },
  ],
  leaveGroups: [
    {
      key: 'outings',
      types: [
        { key: 'vacation', color: 'green', icon: 'home', effect: 'unavailable', requiresReason: false },
        { key: 'errands', color: 'teal', icon: 'family', effect: 'unavailable', requiresReason: false },
      ],
    },
    {
      key: 'medical',
      types: [
        { key: 'sick_leave', color: 'red', icon: 'sick', effect: 'unavailable', requiresReason: false },
        { key: 'appointment', color: 'orange', icon: 'medical', effect: 'unavailable', requiresReason: false },
      ],
    },
    {
      key: 'duty',
      types: [
        { key: 'course', color: 'indigo', icon: 'course', effect: 'unavailable', requiresReason: false },
        { key: 'mission', color: 'blue', icon: 'mission', effect: 'unavailable', requiresReason: false },
      ],
    },
    {
      key: 'other',
      types: [{ key: 'other', color: 'gray', icon: 'other', effect: 'unavailable', requiresReason: true }],
    },
  ],
  rules: [
    { key: 'company_presence', scope: 'unit_tree', level: null, metric: 'percent', min: 60, enforcement: 'soft' },
    {
      key: 'platoon_presence',
      scope: 'each_descendant_at_level',
      level: 'platoon',
      metric: 'percent',
      min: 50,
      enforcement: 'soft',
    },
  ],
} as const satisfies UnitTemplate

/** "ריקה": nothing but its first tag categories, so tags have somewhere to go (D-285, OI-236). */
export const EMPTY_TEMPLATE = {
  levels: [],
  structure: null,
  ranks: [],
  roles: [],
  bindings: [],
  tagCategories: [
    { key: 'military', selection: 'multiple', lifetime: 'persistent', color: 'green', tags: [] },
    { key: 'civilian', selection: 'multiple', lifetime: 'persistent', color: 'blue', tags: [] },
  ],
  leaveGroups: [],
  rules: [],
} as const satisfies UnitTemplate

/** The templates the setup offers, in order (D-262). */
export const UNIT_TEMPLATE_IDS = ['company', 'empty'] as const
export type UnitTemplateId = (typeof UNIT_TEMPLATE_IDS)[number]
export const UNIT_TEMPLATES: Readonly<Record<UnitTemplateId, UnitTemplate>> = { company: COMPANY_TEMPLATE, empty: EMPTY_TEMPLATE }
