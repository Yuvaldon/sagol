import { LeaveEventId, LeaveId, SoldierId, type Leave } from '@contracts'
import { dictionary as he } from '@i18n'
import type { MyUpdateLine } from '@logic'
import { describe, expect, it } from 'vitest'
import { updateText } from './leaveText'

// An update line names who did what (D-350). Sample data, test files only.

const DAN = SoldierId.parse('00000000-0000-4000-8000-000000000002')
const nameOf = (id: SoldierId | null) => (id === DAN ? 'דן כהן' : '?')

function lineOf(kind: MyUpdateLine['update']['kind']): MyUpdateLine {
  return {
    update: {
      id: LeaveEventId.parse('00000000-0000-4000-8000-000000000101'),
      leave_id: LeaveId.parse('00000000-0000-4000-8000-000000000010'),
      actor_id: DAN,
      kind,
      created_at: '2026-11-08T10:00:00.000Z',
    },
    leave: {} as Leave,
    unread: true,
  }
}

describe('updateText', () => {
  it('names the actor and the change', () => {
    expect(updateText(lineOf('approved'), nameOf)).toBe(['דן כהן', he.myLeaves.updateVerbs.approved, he.myLeaves.updateObject].join(' '))
  })

  it('says a comment was added', () => {
    expect(updateText(lineOf('comment'), nameOf)).toBe(['דן כהן', he.myLeaves.updateComment].join(' '))
  })
})
