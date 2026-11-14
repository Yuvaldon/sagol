import { describe, expect, it } from 'vitest'
import { archivedRows } from './archived'

describe('archivedRows (D-371)', () => {
  it('keeps the archived rows in the list order', () => {
    const rows = [
      { id: 'a', archived_at: null },
      { id: 'b', archived_at: '2026-01-02T00:00:00.000Z' },
      { id: 'c', archived_at: '2026-01-01T00:00:00.000Z' },
    ]
    expect(archivedRows(rows).map((row) => row.id)).toEqual(['b', 'c'])
  })
})
