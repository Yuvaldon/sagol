import type { Store } from './store'
import {
  AddLeaveCommentInput,
  ArchiveLeaveCommentInput,
  EditLeaveCommentInput,
  IssueCode,
  LeaveFeedQuery,
  LeaveThreadQuery,
  type DataCommands,
  type DataRepositories,
  type Leave,
  type LeaveComment,
  type TableName,
} from '@contracts'
import { COMMENT_PERMISSIONS, commentChangeIssues, compareInstants, isCommentAuthor, soldierTarget } from '@domain'
import type { z } from 'zod'
import { holds, loadActorScope, requirePermission, type ActorScope } from './actor'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, failValidation, parseInput, parsedRow } from './failure'
import { canView, feedLeaves, newestFirst, threadRows, visibleLeave } from './leaves'
import { POLICY_TABLES } from './snapshot'

// Leave comments (D-063, D-118). A comment is visible when its leave is and the actor holds the view pair of its
// visibility over the leave's soldier: shared and internal comments are two resources (D-040). Only the author
// edits or archives a comment.

const COMMENT_TABLES: readonly TableName[] = [...POLICY_TABLES, 'leaves', 'leave_comments']

function canViewComment(scope: ActorScope, leave: Pick<Leave, 'soldier_id'>, comment: Pick<LeaveComment, 'visibility'>): boolean {
  return holds(scope, COMMENT_PERMISSIONS[comment.visibility].view, soldierTarget(leave.soldier_id))
}

/** The comment, or `not_found` when it, or its leave, is missing or invisible to the actor (D-046). */
async function visibleComment(database: Store, scope: ActorScope, id: string): Promise<LeaveComment> {
  const stored = await tableOf(database, 'leave_comments').get(id)
  if (stored === undefined || stored.organization_id !== scope.organization_id) return fail({ code: 'not_found' })
  const leave = await tableOf(database, 'leaves').get(stored.leave_id)
  if (leave === undefined || !canView(scope, leave) || !canViewComment(scope, leave, stored)) return fail({ code: 'not_found' })
  return parsedRow('leave_comments', stored)
}

export function createLeaveCommentRepository(dependencies: LocalDependencies): DataRepositories['leave_comments'] {
  const { database } = dependencies
  return {
    get: (id) =>
      asResult(() =>
        database.transaction('r', COMMENT_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return visibleComment(database, scope, id)
        }),
      ),
    /** The comments of a leave that are not archived, oldest first. */
    list: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveThreadQuery, raw)
        return database.transaction('r', COMMENT_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const leave = await visibleLeave(database, scope, query.leave_id)
          const rows = await tableOf(database, 'leave_comments').where('leave_id').equals(leave.id).toArray()
          return rows
            .filter((row) => row.archived_at === null && canViewComment(scope, leave, row))
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
            .map((row) => parsedRow('leave_comments', row))
        })
      }),
    /** The soldier's comments since a time that the actor can see, not archived, newest first (D-352). */
    feed: (raw) =>
      asResult(() => {
        const query = parseInput(LeaveFeedQuery, raw)
        return database.transaction('r', COMMENT_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const leaves = new Map((await feedLeaves(database, scope, query)).map((leave) => [leave.id, leave]))
          const rows = await threadRows(database, 'leave_comments', [...leaves.values()])
          return rows
            .filter((row) => {
              const leave = leaves.get(row.leave_id)
              return compareInstants(row.created_at, query.since) >= 0 && row.archived_at === null && leave !== undefined && canViewComment(scope, leave, row)
            })
            .sort(newestFirst)
            .map((row) => parsedRow('leave_comments', row))
        })
      }),
  }
}

export function createLeaveCommentCommands(dependencies: LocalDependencies): DataCommands['leave_comments'] {
  const { database, changes } = dependencies

  /** `edit` and `archive`: the comment is visible, the actor wrote it, and it is not archived (D-118). */
  function change<Input extends { readonly id: LeaveComment['id'] }>(
    schema: z.ZodType<Input>,
    raw: Input,
    next: (comment: LeaveComment, input: Input, scope: ActorScope) => LeaveComment,
  ) {
    return asResult(async () => {
      const input = parseInput(schema, raw)
      const written = await database.transaction('rw', COMMENT_TABLES, async () => {
        const scope = await loadActorScope(dependencies)
        const before = await visibleComment(database, scope, input.id)
        if (!isCommentAuthor(before, scope.soldier_id)) return fail({ code: 'forbidden' })
        const issues = commentChangeIssues(before)
        if (issues.length > 0) return failValidation(issues)
        const after = parsedRow('leave_comments', next(before, input, scope))
        await tableOf(database, 'leave_comments').put(after)
        return after
      })
      changes.publish([{ table: 'leave_comments', ids: [written.id] }])
      return written
    })
  }

  return {
    add: (raw) =>
      asResult(async () => {
        const input = parseInput(AddLeaveCommentInput, raw)
        const written = await database.transaction('rw', COMMENT_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          const leave = await visibleLeave(database, scope, input.leave_id)
          requirePermission(scope, COMMENT_PERMISSIONS[input.visibility].create, soldierTarget(leave.soldier_id))
          if ((await tableOf(database, 'leave_comments').get(input.id)) !== undefined) {
            return failValidation([{ path: ['id'], code: IssueCode.enum.already_exists }])
          }
          const comment = parsedRow('leave_comments', {
            id: input.id,
            organization_id: scope.organization_id,
            leave_id: leave.id,
            author_id: scope.soldier_id,
            body: input.body,
            visibility: input.visibility,
            created_at: scope.now,
            edited_at: null,
            archived_at: null,
          })
          await tableOf(database, 'leave_comments').add(comment)
          return comment
        })
        changes.publish([{ table: 'leave_comments', ids: [written.id] }])
        return written
      }),

    edit: (raw) =>
      change(EditLeaveCommentInput, raw, (comment, input, scope) => ({ ...comment, body: input.body, edited_at: scope.now })),

    archive: (raw) => change(ArchiveLeaveCommentInput, raw, (comment, _input, scope) => ({ ...comment, archived_at: scope.now })),
  }
}
