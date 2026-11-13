import { OrganizationId, UnitId, type Unit } from '@contracts'
import { describe, expect, it } from 'vitest'
import { unitChart } from './chart'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'

function unit(n: number, parent: number | null, sort_order: number): Unit {
  return {
    id: UnitId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name: `U${String(n)}`,
    code: null,
    parent_id: parent === null ? null : UnitId.parse(uuid(parent)),
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    archived_at: null,
  }
}

const placed = (chart: ReturnType<typeof unitChart>) => chart.nodes.map((node) => [node.unit.name, node.depth, node.slot])

describe('unitChart', () => {
  it('is empty without units', () => {
    expect(unitChart([])).toEqual({ nodes: [], families: [], slots: 0, depths: 0 })
  })

  it('centers a parent over its first and last child, and gives each leaf a slot in order', () => {
    // 1 ─┬─ 2 ─┬─ 4
    //    │     └─ 5
    //    └─ 3
    const chart = unitChart([unit(3, 1, 2), unit(5, 2, 2), unit(1, null, 1), unit(2, 1, 1), unit(4, 2, 1)])
    expect(placed(chart)).toEqual([
      ['U1', 0, 1.25],
      ['U2', 1, 0.5],
      ['U4', 2, 0],
      ['U5', 2, 1],
      ['U3', 1, 2],
    ])
    expect(chart.families).toEqual([
      { depth: 0, parentSlot: 1.25, childSlots: [0.5, 2] },
      { depth: 1, parentSlot: 0.5, childSlots: [0, 1] },
    ])
    expect(chart.slots).toBe(3)
    expect(chart.depths).toBe(3)
  })

  it('sets roots side by side, a unit with a parent out of sight among them', () => {
    const chart = unitChart([unit(1, null, 1), unit(2, 99, 2), unit(3, 1, 1)])
    expect(placed(chart)).toEqual([
      ['U1', 0, 0],
      ['U3', 1, 0],
      ['U2', 0, 1],
    ])
    expect(chart.families).toEqual([{ depth: 0, parentSlot: 0, childSlots: [0] }])
    expect(chart.slots).toBe(2)
  })
})
