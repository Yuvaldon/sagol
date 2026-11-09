import {
  CommandRankId,
  OrganizationId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type CommandRank,
  type PermissionCheck,
  type Result,
  type Soldier,
  type SoldierPrivate,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useModuleAccess } from '../permissions/hooks'
import type { LogicPorts } from '../ports'
import { LogicProvider } from '../runtime/LogicProvider'
import {
  moveFormIssues,
  newSoldierIssues,
  nextSeniority,
  privateFormIssues,
  rankFormIssues,
  soldierFormIssues,
  toChangeMembershipInput,
  toCreateSoldierInput,
  toUpdatePrivateInput,
  toUpdateRankInput,
  toUpdateSoldierInput,
  type NewSoldierValues,
} from './forms'
import { useToday } from '../session/today'
import { useRosterPermissions, useSoldierPagePermissions } from './hooks'
import { fullName, matchesName, openMembershipOf, soldierHistory, soldierRows } from './roster'

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

function rank(n: number, seniority: number, overrides: Partial<CommandRank> = {}): CommandRank {
  return {
    id: CommandRankId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    title: `R${n}`,
    short_title: null,
    seniority,
    color_key: null,
    ...audit,
    ...overrides,
  }
}

function unit(n: number, overrides: Partial<Unit> = {}): Unit {
  return {
    id: UnitId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name: `U${n}`,
    code: null,
    parent_id: null,
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order: 0,
    properties: {},
    ...audit,
    ...overrides,
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
  }
}

const TODAY = '2026-11-08'

describe('the soldier view model (D-019, D-054)', () => {
  const dana = soldier(1, 'דנה', 'לוי', { command_rank_id: CommandRankId.parse(uuid(50)) })
  const ami = soldier(2, 'עמי', 'אברהם')
  const units = [unit(10), unit(11)]
  const ranks = [rank(50, 5)]

  it('sorts by last name in Hebrew order, then first name', () => {
    const rows = soldierRows([dana, ami, soldier(3, 'אורי', 'לוי')], [], [], [], TODAY)
    expect(rows.map((row) => row.soldier.first_name)).toEqual(['עמי', 'אורי', 'דנה'])
  })

  it('derives rank and today’s unit from the rows', () => {
    const rows = soldierRows([dana], ranks, units, [membership(70, 1, 10, '2026-01-01', '2026-11-07'), membership(71, 1, 11, TODAY, null)], TODAY)
    expect(rows[0]).toMatchObject({ rank: { id: uuid(50) }, unit: { id: uuid(11) }, open: { id: uuid(71) } })
  })

  it('keeps the old unit today when the move starts tomorrow, and names the future row as open (D-097)', () => {
    const rows = soldierRows([dana], ranks, units, [membership(70, 1, 10, '2026-01-01', TODAY), membership(71, 1, 11, '2026-11-09', null)], TODAY)
    expect(rows[0]).toMatchObject({ unit: { id: uuid(10) }, open: { id: uuid(71) } })
  })

  it('shows no unit without a placement, a known unit or today, and still finds the open row', () => {
    const placed = [membership(70, 1, 99, '2026-01-01', null)]
    expect(soldierRows([dana], [], units, placed, TODAY)[0]).toMatchObject({ rank: null, unit: null, open: { id: uuid(70) } })
    expect(soldierRows([dana], [], units, [membership(70, 1, 10, '2026-01-01', null)], null)[0]?.unit).toBeNull()
    expect(soldierRows([ami], [], units, placed, TODAY)[0]?.open).toBeNull()
  })

  it('finds the open row only among primary rows', () => {
    const attached: UnitMembership = { ...membership(70, 1, 10, '2026-01-01', null), membership_type: 'attached' }
    expect(openMembershipOf([attached], dana.id)).toBeNull()
  })

  it('searches first, last and nickname, ignoring niqqud and final letters (D-066, D-094)', () => {
    const nick = soldier(5, 'יוסף', 'כהן', { nickname: 'ג׳ו' })
    expect(matchesName(nick, '')).toBe(true)
    expect(matchesName(nick, '  ')).toBe(true)
    expect(matchesName(nick, 'יוסף')).toBe(true)
    expect(matchesName(nick, 'יוספ')).toBe(true)
    expect(matchesName(nick, 'כהן יוסף')).toBe(true)
    expect(matchesName(nick, 'יוסף כהן')).toBe(true)
    expect(matchesName(nick, 'ג׳ו')).toBe(true)
    expect(matchesName(nick, 'לוי')).toBe(false)
    expect(fullName(nick)).toBe('יוסף כהן')
  })

  it('lists history newest first, naming archived units and hiding what the actor cannot see (D-099)', () => {
    const history = soldierHistory(
      [membership(70, 1, 10, '2026-01-01', '2026-02-01'), membership(71, 1, 11, '2026-02-02', '2026-03-01'), membership(72, 1, 99, '2026-03-02', null), membership(73, 2, 10, '2026-01-01', null)],
      [unit(10), unit(11, { archived_at: AT })],
      dana.id,
    )
    expect(history.map((entry) => entry.unit)).toEqual([
      { kind: 'hidden' },
      { kind: 'archived', name: 'U11' },
      { kind: 'live', name: 'U10' },
    ])
  })
})

describe('rank forms (D-095)', () => {
  const values = { title: 'מ"פ', short_title: '', seniority: '7', color_key: null }

  it('starts one above the most senior', () => {
    expect(nextSeniority([])).toBe(1)
    expect(nextSeniority([rank(1, 3), rank(2, 9)])).toBe(10)
  })

  it('reports the codes the adapter reports (D-068)', () => {
    expect(rankFormIssues(values)).toEqual([])
    expect(rankFormIssues({ ...values, title: ' ' })).toEqual([{ path: ['title'], code: 'required' }])
    expect(rankFormIssues({ ...values, seniority: '' })).toEqual([{ path: ['seniority'], code: 'required' }])
    expect(rankFormIssues({ ...values, seniority: '1.5' })).toEqual([{ path: ['seniority'], code: 'not_integer' }])
    expect(rankFormIssues({ ...values, seniority: 'abc' }).map((issue) => issue.path)).toEqual([['seniority']])
  })

  it('sends only what changed, with the version the form opened at', () => {
    const stored = rank(1, 7, { title: 'מ"פ' })
    expect(toUpdateRankInput(stored, 1, values)).toBeNull()
    expect(toUpdateRankInput(stored, 3, { ...values, seniority: '8', short_title: 'מפ' })).toEqual({
      id: stored.id,
      expected_version: 3,
      changes: { seniority: 8, short_title: 'מפ' },
    })
  })
})

describe('soldier forms', () => {
  const values: NewSoldierValues = {
    first_name: 'דנה',
    last_name: 'לוי',
    nickname: '',
    command_rank_id: null,
    membership: { unit_id: null, valid_from: TODAY },
    private: { personal_id: '', phone: '' },
  }

  it('sends names alone when nothing else is filled in, with a new id each time (D-030, D-044)', () => {
    const input = toCreateSoldierInput(values)
    expect(input).toMatchObject({ nickname: null, status: 'active', private: null, membership: null, properties: {} })
    expect(toCreateSoldierInput(values).id).not.toBe(input.id)
  })

  it('places a soldier and writes private fields only when asked, and has no invite email (D-094)', () => {
    const input = toCreateSoldierInput({
      ...values,
      membership: { unit_id: UnitId.parse(uuid(10)), valid_from: TODAY },
      private: { personal_id: '123', phone: '' },
    })
    expect(input.membership).toMatchObject({ unit_id: uuid(10), valid_from: TODAY })
    expect(input.private).toEqual({ personal_id: '123', invite_email: null, phone: null })
  })

  it('reports field codes at the paths the form names', () => {
    expect(newSoldierIssues(values)).toEqual([])
    expect(newSoldierIssues({ ...values, first_name: '' })).toEqual([{ path: ['first_name'], code: 'required' }])
    const noDate = newSoldierIssues({ ...values, membership: { unit_id: UnitId.parse(uuid(10)), valid_from: '' } })
    expect(noDate.map((issue) => issue.path)).toEqual([['membership', 'valid_from']])
    const long = newSoldierIssues({ ...values, private: { personal_id: 'x'.repeat(51), phone: '' } })
    expect(long).toEqual([{ path: ['private', 'personal_id'], code: 'too_long' }])
  })

  it('checks an edit at the field paths, and sends only what changed', () => {
    const stored = soldier(1, 'דנה', 'לוי')
    const form = { first_name: 'דנה', last_name: 'לוי', nickname: '', command_rank_id: null, status: 'active' as const }
    expect(soldierFormIssues(stored.id, form)).toEqual([])
    expect(soldierFormIssues(stored.id, { ...form, last_name: '' })).toEqual([{ path: ['last_name'], code: 'required' }])
    expect(toUpdateSoldierInput(stored, 1, form)).toBeNull()
    expect(toUpdateSoldierInput(stored, 2, { ...form, status: 'inactive', nickname: 'ד' })).toEqual({
      id: stored.id,
      expected_version: 2,
      changes: { status: 'inactive', nickname: 'ד' },
    })
  })

  it('sends private changes with NULL for an empty field, and NULL version until a row exists', () => {
    const id = SoldierId.parse(uuid(1))
    expect(toUpdatePrivateInput(id, null, { personal_id: '', phone: '' })).toBeNull()
    expect(toUpdatePrivateInput(id, null, { personal_id: '12', phone: '' })).toEqual({
      soldier_id: id,
      expected_version: null,
      changes: { personal_id: '12' },
    })
    const stored: SoldierPrivate = {
      soldier_id: id,
      organization_id: ORGANIZATION,
      personal_id: '12',
      invite_email: null,
      phone: '050',
      updated_at: AT,
      updated_by: null,
      version: 4,
    }
    expect(toUpdatePrivateInput(id, stored, { personal_id: '12', phone: '' })).toEqual({
      soldier_id: id,
      expected_version: 4,
      changes: { phone: null },
    })
    expect(privateFormIssues(id, { personal_id: 'x'.repeat(51), phone: '' })).toEqual([{ path: ['personal_id'], code: 'too_long' }])
  })

  it('builds a move from the open row, and asks for a target when there is none', () => {
    const id = SoldierId.parse(uuid(1))
    const open = membership(70, 1, 10, '2026-01-01', null)
    const moved = toChangeMembershipInput(id, open, { unit_id: UnitId.parse(uuid(11)), effective_date: TODAY })
    expect(moved).toMatchObject({ current_membership: { id: open.id, expected_version: 1 }, new_membership: { unit_id: uuid(11) } })
    expect(toChangeMembershipInput(id, open, { unit_id: null, effective_date: TODAY }).new_membership).toBeNull()
    expect(moveFormIssues(id, null, { unit_id: null, effective_date: TODAY })).toEqual([{ path: ['new_membership'], code: 'required' }])
    expect(moveFormIssues(id, open, { unit_id: null, effective_date: '' }).map((issue) => issue.path)).toEqual([['effective_date']])
  })
})

// ------------------------------------------------------------ hooks over fake ports

function portsWith(allow: (check: PermissionCheck) => boolean, timezone = 'Asia/Jerusalem') {
  return {
    data: {
      session: {
        current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }),
        subscribe: () => () => undefined,
        can: vi.fn((checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(allow) })),
      },
      repositories: { organizations: { current: () => Promise.resolve({ ok: true, value: { timezone } }) } },
      commands: {},
      changes: { subscribe: () => () => undefined },
    },
    auth: {},
    time: { now: () => '2026-11-08T22:30:00.000Z' },
  } as unknown as LogicPorts
}

function wrapperOf(ports: LogicPorts) {
  return ({ children }: { children: ReactNode }) => <LogicProvider ports={ports}>{children}</LogicProvider>
}

describe('roster hints (D-091, D-096)', () => {
  const units = [unit(10), unit(11)]
  const soldiers = [soldier(1, 'דנה', 'לוי')]
  const inUnit = (check: PermissionCheck, unitN: number) =>
    check.target.kind === 'unit' && check.target.unit_id === UnitId.parse(uuid(unitN))

  it('fails closed until the adapter answers', () => {
    const { result } = renderHook(() => useRosterPermissions(soldiers, units), { wrapper: wrapperOf(portsWith(() => true)) })
    expect(result.current.create).toBe(false)
    expect(result.current.update(soldiers[0] as Soldier)).toBe(false)
  })

  it('offers a unit only with soldiers:create and memberships:update on it, and "no unit" only at organization scope', async () => {
    const onlyCreate = portsWith((check) => check.permission.resource === 'soldiers' && inUnit(check, 10))
    const first = renderHook(() => useRosterPermissions(soldiers, units), { wrapper: wrapperOf(onlyCreate) })
    await waitFor(() => {
      expect(onlyCreate.data.session.can).toHaveBeenCalled()
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(first.result.current.create).toBe(false)

    const both = portsWith((check) => inUnit(check, 10))
    const second = renderHook(() => useRosterPermissions(soldiers, units), { wrapper: wrapperOf(both) })
    await waitFor(() => {
      expect(second.result.current.create).toBe(true)
    })
    expect(second.result.current.placeIn(UnitId.parse(uuid(10)))).toBe(true)
    expect(second.result.current.placeIn(UnitId.parse(uuid(11)))).toBe(false)
    expect(second.result.current.createWithoutUnit).toBe(false)
    expect(second.result.current.privateOnCreate(UnitId.parse(uuid(10)))).toBe(true)
    expect(second.result.current.privateOnCreate(null)).toBe(false)
  })

  it('does not offer writing private fields without reading them', async () => {
    const ports = portsWith((check) => check.permission.resource === 'soldier_private' && check.permission.action === 'update')
    const { result } = renderHook(() => useSoldierPagePermissions(soldiers[0] as Soldier, units), { wrapper: wrapperOf(ports) })
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(result.current.viewPrivate).toBe(false)
    expect(result.current.updatePrivate).toBe(false)
  })

  it('asks about the soldier and the destination of a move separately', async () => {
    const ports = portsWith((check) => check.permission.resource === 'memberships' && (check.target.kind === 'soldier' || inUnit(check, 11)))
    const { result } = renderHook(() => useSoldierPagePermissions(soldiers[0] as Soldier, units), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.move).toBe(true)
    })
    expect(result.current.moveTo(UnitId.parse(uuid(11)))).toBe(true)
    expect(result.current.moveTo(UnitId.parse(uuid(10)))).toBe(false)
  })

  it('opens the modules from a view at organization target (D-053)', async () => {
    const ports = portsWith((check) => check.permission.resource === 'soldiers')
    const { result } = renderHook(() => useModuleAccess(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.soldiers).toBe(true)
    })
    expect(result.current.commandRanks).toBe(false)
  })
})

describe('today', () => {
  it('is the date in the organization time zone (D-083)', async () => {
    const { result } = renderHook(() => useToday(), { wrapper: wrapperOf(portsWith(() => true)) })
    expect(result.current).toBeNull()
    await waitFor(() => {
      expect(result.current).toBe('2026-11-09')
    })
  })
})
