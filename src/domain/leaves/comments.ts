import {
  IssueCode,
  type CommentVisibility,
  type Issue,
  type LeaveComment,
  type Permission,
  type SoldierId,
} from '@contracts'

// Leave comments (D-012, D-063). Permissions are checked against the leave's soldier.

/** Viewing and writing each visibility; `internal` uses its own resource (D-040). */
export const COMMENT_PERMISSIONS = {
  shared: {
    view: { resource: 'leave_comments', action: 'view' },
    create: { resource: 'leave_comments', action: 'create' },
  },
  internal: {
    view: { resource: 'internal_comments', action: 'view' },
    create: { resource: 'internal_comments', action: 'create' },
  },
} as const satisfies Record<CommentVisibility, { view: Permission; create: Permission }>

type CommentAuthorship = Pick<LeaveComment, 'author_id' | 'archived_at'>

/** Only the author edits or archives a comment; anyone else is `forbidden` (D-063). */
export function isCommentAuthor(comment: CommentAuthorship, actorId: SoldierId): boolean {
  return comment.author_id === actorId
}

/** An archived comment cannot be edited or archived again. */
export function commentChangeIssues(comment: CommentAuthorship): Issue[] {
  return comment.archived_at === null ? [] : [{ path: [], code: IssueCode.enum.archived }]
}
