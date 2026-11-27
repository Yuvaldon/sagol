import type { CalendarDate, SoldierId } from '@contracts'
import { describe, expect, it } from 'vitest'
import { presentByName } from './withMe'

// "איתך היום" (D-478): the names in Hebrew order. Sample rows, test file only.

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}` as SoldierId

describe('presentByName (D-478, D-094)', () => {
  it('orders by last name, then first name, in Hebrew order', () => {
    const soldiers = [
      { id: id(1), first_name: 'נועה', last_name: 'לוי' },
      { id: id(2), first_name: 'אבי', last_name: 'לוי' },
      { id: id(3), first_name: 'תמר', last_name: 'כהן' },
    ]
    expect(presentByName({ date: '2026-11-10' as CalendarDate, soldiers }).map((row) => row.id)).toEqual([id(3), id(2), id(1)])
  })
})
