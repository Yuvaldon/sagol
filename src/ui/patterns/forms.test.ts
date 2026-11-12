import type { AppError } from '@contracts'
import { describe, expect, it } from 'vitest'
import { formStateOf, rowIssuesOnFields } from './forms'

describe('row issues on the form fields (OI-114)', () => {
  const answer: AppError = {
    code: 'validation_failed',
    issues: [
      { path: ['leaves', 1, 'soldier_id'], code: 'archived' },
      { path: ['leaves', 0, 'start_date'], code: 'required' },
      { path: ['leaves', 0, 'properties', 'shift'], code: 'required' },
      { path: ['name'], code: 'too_short' },
    ],
  }

  it('lands each row issue on the field the row came from', () => {
    const lifted = rowIssuesOnFields(answer, 'leaves', { soldier_id: 'soldier_ids' })
    const state = formStateOf(lifted, ['soldier_ids', 'start_date', 'name', 'properties.shift'])
    expect(state.failure).toBeNull()
    expect(state.answered.map((issue) => issue.path)).toEqual([['soldier_ids'], ['start_date'], ['properties', 'shift'], ['name']])
  })

  it('leaves other lists and other failures as they are', () => {
    expect(rowIssuesOnFields(answer, 'copies', {})).toEqual(answer)
    const failure: AppError = { code: 'not_found' }
    expect(rowIssuesOnFields(failure, 'leaves', {})).toBe(failure)
  })
})
