import type { Leave } from '@contracts'

// The columns a duplicated leave copies (D-049, D-179). Pure.

/**
 * What `leaves.duplicate` copies from its source (D-049), its rotation included (D-216): never the soldier, the dates,
 * the status or the history.
 */
export type DuplicatedLeaveColumns = Pick<
  Leave,
  'deployment_id' | 'leave_type_id' | 'availability_effect_override' | 'reason' | 'properties'
>

export function duplicatedLeaveColumns(source: Leave): DuplicatedLeaveColumns {
  const { deployment_id, leave_type_id, availability_effect_override, reason, properties } = source
  return { deployment_id, leave_type_id, availability_effect_override, reason, properties }
}
