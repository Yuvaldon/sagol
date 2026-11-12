import { COMPANY_TEMPLATE, EMPTY_TEMPLATE, type UnitTemplateId } from '@config'
import { t, type I18nKey } from '@i18n'
import type { TemplateNames, TemplateStage } from '@logic'

// A template's names (D-261): its keys in config, its words in the dictionary. Each map is keyed by the template's own
// keys, so a key without a name does not compile.

type Company = typeof COMPANY_TEMPLATE
type KeysOf<Rows extends readonly { readonly key: string }[]> = Rows[number]['key']
type Names<Key extends string> = Readonly<Record<Key, I18nKey>>

interface NameKeys {
  readonly levels: Readonly<Record<string, I18nKey>>
  readonly headquarters: I18nKey | null
  readonly subsection: I18nKey | null
  readonly ranks: Readonly<Record<string, { readonly title: I18nKey; readonly short: I18nKey }>>
  readonly roles: Readonly<Record<string, I18nKey>>
  readonly tagCategories: Readonly<Record<string, I18nKey>>
  readonly tags: Readonly<Record<string, I18nKey>>
  readonly leaveGroups: Readonly<Record<string, I18nKey>>
  readonly leaveTypes: Readonly<Record<string, I18nKey>>
  readonly rules: Readonly<Record<string, I18nKey>>
}

const COMPANY_LEVELS: Names<KeysOf<Company['levels']>> = {
  company: 'templates.company.levels.company',
  platoon: 'templates.company.levels.platoon',
  squad: 'templates.company.levels.squad',
}

const COMPANY: NameKeys = {
  levels: COMPANY_LEVELS,
  headquarters: 'templates.company.headquarters',
  subsection: 'templates.company.levels.squad',
  ranks: {
    company_commander: { title: 'templates.company.ranks.company_commander.title', short: 'templates.company.ranks.company_commander.short' },
    deputy_commander: { title: 'templates.company.ranks.deputy_commander.title', short: 'templates.company.ranks.deputy_commander.short' },
    platoon_commander: {
      title: 'templates.company.ranks.platoon_commander.title',
      short: 'templates.company.ranks.platoon_commander.short',
    },
    platoon_sergeant: { title: 'templates.company.ranks.platoon_sergeant.title', short: 'templates.company.ranks.platoon_sergeant.short' },
    squad_commander: { title: 'templates.company.ranks.squad_commander.title', short: 'templates.company.ranks.squad_commander.short' },
    fighter: { title: 'templates.company.ranks.fighter.title', short: 'templates.company.ranks.fighter.short' },
  } satisfies Readonly<Record<KeysOf<Company['ranks']>, { readonly title: I18nKey; readonly short: I18nKey }>>,
  roles: {
    company_command: 'templates.company.roles.company_command',
    platoon_command: 'templates.company.roles.platoon_command',
    squad_command: 'templates.company.roles.squad_command',
    soldier: 'templates.company.roles.soldier',
  } satisfies Names<KeysOf<Company['roles']>>,
  tagCategories: { qualifications: 'templates.company.tagCategories.qualifications' } satisfies Names<KeysOf<Company['tagCategories']>>,
  tags: {
    medic: 'templates.company.tags.medic',
    driver: 'templates.company.tags.driver',
    signaler: 'templates.company.tags.signaler',
    machine_gunner: 'templates.company.tags.machine_gunner',
    sniper: 'templates.company.tags.sniper',
  } satisfies Names<KeysOf<Company['tagCategories'][number]['tags']>>,
  leaveGroups: {
    outings: 'templates.company.leaveGroups.outings',
    medical: 'templates.company.leaveGroups.medical',
    duty: 'templates.company.leaveGroups.duty',
    other: 'templates.company.leaveGroups.other',
  } satisfies Names<KeysOf<Company['leaveGroups']>>,
  leaveTypes: {
    vacation: 'templates.company.leaveTypes.vacation',
    errands: 'templates.company.leaveTypes.errands',
    sick_leave: 'templates.company.leaveTypes.sick_leave',
    appointment: 'templates.company.leaveTypes.appointment',
    course: 'templates.company.leaveTypes.course',
    mission: 'templates.company.leaveTypes.mission',
    other: 'templates.company.leaveTypes.other',
  } satisfies Names<KeysOf<Company['leaveGroups'][number]['types']>>,
  rules: {
    company_presence: 'templates.company.rules.company_presence',
    platoon_presence: 'templates.company.rules.platoon_presence',
  } satisfies Names<KeysOf<Company['rules']>>,
}

const EMPTY: NameKeys = {
  levels: {},
  headquarters: null,
  subsection: null,
  ranks: {},
  roles: {},
  tagCategories: { general: 'templates.empty.tagCategories.general' } satisfies Names<KeysOf<(typeof EMPTY_TEMPLATE)['tagCategories']>>,
  tags: {},
  leaveGroups: {},
  leaveTypes: {},
  rules: {},
}

const NAME_KEYS: Readonly<Record<UnitTemplateId, NameKeys>> = { company: COMPANY, empty: EMPTY }

/** Between a level's name and a unit's position. */
const WORD = ' '

const translated = (keys: Readonly<Record<string, I18nKey>>) =>
  Object.fromEntries(Object.entries(keys).map(([key, value]) => [key, t(value)]))

/** A numbered unit of a level, such as "מחלקה 2". */
function numbered(levelKey: I18nKey | null): (position: number) => string {
  return (position) => (levelKey === null ? String(position) : [t(levelKey), String(position)].join(WORD))
}

/** The default name of a template's section at a position. */
export function sectionNameOf(templateId: UnitTemplateId): (position: number) => string {
  const structure = templateId === 'company' ? COMPANY_TEMPLATE.structure : null
  return numbered(structure === null ? null : COMPANY_LEVELS[structure.section.level])
}

export function templateNames(templateId: UnitTemplateId): TemplateNames {
  const keys = NAME_KEYS[templateId]
  return {
    levels: translated(keys.levels),
    headquarters: keys.headquarters === null ? '' : t(keys.headquarters),
    subsection: numbered(keys.subsection),
    ranks: Object.fromEntries(Object.entries(keys.ranks).map(([key, value]) => [key, { title: t(value.title), short: t(value.short) }])),
    roles: translated(keys.roles),
    tagCategories: translated(keys.tagCategories),
    tags: translated(keys.tags),
    leaveGroups: translated(keys.leaveGroups),
    leaveTypes: translated(keys.leaveTypes),
    rules: translated(keys.rules),
  }
}

/** The word of each part of the setup, for where it stopped. */
export const STAGE_KEYS: Readonly<Record<TemplateStage, I18nKey>> = {
  unit_levels: 'setup.wizard.stages.unit_levels',
  root_level: 'setup.wizard.stages.root_level',
  units: 'setup.wizard.stages.units',
  command_ranks: 'setup.wizard.stages.command_ranks',
  roles: 'setup.wizard.stages.roles',
  rank_bindings: 'setup.wizard.stages.rank_bindings',
  tag_categories: 'setup.wizard.stages.tag_categories',
  tags: 'setup.wizard.stages.tags',
  leave_type_groups: 'setup.wizard.stages.leave_type_groups',
  leave_types: 'setup.wizard.stages.leave_types',
  rules: 'setup.wizard.stages.rules',
}

export const TEMPLATE_KEYS: Readonly<Record<UnitTemplateId, { readonly title: I18nKey; readonly body: I18nKey }>> = {
  company: { title: 'setup.wizard.templates.company.title', body: 'setup.wizard.templates.company.body' },
  empty: { title: 'setup.wizard.templates.empty.title', body: 'setup.wizard.templates.empty.body' },
}

/** The names of a template's leave types and tags, for the choices of what to keep. */
export function keptNames(templateId: UnitTemplateId): { readonly leaveTypes: Names<string>; readonly tags: Names<string> } {
  const keys = NAME_KEYS[templateId]
  return { leaveTypes: keys.leaveTypes, tags: keys.tags }
}
