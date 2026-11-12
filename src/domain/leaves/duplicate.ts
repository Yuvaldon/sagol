import type { Leave } from '@contracts'

// The columns a duplicated leave copies (D-049, D-179). Pure.

/** What `leaves.duplicate` copies from its source (D-049): never the soldier, the dates, the status or the history. */
export type DuplicatedLeaveColumns = Pick<Leave, 'leave_type_id' | 'availability_effect_override' | 'reason' | 'properties'>

export function duplicatedLeaveColumns(source: Leave): DuplicatedLeaveColumns {
  const { leave_type_id, availability_effect_override, reason, properties } = source
  return { leave_type_id, availability_effect_override, reason, properties }
}
