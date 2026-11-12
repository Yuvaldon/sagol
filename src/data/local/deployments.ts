import type { Store } from './store'
import {
  ArchiveDeploymentInput,
  CreateDeploymentInput,
  Deployment,
  DeploymentMemberQuery,
  IssueCode,
  SetDeploymentMembersInput,
  UpdateDeploymentInput,
  type DataCommands,
  type DataRepositories,
  type DeploymentMember,
  type Issue,
  type PolicyTarget,
  type TableName,
  type UnitId,
} from '@contracts'
import { compareCodeUnits, compareDates, deploymentMemberIssues, soldierTarget, unitTarget } from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { tableOf } from './store'
import { updatedBy, type LocalDependencies } from './dependencies'
import { asResult, failValidation, parseInput, parsedRow } from './failure'
import {
  createReferenceCommands,
  createReferenceRepository,
  permissionOf,
  requireWritable,
  tablesOf,
  visibleRow,
  type ReferenceSpec,
  type RowCheck,
} from './reference'
import { POLICY_TABLES } from './snapshot'

// Deployments (D-019, D-179): a reserve duty period of a unit, and who serves in it. A deployment is a target of its
// unit, as a scoped rule is (D-053), and moving it needs authority on both units. Its member set is replaced whole,
// under the deployment's version; members the actor cannot see are kept as they are.

function deploymentTarget(unitId: UnitId): PolicyTarget {
  return { kind: 'unit', unit_id: unitId }
}

/** The latest first, then by name. */
function byStart(a: Deployment, b: Deployment): number {
  return b.start_date.localeCompare(a.start_date) || a.name.localeCompare(b.name) || compareCodeUnits(a.id, b.id)
}

/** A unit that changed must exist, be visible and be live; an unchanged one is left alone (as D-113). */
async function unitIssues({ database, scope, row, before }: RowCheck<Deployment>): Promise<Issue[]> {
  if (row.unit_id === before?.unit_id) return []
  const unit = await tableOf(database, 'units').get(row.unit_id)
  const visible =
    unit !== undefined &&
    unit.organization_id === scope.organization_id &&
    holds(scope, permissionOf('units', 'view'), unitTarget(unit))
  if (!visible) return [{ path: ['unit_id'], code: IssueCode.enum.reference_not_found }]
  if (unit.archived_at !== null) return [{ path: ['unit_id'], code: IssueCode.enum.reference_archived }]
  return []
}

/** New dates must still hold every member's own dates (D-179). */
async function memberDateIssues({ database, row, before }: RowCheck<Deployment>): Promise<Issue[]> {
  if (before === null || (before.start_date === row.start_date && before.end_date === row.end_date)) return []
  // The answer names the deployment's date that cuts a member's own date off, not the member's.
  const dates = (await membersOf(database, row)).flatMap((member) => [member.start_date, member.end_date]).filter((date) => date !== null)
  const issues: Issue[] = []
  if (dates.some((date) => compareDates(date, row.start_date) < 0)) issues.push({ path: ['start_date'], code: IssueCode.enum.invalid_value })
  const end = row.end_date
  if (end !== null && dates.some((date) => compareDates(date, end) > 0)) issues.push({ path: ['end_date'], code: IssueCode.enum.invalid_value })
  return issues
}

async function membersOf(database: Store, deployment: Deployment): Promise<DeploymentMember[]> {
  const rows = await tableOf(database, 'deployment_members').where('organization_id').equals(deployment.organization_id).toArray()
  return rows.filter((row) => row.deployment_id === deployment.id).map((row) => parsedRow('deployment_members', row))
}

const SPEC: ReferenceSpec<Deployment> = {
  table: 'deployments',
  resource: 'deployments',
  schema: Deployment,
  checkTables: ['deployment_members'],
  optionalText: [],
  targetOf: (deployment) => deploymentTarget(deployment.unit_id),
  rowIssues: async (check) => [...(await unitIssues(check)), ...(await memberDateIssues(check))],
}

export function createDeploymentRepository(dependencies: LocalDependencies): DataRepositories['deployments'] {
  return createReferenceRepository(dependencies, SPEC, byStart)
}

const MEMBER_TABLES: readonly TableName[] = [...POLICY_TABLES, 'deployments', 'deployment_members']

function canViewDeployment(scope: ActorScope, deployment: Deployment): boolean {
  return holds(scope, permissionOf('deployments', 'view'), SPEC.targetOf(deployment))
}

function canViewSoldier(scope: ActorScope, member: Pick<DeploymentMember, 'soldier_id'>): boolean {
  return holds(scope, permissionOf('soldiers', 'view'), soldierTarget(member.soldier_id))
}

/** Members of the deployments the actor can see, of the soldiers the actor can see (D-179). */
export function createDeploymentMemberRepository(dependencies: LocalDependencies): DataRepositories['deployment_members'] {
  const { database } = dependencies
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(DeploymentMemberQuery, raw)
        return database.transaction('r', MEMBER_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const deployments = (await tableOf(database, 'deployments').where('organization_id').equals(scope.organization_id).toArray())
            .map((row) => parsedRow('deployments', row))
            .filter((deployment) => query.deployment_ids === null || query.deployment_ids.includes(deployment.id))
            .filter((deployment) => canViewDeployment(scope, deployment))
          const visible = new Set<string>(deployments.map((deployment) => deployment.id))
          const rows = await tableOf(database, 'deployment_members').where('organization_id').equals(scope.organization_id).toArray()
          return rows
            .filter((row) => visible.has(row.deployment_id) && canViewSoldier(scope, row))
            .sort((a, b) => compareCodeUnits(a.deployment_id, b.deployment_id) || compareCodeUnits(a.soldier_id, b.soldier_id))
            .map((row) => parsedRow('deployment_members', row))
        })
      }),
  }
}

const SET_TABLES: readonly TableName[] = [...new Set<TableName>([...tablesOf(SPEC), 'soldiers'])]

export function createDeploymentCommands(dependencies: LocalDependencies): DataCommands['deployments'] {
  const { database, changes } = dependencies
  return {
    ...createReferenceCommands(dependencies, SPEC, {
      create: CreateDeploymentInput,
      update: UpdateDeploymentInput,
      archive: ArchiveDeploymentInput,
      placementOf: (input) => deploymentTarget(input.unit_id),
      // Moving a deployment needs authority where it lands too, as a rule (D-139, D-179).
      updateTargetsOf: (input, before) =>
        input.changes.unit_id === undefined || input.changes.unit_id === before.unit_id
          ? []
          : [deploymentTarget(input.changes.unit_id)],
    }),

    setMembers: (raw) =>
      asResult(async () => {
        const input = parseInput(SetDeploymentMembersInput, raw)
        const members = await database.transaction('rw', SET_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const deployment = await visibleRow(database, SPEC, scope, input.deployment_id)
          requirePermission(scope, permissionOf('deployments', 'update'), SPEC.targetOf(deployment))
          requireWritable(deployment, input.expected_version)

          const stored = await membersOf(database, deployment)
          const storedBySoldier = new Map(stored.map((member) => [member.soldier_id, member]))
          const issues: Issue[] = []
          for (const [index, member] of input.members.entries()) {
            const path = ['members', index]
            const soldier = await tableOf(database, 'soldiers').get(member.soldier_id)
            const known =
              soldier !== undefined && soldier.organization_id === scope.organization_id && canViewSoldier(scope, member)
            if (!known) {
              issues.push({ path: [...path, 'soldier_id'], code: IssueCode.enum.reference_not_found })
              continue
            }
            if (!storedBySoldier.has(member.soldier_id) && soldier.archived_at !== null) {
              issues.push({ path: [...path, 'soldier_id'], code: IssueCode.enum.reference_archived })
            }
            issues.push(...deploymentMemberIssues(deployment, member).map((issue) => ({ ...issue, path: [...path, ...issue.path] })))
          }
          if (issues.length > 0) return failValidation(issues)

          // Members the actor cannot see stay: the set the actor sends is the set the actor sees.
          const hidden = stored.filter((member) => !canViewSoldier(scope, member))
          const next = [
            ...hidden,
            ...input.members.map((member) =>
              parsedRow('deployment_members', {
                deployment_id: deployment.id,
                soldier_id: member.soldier_id,
                organization_id: scope.organization_id,
                start_date: member.start_date,
                end_date: member.end_date,
                created_at: storedBySoldier.get(member.soldier_id)?.created_at ?? scope.now,
                created_by: storedBySoldier.get(member.soldier_id)?.created_by ?? scope.soldier_id,
              }),
            ),
          ]
          const keep = new Set<string>(next.map((member) => member.soldier_id))
          const removed = stored.filter((member) => !keep.has(member.soldier_id))
          await tableOf(database, 'deployment_members').bulkDelete(
            removed.map((member): [string, string] => [member.deployment_id, member.soldier_id]),
          )
          await tableOf(database, 'deployment_members').bulkPut(next)
          await tableOf(database, 'deployments').put(
            Deployment.parse({ ...deployment, ...updatedBy(scope.soldier_id, scope.now, deployment.version) }),
          )
          return next
            .filter((member) => canViewSoldier(scope, member))
            .sort((a, b) => compareCodeUnits(a.soldier_id, b.soldier_id))
        })
        changes.publish([
          { table: 'deployments', ids: [input.deployment_id] },
          { table: 'deployment_members', ids: [input.deployment_id] },
        ])
        return members
      }),
  }
}
