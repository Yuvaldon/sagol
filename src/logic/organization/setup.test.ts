import { describe, expect, it } from 'vitest'
import { nextSetupStep, setupSteps } from './setup'

const LIVE = { archived_at: null }
const ARCHIVED = { archived_at: '2026-11-01T00:00:00Z' }

describe('setup steps (D-033, D-180)', () => {
  it('keeps the allowed steps, in the setup order', () => {
    expect(setupSteps(['soldiers', 'unit_levels', 'tags'], {}).map((step) => step.id)).toEqual(['unit_levels', 'tags', 'soldiers'])
  })

  it('is done once a live row exists, and an archived one does not count', () => {
    const steps = setupSteps(['units', 'leave_types', 'tags'], { units: [ARCHIVED, LIVE], leave_types: [ARCHIVED], tags: [] })
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ['units', true],
      ['leave_types', false],
      ['tags', false],
    ])
  })

  it('opens each step in its own module', () => {
    expect(setupSteps(['rank_bindings'], {})[0]?.panel).toBe('rank_bindings')
  })

  it('opens the tags step in the tags, not in their categories (D-285)', () => {
    expect(setupSteps(['tags'], {})[0]?.panel).toBe('tags')
  })

  it('names the first step not done as the next one, and none once all are done (D-285)', () => {
    const steps = setupSteps(['unit_levels', 'units', 'soldiers'], { unit_levels: [LIVE], units: [], soldiers: [LIVE] })
    expect(nextSetupStep(steps)?.id).toBe('units')
    expect(nextSetupStep(setupSteps(['unit_levels'], { unit_levels: [LIVE] }))).toBeNull()
  })
})
