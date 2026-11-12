import {
  CreateSeniorityOverrideInput,
  IssueCode,
  RevokeSeniorityOverrideInput,
  SeniorityOverrideQuery,
  type DataCommands,
  type DataRepositories,
  type SeniorityOverride,
  type TableName,
} from '@contracts'
import { compareCodeUnits, optionalText, seniorityOverrideOverlapIssues, soldierTarget } from '@domain'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { visibleSoldier } from './leaves'
import { POLICY_TABLES } from './snapshot'

// Personal seniority (D-029, D-179). An override is a target of its soldier. It is created and revoked, never edited:
// a revoked override stays as history, and the overlap check counts only the live ones.

const VIEW = { resource: 'seniority_overrides', action: 'view' } as const
const CREATE = { resource: 'seniority_overrides', action: 'create' } as const
const REVOKE = { resource: 'seniority_overrides', action: 'delete' } as const

const TABLES: readonly TableName[] = [...new Set<TableName>([...POLICY_TABLES, 'seniority_overrides'])]

function canView(scope: ActorScope, override: Pick<SeniorityOverride, 'soldier_id'>): boolean {
  return holds(scope, VIEW, soldierTarget(override.soldier_id))
}

async function overridesOf(database: LocalDependencies['database'], scope: ActorScope): Promise<SeniorityOverride[]> {
  const rows = await tableOf(database, 'seniority_overrides').where('organization_id').equals(scope.organization_id).toArray()
  return rows.map((row) => parsedRow('seniority_overrides', row))
}

/** The latest start first. */
function byStart(a: SeniorityOverride, b: SeniorityOverride): number {
  return b.valid_from.localeCompare(a.valid_from) || compareCodeUnits(a.id, b.id)
}

export function createSeniorityOverrideRepository(dependencies: LocalDependencies): DataRepositories['seniority_overrides'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'seniority_overrides').get(id)
          if (stored === undefined || stored.organization_id !== scope.organization_id || !canView(scope, stored)) {
            return fail({ code: 'not_found' })
          }
          return parsedRow('seniority_overrides', stored)
        }),
      ),
    list: (raw) =>
      asResult(() => {
        const query = parseInput(SeniorityOverrideQuery, raw)
        return database.transaction('r', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return (await overridesOf(database, scope))
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => query.include_revoked || row.revoked_at === null)
            .filter((row) => canView(scope, row))
            .sort(byStart)
        })
      }),
  }
}

export function createSeniorityOverrideCommands(dependencies: LocalDependencies): DataCommands['seniority_overrides'] {
  const { database, changes } = dependencies
  const publish = (id: string) => {
    changes.publish([{ table: 'seniority_overrides', ids: [id] }])
  }
  return {
    create: (raw) =>
      asResult(async () => {
        const input = parseInput(CreateSeniorityOverrideInput, raw)
        const row = await database.transaction('rw', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const soldier = await visibleSoldier(database, scope, input.soldier_id)
          requirePermission(scope, CREATE, soldierTarget(soldier.id))
          if (soldier.archived_at !== null) return failValidation([{ path: ['soldier_id'], code: IssueCode.enum.archived }])
          if ((await tableOf(database, 'seniority_overrides').get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const candidate = parsedRow('seniority_overrides', {
            ...input,
            reason: optionalText(input.reason),
            organization_id: scope.organization_id,
            created_at: scope.now,
            created_by: scope.soldier_id,
            revoked_at: null,
            revoked_by: null,
          })
          // The overlap counts overrides the actor may not see: the answer names only the date (D-179).
          const issues = seniorityOverrideOverlapIssues(await overridesOf(database, scope), candidate)
          if (issues.length > 0) return failValidation(issues)
          await tableOf(database, 'seniority_overrides').add(candidate)
          return candidate
        })
        publish(row.id)
        return row
      }),

    revoke: (raw) =>
      asResult(async () => {
        const input = parseInput(RevokeSeniorityOverrideInput, raw)
        const row = await database.transaction('rw', TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const stored = await tableOf(database, 'seniority_overrides').get(input.id)
          if (stored === undefined || stored.organization_id !== scope.organization_id || !canView(scope, stored)) {
            return fail({ code: 'not_found' })
          }
          requirePermission(scope, REVOKE, soldierTarget(stored.soldier_id))
          if (stored.revoked_at !== null) return failValidation([{ path: [], code: IssueCode.enum.archived }])
          const revoked = parsedRow('seniority_overrides', { ...stored, revoked_at: scope.now, revoked_by: scope.soldier_id })
          await tableOf(database, 'seniority_overrides').put(revoked)
          return revoked
        })
        publish(row.id)
        return row
      }),
  }
}
