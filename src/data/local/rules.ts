import type { Store } from './store'
import {
  ArchiveAvailabilityRuleInput,
  AvailabilityRule,
  CreateAvailabilityRuleInput,
  IssueCode,
  UpdateAvailabilityRuleInput,
  type DataCommands,
  type DataRepositories,
  type DeploymentId,
  type Issue,
  type PolicyTarget,
  type TableName,
  type UnitId,
} from '@contracts'
import { compareCodeUnits, filterIssues, filterReferences, unitTarget, withPathPrefix } from '@domain'
import { holds, type ActorScope } from './actor'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import { parsedRow } from './failure'
import {
  createReferenceCommands,
  createReferenceRepository,
  permissionOf,
  type ReferenceSpec,
  type RowCheck,
} from './reference'

// Availability rules (D-014, D-031, D-139). A rule with a scope unit is a unit target, a global rule an organization
// target (D-053). Moving a rule to another unit needs authority on both ends. Rule writes are not gated by the rules
// (D-073).

const ORGANIZATION = { kind: 'organization' } as const

/** What a rule's permissions are checked against: its scope unit, or the organization when global (D-053). */
export function ruleTarget(scopeUnitId: UnitId | null): PolicyTarget {
  return scopeUnitId === null ? ORGANIZATION : { kind: 'unit', unit_id: scopeUnitId }
}

/** Live rules first by priority, the highest on top, then by name. */
function byPriority(a: AvailabilityRule, b: AvailabilityRule): number {
  return b.priority - a.priority || a.name.localeCompare(b.name) || compareCodeUnits(a.id, b.id)
}

type ReferenceFinding = 'missing' | 'archived' | null

/** A reference that changed must exist, be visible and be live; an unchanged one is left alone (as D-113). */
function referenceIssue(path: string, finding: ReferenceFinding): Issue[] {
  if (finding === 'missing') return [{ path: [path], code: IssueCode.enum.reference_not_found }]
  if (finding === 'archived') return [{ path: [path], code: IssueCode.enum.reference_archived }]
  return []
}

async function scopeUnitFinding(database: Store, scope: ActorScope, id: UnitId): Promise<ReferenceFinding> {
  const unit = await tableOf(database, 'units').get(id)
  if (unit === undefined || unit.organization_id !== scope.organization_id) return 'missing'
  if (!holds(scope, permissionOf('units', 'view'), unitTarget(unit))) return 'missing'
  return unit.archived_at === null ? null : 'archived'
}

async function organizationRowFinding(
  database: Store,
  scope: ActorScope,
  table: 'unit_levels' | 'tag_categories',
  id: string,
): Promise<ReferenceFinding> {
  const row = await tableOf(database, table).get(id)
  const resource = table === 'unit_levels' ? 'unit_levels' : 'tags'
  if (row === undefined || row.organization_id !== scope.organization_id) return 'missing'
  if (!holds(scope, permissionOf(resource, 'view'), ORGANIZATION)) return 'missing'
  return row.archived_at === null ? null : 'archived'
}

/** The scope unit, the scope level, the group's category and the deployment (D-139). */
/** A deployment the actor cannot see answers as one that does not exist (D-179). */
async function deploymentFinding(database: Store, scope: ActorScope, id: DeploymentId): Promise<ReferenceFinding> {
  const deployment = await tableOf(database, 'deployments').get(id)
  if (deployment === undefined || deployment.organization_id !== scope.organization_id) return 'missing'
  if (!holds(scope, permissionOf('deployments', 'view'), { kind: 'unit', unit_id: deployment.unit_id })) return 'missing'
  return deployment.archived_at === null ? null : 'archived'
}

async function referenceIssues({ database, scope, row, before }: RowCheck<AvailabilityRule>): Promise<Issue[]> {
  const issues: Issue[] = []
  if (row.scope_unit_id !== null && row.scope_unit_id !== before?.scope_unit_id) {
    issues.push(...referenceIssue('scope_unit_id', await scopeUnitFinding(database, scope, row.scope_unit_id)))
  }
  if (row.scope_level_id !== null && row.scope_level_id !== before?.scope_level_id) {
    issues.push(
      ...referenceIssue('scope_level_id', await organizationRowFinding(database, scope, 'unit_levels', row.scope_level_id)),
    )
  }
  if (row.group_tag_category_id !== null && row.group_tag_category_id !== before?.group_tag_category_id) {
    const finding = await organizationRowFinding(database, scope, 'tag_categories', row.group_tag_category_id)
    issues.push(...referenceIssue('group_tag_category_id', finding))
  }
  if (row.deployment_id !== null && row.deployment_id !== before?.deployment_id) {
    issues.push(...referenceIssue('deployment_id', await deploymentFinding(database, scope, row.deployment_id)))
  }
  return issues
}

/**
 * The population filter (D-067, OI-071): its property conditions pass `filterIssues`, and every row it references
 * exists in the organization. An archived row stays allowed, so a filter never breaks (D-017).
 */
async function populationIssues({ database, scope, row, before }: RowCheck<AvailabilityRule>): Promise<Issue[]> {
  if (before !== null && JSON.stringify(before.population_filter) === JSON.stringify(row.population_filter)) return []
  const inOrganization = <T extends 'tags' | 'command_ranks' | 'units' | 'soldiers' | 'property_definitions'>(table: T) =>
    tableOf(database, table).where('organization_id').equals(scope.organization_id).toArray()
  const [tags, ranks, units, soldiers, definitions] = await Promise.all([
    inOrganization('tags'),
    inOrganization('command_ranks'),
    inOrganization('units'),
    inOrganization('soldiers'),
    inOrganization('property_definitions'),
  ])
  const issues = filterIssues(
    row.population_filter,
    definitions.map((definition) => parsedRow('property_definitions', definition)),
  )
  const references = filterReferences(row.population_filter)
  const known = (ids: readonly string[], rows: readonly { id: string }[]) => {
    const present = new Set(rows.map((stored) => stored.id))
    return ids.every((id) => present.has(id))
  }
  const allKnown =
    known(references.tag_ids, tags) &&
    known(references.command_rank_ids, ranks) &&
    known(references.unit_ids, units) &&
    known(references.soldier_ids, soldiers) &&
    known(references.property_definition_ids, definitions)
  if (!allKnown) issues.push({ path: [], code: IssueCode.enum.reference_not_found })
  return withPathPrefix(['population_filter'], issues)
}

const RULE_CHECK_TABLES: readonly TableName[] = [
  'unit_levels',
  'tag_categories',
  'tags',
  'command_ranks',
  'deployments',
  'property_definitions',
]

const SPEC: ReferenceSpec<AvailabilityRule> = {
  table: 'availability_rules',
  resource: 'availability_rules',
  schema: AvailabilityRule,
  checkTables: RULE_CHECK_TABLES,
  optionalText: ['description'],
  targetOf: (rule) => ruleTarget(rule.scope_unit_id),
  rowIssues: async (check) => [...(await referenceIssues(check)), ...(await populationIssues(check))],
}

export function createAvailabilityRuleRepository(dependencies: LocalDependencies): DataRepositories['availability_rules'] {
  return createReferenceRepository(dependencies, SPEC, byPriority)
}

export function createAvailabilityRuleCommands(dependencies: LocalDependencies): DataCommands['availability_rules'] {
  return createReferenceCommands(dependencies, SPEC, {
    create: CreateAvailabilityRuleInput,
    update: UpdateAvailabilityRuleInput,
    archive: ArchiveAvailabilityRuleInput,
    placementOf: (input) => ruleTarget(input.scope_unit_id),
    // Moving a rule needs authority where it lands too (D-139), checked with the stored target's.
    updateTargetsOf: (input, before) =>
      input.changes.scope_unit_id === undefined || input.changes.scope_unit_id === before.scope_unit_id
        ? []
        : [ruleTarget(input.changes.scope_unit_id)],
  })
}
