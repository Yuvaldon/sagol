import { CalendarDate } from '@contracts'
import { describe, expect, it } from 'vitest'
import { quickActionOf, rotationEnded, type QuickActionFacts } from './quickAction'

// The quick action by role and by mode (D-266, D-296): the soldier requests for themselves, the commander may also open
// a rotation, and who only enters leaves for others has no quick action.

const ROLES = {
  soldier: { requestsForSelf: true, opensRotation: false },
  commander: { requestsForSelf: true, opensRotation: true },
  entersForOthers: { requestsForSelf: false, opensRotation: false },
} as const

const MODES = {
  routine: { mode: 'routine', requests: false },
  upcoming: { mode: 'running', requests: true },
  current: { mode: 'running', requests: true },
  endedNotClosed: { mode: 'ended', requests: true },
} as const satisfies Record<string, Pick<QuickActionFacts, 'mode' | 'requests'>>

const EXPECTED = {
  routine: { soldier: null, commander: 'open_rotation', entersForOthers: null },
  upcoming: { soldier: 'new_leave', commander: 'new_leave', entersForOthers: null },
  current: { soldier: 'new_leave', commander: 'new_leave', entersForOthers: null },
  endedNotClosed: { soldier: null, commander: null, entersForOthers: null },
} as const

describe('quickActionOf', () => {
  for (const [modeName, mode] of Object.entries(MODES)) {
    for (const [roleName, role] of Object.entries(ROLES)) {
      it(`${modeName} × ${roleName}`, () => {
        expect(quickActionOf({ ...mode, ...role })).toBe(EXPECTED[modeName as keyof typeof EXPECTED][roleName as keyof typeof ROLES])
      })
    }
  }

  it('offers no request while no rotation a request can be about exists', () => {
    expect(quickActionOf({ mode: 'running', requests: false, ...ROLES.soldier })).toBeNull()
  })
})

describe('rotationEnded', () => {
  const today = CalendarDate.parse('2026-11-12')
  it('is true only once the planned end is before today', () => {
    expect(rotationEnded({ end_date: CalendarDate.parse('2026-11-11') }, today)).toBe(true)
    expect(rotationEnded({ end_date: today }, today)).toBe(false)
    expect(rotationEnded({ end_date: null }, today)).toBe(false)
  })
})
