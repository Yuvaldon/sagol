import { CalendarDate, LeaveTypeId, type Leave } from '@contracts'
import { describe, expect, it } from 'vitest'
import { duplicatedLeaveColumns } from './duplicate'

const day = (value: string) => CalendarDate.parse(value)

describe('a duplicated leave (D-049)', () => {
  it('copies the type, the effect, the reason and the properties only', () => {
    const source = {
      leave_type_id: LeaveTypeId.parse('00000000-0000-4000-8000-000000000001'),
      availability_effect_override: 'available',
      reason: 'exam',
      properties: { a: 1 },
      start_date: day('2026-12-01'),
    } as unknown as Leave
    expect(duplicatedLeaveColumns(source)).toEqual({
      leave_type_id: source.leave_type_id,
      availability_effect_override: 'available',
      reason: 'exam',
      properties: { a: 1 },
    })
  })
})
