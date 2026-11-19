// Join-request name matching (D-446): how lenient "a close name" is. Read by data, passed to domain.

export const NAME_MATCH = {
  /** Edits (Levenshtein) allowed between two parts of a name, first or last, after normalization. */
  max_edits: 1,
  /** A part shorter than this, in letters, must be equal: short names that differ by a letter are different people. */
  min_typo_length: 4,
} as const
