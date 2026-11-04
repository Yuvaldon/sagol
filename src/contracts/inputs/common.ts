import { z } from 'zod'
import { AvailabilityRuleId } from '../common/ids'
import { Version } from '../common/scalars'
import { IssueCode } from '../errors'

// Shapes shared by command inputs (D-045):
// - inputs are strict objects: an unknown key (`status`, `organization_id`, ...) is rejected;
// - field names are column names of the target table (D-038), plus the closed set of
//   command fields declared here and in the input files;
// - every create carries a caller-generated `id` (D-044);
// - actor, organization, audit columns and versions are never input (D-008, D-045).

type Ctx = z.core.$RefinementCtx

/** Optimistic concurrency: the version the caller last read (D-012). */
export const ExpectedVersion = Version

/** Soft rules the actor knowingly overrides (D-014, D-047). Stored in `leave_events`. */
export const AcknowledgedRuleIds = z.array(AvailabilityRuleId)

/** Raises `duplicate_item` on the second occurrence of a key in a list. */
export function checkDistinct<T>(
  ctx: Ctx,
  items: readonly T[],
  keyOf: (item: T) => string,
  path: readonly (string | number)[] = [],
): void {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    const key = keyOf(item)
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', message: IssueCode.enum.duplicate_item, path: [...path, index] })
    }
    seen.add(key)
  })
}

/** A list of ids without repetition. */
export function distinctIds<Id extends z.ZodType<string>>(id: Id) {
  return z.array(id).superRefine((ids, ctx) => {
    checkDistinct(ctx, ids, (value) => value)
  })
}

/**
 * `changes` of an update: any subset of the updatable columns, at least one set. The adapter
 * merges them into the stored row and parses the merged row with the entity schema, so
 * cross-column checks always run on the complete row.
 */
export function changesOf<Shape extends z.core.$ZodShape>(shape: Shape) {
  return z
    .strictObject(shape)
    .partial()
    .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
      message: IssueCode.enum.no_changes,
    })
}

/** `{ id, expected_version, changes }`: the update input of a mutable entity. */
export function updateInput<Id extends z.ZodType, Shape extends z.core.$ZodShape>(
  id: Id,
  shape: Shape,
) {
  return z.strictObject({ id, expected_version: ExpectedVersion, changes: changesOf(shape) })
}

/** `{ id, expected_version }`: archive (soft delete, D-017). */
export function archiveInput<Id extends z.ZodType>(id: Id) {
  return z.strictObject({ id, expected_version: ExpectedVersion })
}

/**
 * Reorder: the full ordered list of rows being sorted. `sort_order` is derived from the
 * position, so it is never input elsewhere after creation.
 */
export function reorderInput<Id extends z.ZodType<string>>(id: Id) {
  return z.strictObject({
    items: z
      .array(z.strictObject({ id, expected_version: ExpectedVersion }))
      .min(1)
      .superRefine((items, ctx) => {
        checkDistinct(ctx, items, idOf)
      }),
  })
}

/** The `id` of a parsed list item. Typed `unknown` because the id schema is generic here. */
function idOf(item: unknown): string {
  return typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : ''
}
