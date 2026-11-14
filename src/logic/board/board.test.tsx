import { PANEL_IDS } from '@config'
import {
  CommandRankId,
  OrganizationId,
  PropertyDefinitionId,
  PropertyOptionId,
  SoldierId,
  SoldierTagId,
  TagId,
  UnitId,
  UnitMembershipId,
  type CommandRank,
  type PermissionCheck,
  type PropertyDefinition,
  type Result,
  type Soldier,
  type Unit,
  type UnitMembership,
} from '@contracts'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCan } from '../permissions/hooks'
import { usePlacementHints } from '../roster/hooks'
import { soldierRows, unitStateOn } from '../roster/roster'
import { LogicProvider } from '../runtime/LogicProvider'
import { allowEverything, fakePorts, organizationIn, wrapperOf } from '../testing/ports'
import { useToday } from '../session/today'
import { filterUnitOf, unitFilterOf, useViewFilter } from '../view-state/filter'
import { usePanel } from '../view-state/panel'
import { WorkspaceSearch, useWorkspaceSearch } from '../view-state/search'
import { usePresenceDay, useTableSort } from '../view-state/board'
import { useActiveView } from '../view-state/view'
import { dateWindowOf, shiftedWindow, useDateWindow } from '../view-state/window'
import { boardItems, type BoardInput, type BoardItem } from './rows'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

function soldier(n: number, first_name: string, last_name: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name,
    last_name,
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
    ...overrides,
  }
}

function rank(n: number, seniority: number): CommandRank {
  return {
    id: CommandRankId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    title: `R${n}`,
    short_title: null,
    seniority,
    color_key: null,
    ...audit,
  }
}

function unit(n: number, name: string, parent: number | null, sort_order = 0): Unit {
  return {
    id: UnitId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name,
    code: null,
    parent_id: parent === null ? null : UnitId.parse(uuid(parent)),
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order,
    properties: {},
    ...audit,
  }
}

function membership(n: number, soldierN: number, unitN: number, valid_from: string, valid_to: string | null): UnitMembership {
  return {
    id: UnitMembershipId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    unit_id: UnitId.parse(uuid(unitN)),
    membership_type: 'primary',
    valid_from,
    valid_to,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    change_seq: 0,
  }
}

// Wednesday, in the week of Sunday 2026-11-08.
const TODAY = '2026-11-11'
const WEEK = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

describe('the date window (D-103)', () => {
  it('is the week that holds today when the URL has none, and follows it', () => {
    const window = dateWindowOf({}, TODAY)
    expect(window).toMatchObject({ from: '2026-11-08', to: '2026-11-14', followsToday: true, holdsToday: true })
    expect(window.days).toEqual(WEEK)
    expect(dateWindowOf({}, '2026-11-15').from).toBe('2026-11-15')
  })

  it('takes a valid pair from a link, of any length up to the limit', () => {
    expect(dateWindowOf({ from: '2026-12-01', to: '2026-12-03' }, TODAY)).toMatchObject({
      days: ['2026-12-01', '2026-12-02', '2026-12-03'],
      followsToday: false,
      holdsToday: false,
    })
    expect(dateWindowOf({ from: TODAY, to: TODAY }, TODAY).days).toEqual([TODAY])
  })

  it('reads a pair with one side, inverted or too long as the week of its anchor (D-211)', () => {
    for (const params of [{ from: '2026-12-01' }, { from: '2026-12-03', to: '2026-12-01' }, { from: '2026-12-02', to: '2027-12-31' }]) {
      expect(dateWindowOf(params, TODAY)).toMatchObject({ kind: 'week', from: '2026-11-29', followsToday: false })
    }
  })

  it('moves by its own length', () => {
    expect(shiftedWindow({ from: '2026-11-08', to: '2026-11-14' }, 1)).toEqual({ from: '2026-11-15', to: '2026-11-21' })
    expect(shiftedWindow({ from: '2026-11-08', to: '2026-11-14' }, -1)).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(shiftedWindow({ from: '2026-12-01', to: '2026-12-03' }, 1)).toEqual({ from: '2026-12-04', to: '2026-12-06' })
  })
})

describe('the unit filter (D-104, D-131)', () => {
  const PLATOON = UnitId.parse(uuid(11))

  it('writes one unit with its sub-units, and nothing for the whole organization', () => {
    expect(unitFilterOf(PLATOON)).toEqual({ where: { kind: 'unit', unit_ids: [PLATOON], include_descendants: true } })
    expect(unitFilterOf(null)).toBeUndefined()
  })

  it('reads back what it wrote, and anything else as another filter', () => {
    expect(filterUnitOf(unitFilterOf(PLATOON) ?? null)).toEqual({ kind: 'unit', unitId: PLATOON })
    expect(filterUnitOf(null)).toEqual({ kind: 'organization' })
    expect(filterUnitOf({})).toEqual({ kind: 'organization' })
    expect(filterUnitOf({ where: { kind: 'unit', unit_ids: [PLATOON], include_descendants: false } })).toEqual({ kind: 'other' })
    // A rule of the bar beside no unit is the whole organization (D-131, D-312); what the bar does not read is other.
    expect(filterUnitOf({ where: { kind: 'soldier_status', statuses: ['active'] } })).toEqual({ kind: 'organization' })
    expect(filterUnitOf({ where: { kind: 'seniority', min: 1, max: null } })).toEqual({ kind: 'other' })
  })
})

describe('what a row knows about its unit (D-106, OI-048)', () => {
  const units = new Map([[UnitId.parse(uuid(10)), unit(10, 'פלוגה', null)]])
  const dana = SoldierId.parse(uuid(1))
  const placed = [membership(70, 1, 10, '2026-01-01', null)]
  const elsewhere = [membership(70, 1, 99, '2026-01-01', null)]

  it('tells a visible unit, no unit, another unit and unknown apart', () => {
    expect(unitStateOn(placed, units, dana, TODAY, true)).toMatchObject({ kind: 'unit', unit: { name: 'פלוגה' } })
    expect(unitStateOn([], units, dana, TODAY, true)).toEqual({ kind: 'none' })
    expect(unitStateOn(elsewhere, units, dana, TODAY, true)).toEqual({ kind: 'other' })
    expect(unitStateOn([], units, dana, TODAY, false)).toEqual({ kind: 'unknown' })
    expect(unitStateOn(placed, units, dana, null, true)).toEqual({ kind: 'unknown' })
  })

  it('knows "no unit" from rows it read, whatever the hint says', () => {
    expect(unitStateOn([membership(70, 1, 10, '2026-01-01', '2026-02-01')], units, dana, TODAY, false)).toEqual({ kind: 'none' })
  })

  it('reaches the soldiers list', () => {
    const [row] = soldierRows([soldier(1, 'דנה', 'לוי')], [], [...units.values()], [], TODAY, () => false)
    expect(row?.unitState).toEqual({ kind: 'unknown' })
  })
})

describe('the rows of the board (D-105)', () => {
  // פלוגה › מחלקה א › כיתה 1, and מחלקה ב beside מחלקה א.
  const units = [unit(10, 'פלוגה', null), unit(11, 'מחלקה א', 10, 0), unit(12, 'מחלקה ב', 10, 1), unit(13, 'כיתה 1', 11)]
  const ranks = [rank(20, 1), rank(21, 5)]
  const PLATOON_A = UnitId.parse(uuid(11))

  const base = (overrides: Partial<BoardInput>): BoardInput => ({
    soldiers: [],
    ranks,
    seniorityOverrides: [],
    units,
    unitTree: units,
    memberships: [],
    soldierTags: [],
    propertyDefinitions: [],
    days: WEEK,
    today: TODAY,
    filter: null,
    scopeUnitId: null,
    readsPlacements: () => true,
    marked: null,
    absent: null,
    sorts: [{ key: 'seniority', order: 'desc' }],
    daysAway: null,
    ...overrides,
  })

  const describeItems = (items: readonly BoardItem[]) =>
    items.map((item) =>
      item.kind === 'group'
        ? `# ${item.label.kind === 'unit' ? item.label.path.join(' · ') : item.label.kind} (${item.size})`
        : `${item.soldier.first_name} ${item.inScope.map((on) => (on ? '■' : '□')).join('')}`,
    )

  it('groups by unit in tree order, the most senior first, then by name', () => {
    const fighter = CommandRankId.parse(uuid(20))
    const commander = CommandRankId.parse(uuid(21))
    const items = boardItems(
      base({
        soldiers: [
          soldier(1, 'אבי', 'כהן', { command_rank_id: fighter }),
          soldier(2, 'בני', 'אבו', { command_rank_id: fighter }),
          soldier(3, 'גיל', 'זך', { command_rank_id: commander }),
          soldier(4, 'דן', 'רז'),
          soldier(5, 'הדר', 'טל'),
        ],
        memberships: [
          membership(70, 1, 11, '2026-01-01', null),
          membership(71, 2, 11, '2026-01-01', null),
          membership(72, 3, 11, '2026-01-01', null),
          membership(73, 4, 11, '2026-01-01', null),
          membership(74, 5, 13, '2026-01-01', null),
        ],
      }),
    )
    expect(describeItems(items)).toEqual([
      '# פלוגה · מחלקה א (4)',
      'גיל ■■■■■■■',
      'בני ■■■■■■■',
      'אבי ■■■■■■■',
      'דן ■■■■■■■',
      '# פלוגה · מחלקה א · כיתה 1 (1)',
      'הדר ■■■■■■■',
    ])
  })

  it('sorts inside each group by the chosen key and direction, and orders the groups by unit (D-214)', () => {
    const fighter = CommandRankId.parse(uuid(20))
    const commander = CommandRankId.parse(uuid(21))
    const input = (sort: BoardInput['sorts'][number], daysAway: BoardInput['daysAway'] = null) =>
      describeItems(
        boardItems(
          base({
            soldiers: [
              soldier(1, 'אבי', 'כהן', { command_rank_id: fighter }),
              soldier(2, 'בני', 'אבו', { command_rank_id: commander }),
              soldier(3, 'גיל', 'זך'),
              soldier(5, 'הדר', 'טל'),
            ],
            memberships: [
              membership(70, 1, 11, '2026-01-01', null),
              membership(71, 2, 11, '2026-01-01', null),
              membership(72, 3, 11, '2026-01-01', null),
              membership(74, 5, 13, '2026-01-01', null),
            ],
            sorts: [sort],
            daysAway,
          }),
        ),
      )
    const first = ['# פלוגה · מחלקה א (3)']
    const second = ['# פלוגה · מחלקה א · כיתה 1 (1)', 'הדר ■■■■■■■']
    expect(input({ key: 'name', order: 'asc' })).toEqual([...first, 'בני ■■■■■■■', 'גיל ■■■■■■■', 'אבי ■■■■■■■', ...second])
    expect(input({ key: 'name', order: 'desc' })).toEqual([...first, 'אבי ■■■■■■■', 'גיל ■■■■■■■', 'בני ■■■■■■■', ...second])
    // No rank comes last whichever way.
    expect(input({ key: 'rank', order: 'asc' })).toEqual([...first, 'אבי ■■■■■■■', 'בני ■■■■■■■', 'גיל ■■■■■■■', ...second])
    const away = (soldierId: SoldierId) => (soldierId === SoldierId.parse(uuid(3)) ? 4 : soldierId === SoldierId.parse(uuid(1)) ? 1 : 0)
    expect(input({ key: 'absent', order: 'desc' }, away)).toEqual([...first, 'גיל ■■■■■■■', 'אבי ■■■■■■■', 'בני ■■■■■■■', ...second])
    // The unit orders the groups; inside one, the rows keep the default, most senior first (D-214, D-313).
    expect(input({ key: 'unit', order: 'desc' })).toEqual([...second, ...first, 'בני ■■■■■■■', 'אבי ■■■■■■■', 'גיל ■■■■■■■'])
  })

  it('breaks the ties of one rule with the next, and sorts by a property, no value last (D-313)', () => {
    const fighter = CommandRankId.parse(uuid(20))
    const blood = PropertyDefinitionId.parse(uuid(50))
    const typeA = PropertyOptionId.parse(uuid(51))
    const typeO = PropertyOptionId.parse(uuid(52))
    const definition: PropertyDefinition = {
      id: blood,
      organization_id: ORGANIZATION,
      entity_type: 'soldier',
      label: 'blood',
      data_type: 'select',
      options: [
        { id: typeO, label: 'O', color_key: null, sort_order: 1 },
        { id: typeA, label: 'A', color_key: null, sort_order: 0 },
      ],
      is_required: false,
      sort_order: 0,
      ...audit,
    }
    const input = (sorts: BoardInput['sorts']) =>
      describeItems(
        boardItems(
          base({
            propertyDefinitions: [definition],
            soldiers: [
              soldier(1, 'אבי', 'כהן', { command_rank_id: fighter, properties: { [blood]: typeO } }),
              soldier(2, 'בני', 'אבו', { properties: { [blood]: typeA } }),
              soldier(3, 'גיל', 'זך', { command_rank_id: fighter, properties: { [blood]: typeA } }),
              soldier(4, 'דן', 'רז', { command_rank_id: fighter }),
            ],
            memberships: [
              membership(70, 1, 11, '2026-01-01', null),
              membership(71, 2, 11, '2026-01-01', null),
              membership(72, 3, 11, '2026-01-01', null),
              membership(73, 4, 11, '2026-01-01', null),
            ],
            sorts,
          }),
        ),
      ).slice(1)
    expect(input([{ property: blood, order: 'asc' }])).toEqual(['בני ■■■■■■■', 'גיל ■■■■■■■', 'אבי ■■■■■■■', 'דן ■■■■■■■'])
    expect(input([{ property: blood, order: 'desc' }])).toEqual(['אבי ■■■■■■■', 'בני ■■■■■■■', 'גיל ■■■■■■■', 'דן ■■■■■■■'])
    expect(input([{ key: 'rank', order: 'desc' }, { property: blood, order: 'desc' }])).toEqual([
      'אבי ■■■■■■■',
      'גיל ■■■■■■■',
      'דן ■■■■■■■',
      'בני ■■■■■■■',
    ])
    // No rules: the name alone.
    expect(input([])).toEqual(['בני ■■■■■■■', 'גיל ■■■■■■■', 'אבי ■■■■■■■', 'דן ■■■■■■■'])
  })

  it('keeps who served one day of the week, mutes the other days, and names paths below the selected unit', () => {
    const items = boardItems(
      base({
        filter: unitFilterOf(PLATOON_A) ?? null,
        scopeUnitId: PLATOON_A,
        soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן'), soldier(3, 'גיל', 'כהן'), soldier(4, 'דן', 'כהן')],
        memberships: [
          // Leaves for מחלקה ב on Tuesday.
          membership(70, 1, 13, '2026-01-01', '2026-11-09'),
          membership(71, 1, 12, '2026-11-10', null),
          // Joins on Thursday.
          membership(72, 2, 11, '2026-11-12', null),
          // Never in it this week.
          membership(73, 3, 12, '2026-01-01', null),
          membership(74, 4, 11, '2026-01-01', null),
        ],
      }),
    )
    expect(describeItems(items)).toEqual([
      '# מחלקה א (2)',
      'בני □□□□■■■',
      'דן ■■■■■■■',
      '# כיתה 1 (1)',
      'אבי ■■□□□□□',
    ])
  })

  it('keeps who serves in an archived sub-unit under the selected unit (D-147, OI-098)', () => {
    // כיתה 1 is archived: the live units leave it out, the tree still holds it under מחלקה א.
    const live = units.filter((entry) => entry.id !== UnitId.parse(uuid(13)))
    const items = (unitTree: readonly Unit[]) =>
      boardItems(
        base({
          units: live,
          unitTree,
          filter: unitFilterOf(PLATOON_A) ?? null,
          scopeUnitId: PLATOON_A,
          soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן')],
          memberships: [membership(70, 1, 13, '2026-01-01', null), membership(71, 2, 12, '2026-01-01', null)],
        }),
      )
    // Under its own heading, not "another unit".
    expect(describeItems(items(units))).toEqual(['# כיתה 1 (1)', 'אבי ■■■■■■■'])
    // Read from the live units alone, the archived sub-unit would drop out of "מחלקה א and below".
    expect(items(live)).toEqual([])
  })

  it('leaves out inactive and archived soldiers', () => {
    const items = boardItems(
      base({
        soldiers: [soldier(1, 'אבי', 'כהן', { status: 'inactive' }), soldier(2, 'בני', 'כהן', { archived_at: AT }), soldier(3, 'גיל', 'כהן')],
      }),
    )
    expect(describeItems(items)).toEqual(['# פלוגה (1)', 'גיל ■■■■■■■'])
  })

  it('puts soldiers without a visible unit last, by what the actor can know', () => {
    // A second root: with no single root, a soldier with no unit keeps the "no unit" group (D-315).
    const items = boardItems(
      base({
        units: [...units, unit(14, 'גדוד', null, 1)],
        soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן'), soldier(3, 'גיל', 'כהן'), soldier(4, 'דן', 'כהן')],
        memberships: [membership(70, 2, 99, '2026-01-01', null), membership(71, 4, 10, '2026-01-01', null)],
        readsPlacements: (id) => id !== SoldierId.parse(uuid(3)),
      }),
    )
    expect(describeItems(items)).toEqual([
      '# פלוגה (1)',
      'דן ■■■■■■■',
      '# none (1)',
      'אבי ■■■■■■■',
      '# other (1)',
      'בני ■■■■■■■',
      '# unknown (1)',
      'גיל ■■■■■■■',
    ])
  })

  it('keeps a soldier out while their own hint has not answered, unless their placements were read (OI-093)', () => {
    const items = boardItems(
      base({
        soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן')],
        memberships: [membership(71, 2, 10, '2026-01-01', null)],
        readsPlacements: () => null,
      }),
    )
    expect(describeItems(items)).toEqual(['# פלוגה (1)', 'בני ■■■■■■■'])
  })

  it('groups by today when the soldier is in the view today, else by the first day they are', () => {
    const memberships = [membership(70, 1, 13, '2026-01-01', '2026-11-12'), membership(71, 1, 11, '2026-11-13', null)]
    const withToday = boardItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships }))
    expect(describeItems(withToday)[0]).toBe('# פלוגה · מחלקה א · כיתה 1 (1)')
    const later = boardItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships, today: '2026-11-20' }))
    expect(describeItems(later)[0]).toBe('# פלוגה · מחלקה א · כיתה 1 (1)')
    const nextWeek = ['2026-11-15', '2026-11-16']
    expect(describeItems(boardItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships, days: nextWeek })))[0]).toBe(
      '# פלוגה · מחלקה א (1)',
    )
  })

  const MEDIC = TagId.parse(uuid(40))
  const everyoneInA = [membership(70, 1, 11, '2026-01-01', null), membership(71, 2, 11, '2026-01-01', null), membership(72, 3, 11, '2026-01-01', null)]
  const three = [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן', { status: 'inactive' }), soldier(3, 'גיל', 'כהן')]
  const names = (items: readonly BoardItem[]) => items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier.first_name] : []))

  it('reads soldier tags, and a status condition brings inactive soldiers back (D-131)', () => {
    const tagged = { id: SoldierTagId.parse(uuid(701)), deployment_id: null, soldier_id: SoldierId.parse(uuid(3)), tag_id: MEDIC, organization_id: ORGANIZATION, created_at: AT, created_by: null }
    const medics = boardItems(
      base({ soldiers: three, memberships: everyoneInA, soldierTags: [tagged], filter: { where: { kind: 'tag', match: 'any', tag_ids: [MEDIC] } } }),
    )
    expect(names(medics)).toEqual(['גיל'])
    expect(names(boardItems(base({ soldiers: three, memberships: everyoneInA })))).toEqual(['אבי', 'גיל'])
    const inactive = boardItems(
      base({ soldiers: three, memberships: everyoneInA, filter: { where: { kind: 'soldier_status', statuses: ['inactive'] } } }),
    )
    expect(names(inactive)).toEqual(['בני'])
  })

  it('keeps only rows with a matching mark under a leave condition (D-132)', () => {
    const marked = (id: SoldierId) => id === SoldierId.parse(uuid(1))
    expect(names(boardItems(base({ soldiers: three, memberships: everyoneInA, marked })))).toEqual(['אבי'])
  })

  it('keeps who is absent on a day in the view, and mutes the days they are present (D-133)', () => {
    // אבי is away on Monday and Tuesday; גיל is away on Saturday, after he left the platoon on Friday.
    const absentOn = new Map([
      [SoldierId.parse(uuid(1)), [false, true, true, false, false, false, false]],
      [SoldierId.parse(uuid(3)), [false, false, false, false, false, false, true]],
    ])
    const memberships = [membership(70, 1, 11, '2026-01-01', null), membership(72, 3, 11, '2026-01-01', '2026-11-13')]
    const items = boardItems(
      base({
        soldiers: three,
        memberships,
        filter: { where: { kind: 'unit', unit_ids: [PLATOON_A], include_descendants: true } },
        absent: (id) => absentOn.get(id) ?? WEEK.map(() => false),
      }),
    )
    expect(names(items)).toEqual(['אבי'])
    const [row] = items.filter((item) => item.kind === 'soldier')
    expect(row?.kind === 'soldier' ? row.present : null).toEqual([true, false, false, true, true, true, true])
  })
})

describe('the board waits for the placement hints once (D-122, OI-082)', () => {
  it('stays settled when a soldier is added and their hint is still asked', async () => {
    let answer: (value: Result<boolean[]>) => void = () => undefined
    const can = vi.fn((checks: readonly PermissionCheck[]) =>
      checks.length > 1
        ? new Promise<Result<boolean[]>>((resolve) => {
            answer = resolve
          })
        : Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(() => true) }),
    )
    const ports = portsAt({ now: '2026-11-11T10:00:00.000Z' }, can)
    const { result, rerender } = renderHook(({ soldiers }: { soldiers: readonly Soldier[] }) => usePlacementHints(soldiers), {
      initialProps: { soldiers: [soldier(1, 'אבי', 'כהן')] },
      wrapper: wrapperOf(ports),
    })
    await waitFor(() => {
      expect(result.current.settled).toBe(true)
    })
    rerender({ soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן')] })
    expect(result.current.settled).toBe(true)
    act(() => {
      answer({ ok: true, value: [true, true] })
    })
    await waitFor(() => {
      expect(result.current.reads(SoldierId.parse(uuid(2)))).toBe(true)
    })
  })
})

// ------------------------------------------------------------ hooks over the URL and the clock

function portsAt(clock: { now: string }, can = vi.fn(allowEverything)) {
  return fakePorts({ session: { can }, repositories: { organizations: organizationIn() }, now: () => clock.now })
}

describe('today turns at midnight (D-107, OI-057)', () => {
  it('moves to the new day with the screen open, and asks the hints again', async () => {
    // 23:59:59.7 in Jerusalem.
    const clock = { now: '2026-11-11T21:59:59.700Z' }
    const ports = portsAt(clock)
    const check: PermissionCheck = { permission: { resource: 'soldiers', action: 'view' }, target: { kind: 'organization' } }
    const checks = [check]
    const { result } = renderHook(() => ({ today: useToday(), can: useCan(checks) }), {
      wrapper: wrapperOf(ports),
    })
    await waitFor(() => {
      expect(result.current.today).toBe('2026-11-11')
    })
    const asked = vi.mocked(ports.data.session.can).mock.calls.length
    clock.now = '2026-11-11T22:00:00.100Z'
    await waitFor(
      () => {
        expect(result.current.today).toBe('2026-11-12')
      },
      { timeout: 3000 },
    )
    await waitFor(() => {
      expect(vi.mocked(ports.data.session.can).mock.calls.length).toBeGreaterThan(asked)
    })
  })
})

describe('view state in the URL (D-103, D-104)', () => {
  const rootRoute = createRootRoute()
  const PLATOON = UnitId.parse(uuid(11))

  function Probe() {
    const search = useWorkspaceSearch()
    const panel = usePanel()
    const window = useDateWindow()
    const filter = useViewFilter()
    const view = useActiveView(['timeline'], 'desktop')
    const presence = usePresenceDay()
    const table = useTableSort()
    return (
      <div>
        <p data-testid="search">{JSON.stringify(search)}</p>
        <p data-testid="window">{JSON.stringify([window.window?.from, window.window?.to, view.view, filter.unit.kind])}</p>
        <button type="button" data-testid="open" onClick={() => { panel.open(PANEL_IDS.soldiers) }} />
        <button type="button" data-testid="close" onClick={panel.close} />
        <button type="button" data-testid="next" onClick={() => { window.shift(1) }} />
        <button type="button" data-testid="today" onClick={window.goToToday} />
        <button type="button" data-testid="unit" onClick={() => { filter.selectUnit(PLATOON) }} />
        <button type="button" data-testid="presence" onClick={presence.openToday} />
        <button type="button" data-testid="header" onClick={() => { table.sortRows({ key: 'name', order: 'desc' }) }} />
      </div>
    )
  }

  async function renderAt(url: string) {
    const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
    const history = createMemoryHistory({ initialEntries: [url] })
    const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
    const ports = portsAt({ now: '2026-11-11T10:00:00.000Z' })
    render(
      <LogicProvider ports={ports}>
        <RouterProvider router={router as never} />
      </LogicProvider>,
    )
    await screen.findByTestId('search')
    return { history }
  }

  const read = (id: string) => JSON.parse(screen.getByTestId(id).textContent) as unknown
  const press = (id: string) => {
    act(() => {
      screen.getByTestId(id).click()
    })
  }

  it('moves the week and returns to today in place of the current history entry (D-332)', async () => {
    const { history } = await renderAt('/')
    const start = history.location.state.__TSR_index
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-11-08', '2026-11-14', 'timeline', 'organization'])
    })
    press('next')
    await waitFor(() => {
      // An explicit range is written, since a bare URL opens on the rotation (D-220).
      expect(read('search')).toEqual({ range: 'week', from: '2026-11-15' })
    })
    press('today')
    await waitFor(() => {
      expect(read('search')).toEqual({ range: 'week' })
    })
    // Nothing is left behind for the back button to replay.
    expect(history.location.state.__TSR_index).toBe(start)
  })

  it('keeps the window and the filter when a panel opens and closes', async () => {
    await renderAt('/?from=2026-12-06&to=2026-12-12')
    press('unit')
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-12-06', '2026-12-12', 'timeline', 'unit'])
    })
    press('open')
    await waitFor(() => {
      expect(read('search')).toMatchObject({ panel: 'soldiers', from: '2026-12-06', filter: unitFilterOf(PLATOON) })
    })
    press('close')
    await waitFor(() => {
      expect(read('search')).toEqual({ from: '2026-12-06', to: '2026-12-12', filter: unitFilterOf(PLATOON) })
    })
  })

  it('keeps the leave conditions, "only who is missing" and the day when a panel opens (D-132 to D-134)', async () => {
    const leaves = encodeURIComponent(JSON.stringify({ statuses: ['pending'] }))
    await renderAt(`/?leaves=${leaves}&missing=true&day=2026-11-12`)
    press('open')
    await waitFor(() => {
      expect(read('search')).toEqual({ panel: 'soldiers', leaves: { statuses: ['pending'] }, missing: true, day: '2026-11-12' })
    })
  })

  it('opens the presence lists on today, whatever day they showed last (D-134)', async () => {
    await renderAt('/?day=2026-11-20&panel=soldiers&entity=new')
    press('presence')
    await waitFor(() => {
      expect(read('search')).toEqual({ panel: 'presence' })
    })
  })

  it('counts invalid leave conditions, "missing" and day as absent', async () => {
    const leaves = encodeURIComponent(JSON.stringify({ statuses: ['rejected'] }))
    await renderAt(`/?leaves=${leaves}&missing=false&day=soon`)
    await waitFor(() => {
      expect(read('search')).toEqual({})
    })
  })

  it('puts a header rule first and keeps the other rules after it (D-313)', async () => {
    const sorts = encodeURIComponent(JSON.stringify([{ key: 'unit', order: 'asc' }, { key: 'name', order: 'asc' }, { key: 'rank', order: 'asc' }]))
    await renderAt(`/?sorts=${sorts}&sort=type`)
    press('header')
    await waitFor(() => {
      expect(read('search')).toEqual({
        sorts: [{ key: 'name', order: 'desc' }, { key: 'unit', order: 'asc' }, { key: 'rank', order: 'asc' }],
      })
    })
  })

  it('counts an invalid view, window or filter as absent', async () => {
    await renderAt('/?view=calendar&from=nope&to=2026-12-12&filter=%7B%22where%22%3A1%7D')
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-11-08', '2026-11-14', 'timeline', 'organization'])
    })
  })
})
