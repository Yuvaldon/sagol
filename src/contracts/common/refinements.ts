import type { z } from 'zod'
import { UNIT_SCOPE_ANCHORS, type ScopeAnchorType } from '../enums'
import { SchemaIssue } from './issues'

// Row-level checks that mirror cross-column CHECK constraints of schema.sql. They hold
// no business rule: domain owns those.

type Ctx = z.core.$RefinementCtx

/** `to IS NULL OR from IS NULL OR to >= from` for calendar dates (lexical order). */
export function checkDateRange(
  ctx: Ctx,
  from: string | null,
  to: string | null,
  path: string,
): void {
  if (from === null || to === null) return
  if (to >= from) return
  ctx.addIssue({ code: 'custom', message: SchemaIssue.enum.range_inverted, path: [path] })
}

export type ScopeColumns = {
  anchor_type: ScopeAnchorType
  anchor_unit_id: string | null
  anchor_soldier_id: string | null
  anchor_level_id: string | null
  anchor_steps: number | null
  include_descendants: boolean
}

/** `*_anchor_args_check` of rank_role_bindings and access_grants (D-028). */
export function checkScope(ctx: Ctx, row: ScopeColumns): void {
  const argumentsMatch =
    (row.anchor_unit_id !== null) === (row.anchor_type === 'unit') &&
    (row.anchor_soldier_id !== null) === (row.anchor_type === 'soldier') &&
    (row.anchor_level_id !== null) === (row.anchor_type === 'home_ancestor_at_level') &&
    (row.anchor_steps !== null) === (row.anchor_type === 'home_ancestor_steps')
  if (!argumentsMatch) {
    ctx.addIssue({
      code: 'custom',
      message: SchemaIssue.enum.scope_anchor_arguments,
      path: ['anchor_type'],
    })
  }
  const unitAnchors: readonly ScopeAnchorType[] = UNIT_SCOPE_ANCHORS
  if (row.include_descendants && !unitAnchors.includes(row.anchor_type)) {
    ctx.addIssue({
      code: 'custom',
      message: SchemaIssue.enum.include_descendants_not_allowed,
      path: ['include_descendants'],
    })
  }
}
