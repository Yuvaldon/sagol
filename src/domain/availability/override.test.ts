import { describe, expect, it } from 'vitest'
import { AvailabilityRuleId, DeploymentId, TagId, UnitId } from '@contracts'
import { overridingRule, type OverrideShape } from './index'

// Test data only (iron rule 4).

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const UNIT = UnitId.parse(uuid(1))
const OTHER_UNIT = UnitId.parse(uuid(2))
const ROTATION = DeploymentId.parse(uuid(3))
const MEDIC = TagId.parse(uuid(4))

let next = 100
function rule(extra: Partial<OverrideShape> = {}): OverrideShape {
  next += 1
  return {
    id: AvailabilityRuleId.parse(uuid(next)),
    is_enabled: true,
    archived_at: null,
    priority: 0,
    scope_unit_id: UNIT,
    scope_mode: 'unit_tree',
    scope_level_id: null,
    population_filter: {},
    group_by: 'none',
    group_tag_category_id: null,
    effective_from: null,
    effective_to: null,
    deployment_id: null,
    ...extra,
  }
}

describe('overridingRule (D-482)', () => {
  it('names the higher rule over the same people of the same unit', () => {
    const low = rule({ priority: 1 })
    const high = rule({ priority: 2 })
    expect(overridingRule(low, [low, high])).toBe(high.id)
    expect(overridingRule(high, [low, high])).toBeNull()
  })

  it('takes the highest of several', () => {
    const low = rule({ priority: 1 })
    const middle = rule({ priority: 2 })
    const top = rule({ priority: 5 })
    expect(overridingRule(low, [low, middle, top])).toBe(top.id)
  })

  it('leaves both effective at equal priority', () => {
    const one = rule({ priority: 1 })
    const two = rule({ priority: 1 })
    expect(overridingRule(one, [one, two])).toBeNull()
  })

  it('needs the same unit, people and grouping', () => {
    const low = rule({ priority: 1 })
    expect(overridingRule(low, [low, rule({ priority: 2, scope_unit_id: OTHER_UNIT })])).toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, scope_mode: 'each_child' })])).toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, group_by: 'command_rank' })])).toBeNull()
    const medics = { where: { kind: 'tag' as const, match: 'any' as const, tag_ids: [MEDIC] } }
    expect(overridingRule(low, [low, rule({ priority: 2, population_filter: medics })])).toBeNull()
  })

  it('needs the higher rule on every day of the lower one', () => {
    const low = rule({ priority: 1, effective_from: '2026-12-10', effective_to: '2026-12-17' })
    expect(overridingRule(low, [low, rule({ priority: 2, effective_from: '2026-12-01', effective_to: '2026-12-31' })])).not.toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, effective_from: '2026-12-12' })])).toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, effective_to: '2026-12-15' })])).toBeNull()
    // An open lower rule is covered only by an open higher one.
    const open = rule({ priority: 1 })
    expect(overridingRule(open, [open, rule({ priority: 2, effective_from: '2026-01-01' })])).toBeNull()
  })

  it('reads a rotation as a span the higher rule must share or not limit', () => {
    const low = rule({ priority: 1, deployment_id: ROTATION })
    expect(overridingRule(low, [low, rule({ priority: 2 })])).not.toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, deployment_id: ROTATION })])).not.toBeNull()
    const open = rule({ priority: 1 })
    expect(overridingRule(open, [open, rule({ priority: 2, deployment_id: ROTATION })])).toBeNull()
  })

  it('counts no rule that is off or archived, on either side', () => {
    const low = rule({ priority: 1 })
    expect(overridingRule(low, [low, rule({ priority: 2, is_enabled: false })])).toBeNull()
    expect(overridingRule(low, [low, rule({ priority: 2, archived_at: '2026-11-01T00:00:00Z' })])).toBeNull()
    const off = rule({ priority: 1, is_enabled: false })
    expect(overridingRule(off, [off, rule({ priority: 2 })])).toBeNull()
  })
})
