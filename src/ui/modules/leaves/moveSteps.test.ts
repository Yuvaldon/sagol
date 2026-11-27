import { describe, expect, it } from 'vitest'
import { moveSteps } from './moveSteps'

// The leave card's steps on a leave of the round (D-481). Sample values, tests only.

const ALL = { approve: true, reject: true, edit: true }
const MOVE = { from: { start_date: '2026-11-26', end_date: '2026-11-28' }, to: { start_date: '2026-11-23', end_date: '2026-11-25' } }

describe('the steps of a round leave (D-481)', () => {
  it('rejects a request as ever, and a round leave only once its thread says it was not moved', () => {
    expect(moveSteps(false, { status: 'loading' }, ALL).reject).toBe(true)
    expect(moveSteps(true, { status: 'loading' }, ALL).reject).toBe(false)
    expect(moveSteps(true, { status: 'failed', error: { code: 'network' } as never }, ALL).reject).toBe(false)
    expect(moveSteps(true, { status: 'ready', value: null }, ALL).reject).toBe(true)
    expect(moveSteps(true, { status: 'ready', value: MOVE }, ALL)).toEqual({ reject: false, keepOriginal: true, approvesMove: true })
  })

  it('keeps the original dates only for who may edit the leave as well as approve it', () => {
    expect(moveSteps(true, { status: 'ready', value: MOVE }, { ...ALL, edit: false }).keepOriginal).toBe(false)
    expect(moveSteps(true, { status: 'ready', value: MOVE }, { ...ALL, approve: false }).keepOriginal).toBe(false)
  })
})
