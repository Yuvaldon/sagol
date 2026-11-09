// Optional text has one stored form for "no value": NULL (D-101). Commands and forms both use these, so a
// value typed in a form and one sent to a command without a form are stored the same way.

/** A blank value, or one of spaces only, becomes NULL. Anything else is kept as it is. */
export function optionalText(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value
}

/** `row` with each listed text column passed through `optionalText`. Columns absent from `row` stay absent. */
export function withOptionalText<Row extends object>(row: Row, columns: readonly (keyof Row)[]): Row {
  const next = { ...row }
  for (const column of columns) {
    const value = next[column]
    if (typeof value === 'string') Object.assign(next, { [column]: optionalText(value) })
  }
  return next
}
