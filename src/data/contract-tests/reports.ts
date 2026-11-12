import {
  DeploymentId,
  ReportConfirmationId,
  SoldierId,
  UnitId,
  type AuthIdentity,
  type CalendarDate,
  type OrganizationId,
  type Permission,
  type Timestamp,
} from '@contracts'
import { compareInstants } from '@domain'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, seedActor, valueOf } from './support'

// The daily report workflow (D-293): one confirmation per unit and date, moved on each confirm, read by who views the
// unit, may confirm it, or owns its rotation's report. Sample data, test files only.

const START = '2026-11-01'
const DAY = '2026-11-05'
const OTHER_DAY = '2026-11-06'
const OUTSIDE = '2026-12-15'
const END = '2026-11-30'
const WINDOW = { start_date: START, end_date: END }
// What the confirmer saw: after now in the usual case, so the confirmation holds from now.
const SEEN_LATER: Timestamp = '2026-11-08T11:00:00.000Z'
const SEEN_EARLIER: Timestamp = '2026-11-08T09:00:00.000Z'

const newId = () => ReportConfirmationId.parse(crypto.randomUUID())
const pair = (resource: Permission['resource'], action: Permission['action']) => ({ resource, action }) as Permission
const UNIT_SCOPE = (anchor_unit_id: UnitId) => ({ anchor_type: 'unit', anchor_unit_id, include_descendants: true }) as const

export function describeReportContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{
    input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } };
    owner: AuthIdentity;
  }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('daily report confirmations (D-293)', () => {
    let organization: OrganizationId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    async function unit(name: string, parent_id: UnitId | null = null) {
      return valueOf(
        await adapter().commands.units.create({
          id: UnitId.parse(crypto.randomUUID()),
          parent_id,
          sort_order: 0,
          name,
          code: null,
          unit_level_id: null,
          kind: 'standing',
          valid_from: null,
          valid_to: null,
          color_key: null,
          properties: {},
        }),
      )
    }

    async function rotation(unit_id: UnitId, report_owner_id: SoldierId | null = null) {
      return valueOf(
        await adapter().commands.deployments.create({
          id: DeploymentId.parse(crypto.randomUUID()),
          name: 'Rotation',
          unit_id,
          start_date: START,
          end_date: END,
          report_owner_id,
        }),
      )
    }

    const confirm = (unit_id: UnitId, report_date: CalendarDate, id = newId(), seen_at = SEEN_LATER) =>
      adapter().commands.day_reports.confirm({ id, unit_id, report_date, seen_at })
    const list = async () => valueOf(await adapter().repositories.report_confirmations.list({ window: WINDOW, unit_ids: null }))

    it('confirms a unit under an open rotation, and a second confirm moves the same row', async () => {
      const company = await unit('Company')
      const squad = await unit('Squad', company.id)
      await rotation(company.id)
      const first = valueOf(await confirm(squad.id, DAY))
      expect(first).toMatchObject({ unit_id: squad.id, report_date: DAY, confirmed_by: ownerId })
      const again = valueOf(await confirm(squad.id, DAY))
      expect(again.id).toBe(first.id)
      valueOf(await confirm(squad.id, OTHER_DAY))
      expect((await list()).map((row) => [row.unit_id, row.report_date])).toEqual([
        [squad.id, DAY],
        [squad.id, OTHER_DAY],
      ])
      const filtered = valueOf(
        await adapter().repositories.report_confirmations.list({ window: { start_date: DAY, end_date: DAY }, unit_ids: [squad.id] }),
      )
      expect(filtered.map((row) => row.id)).toEqual([first.id])
    })

    it('refuses a day no rotation runs over the unit, and an id another row holds', async () => {
      const company = await unit('Company')
      expect(issuesOf(await confirm(company.id, DAY))).toEqual([{ path: ['report_date'], code: 'not_reportable' }])
      await rotation(company.id)
      expect(issuesOf(await confirm(company.id, OUTSIDE))).toEqual([{ path: ['report_date'], code: 'not_reportable' }])
      const held = valueOf(await confirm(company.id, DAY))
      expect(issuesOf(await confirm(company.id, OTHER_DAY, held.id))).toEqual([{ path: ['id'], code: 'already_exists' }])
      // A unit and date that already have a row still refuse another row's id.
      const other = valueOf(await confirm(company.id, OTHER_DAY))
      expect(issuesOf(await confirm(company.id, DAY, other.id))).toEqual([{ path: ['id'], code: 'already_exists' }])
      expect((await list()).map((row) => [row.id, row.report_date])).toEqual([
        [held.id, DAY],
        [other.id, OTHER_DAY],
      ])
    })

    it('holds a confirmation from what the confirmer saw, never later than now', async () => {
      const company = await unit('Company')
      await rotation(company.id)
      expect(compareInstants(valueOf(await confirm(company.id, DAY)).confirmed_at, NOW)).toBe(0)
      expect(compareInstants(valueOf(await confirm(company.id, DAY, newId(), SEEN_EARLIER)).confirmed_at, SEEN_EARLIER)).toBe(0)
    })

    it('answers which reports the actor may confirm, through a level the actor does not see', async () => {
      const battalion = await unit('Battalion')
      const company = await unit('Company', battalion.id)
      const squad = await unit('Squad', company.id)
      const other = await unit('Other')
      await rotation(battalion.id)
      const confirmer = await seedActor(harnessOf(), organization, [pair('day_reports', 'confirm')], UNIT_SCOPE(squad.id))
      harnessOf().signIn(confirmer.identity)
      const window = { start_date: DAY, end_date: OTHER_DAY }
      const answer = valueOf(
        await adapter().repositories.report_confirmations.confirmable({ window, unit_ids: [squad.id, company.id, other.id] }),
      )
      expect(answer).toEqual([
        { unit_id: squad.id, report_date: DAY },
        { unit_id: squad.id, report_date: OTHER_DAY },
      ])
      expect(
        valueOf(
          await adapter().repositories.report_confirmations.confirmable({
            window: { start_date: OUTSIDE, end_date: OUTSIDE },
            unit_ids: [squad.id],
          }),
        ),
      ).toEqual([])
      valueOf(await confirm(squad.id, DAY))
    })

    it('names only an active soldier as a report owner', async () => {
      const company = await unit('Company')
      const inactive = valueOf(
        await adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name: 'Noa',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'inactive',
          properties: {},
          private: null,
          membership: null,
        }),
      )
      const refused = await adapter().commands.deployments.create({
        id: DeploymentId.parse(crypto.randomUUID()),
        name: 'Rotation',
        unit_id: company.id,
        start_date: START,
        end_date: END,
        report_owner_id: inactive.id,
      })
      expect(issuesOf(refused)).toEqual([{ path: ['report_owner_id'], code: 'soldier_inactive' }])
    })

    it('refuses a day of a closed rotation', async () => {
      const closedUnit = await unit('Closed')
      const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1, archived_at: null }
      await harnessOf().seed('deployments', [
        {
          id: DeploymentId.parse(crypto.randomUUID()),
          organization_id: organization,
          name: 'Closed',
          unit_id: closedUnit.id,
          start_date: START,
          end_date: OTHER_DAY,
          closed_at: NOW,
          closed_by: ownerId,
          report_owner_id: null,
          ...audit,
        },
      ])
      expect(issuesOf(await confirm(closedUnit.id, DAY))).toEqual([{ path: ['report_date'], code: 'rotation_closed' }])
    })

    it('asks for the confirm permission on the unit, and shows the rows to who may read them', async () => {
      // One rotation runs at a time (D-257): it covers both units.
      const battalion = await unit('Battalion')
      const company = await unit('Company', battalion.id)
      const other = await unit('Other', battalion.id)
      await rotation(battalion.id)
      valueOf(await confirm(company.id, DAY))
      valueOf(await confirm(other.id, DAY))

      const viewer = await seedActor(harnessOf(), organization, [pair('units', 'view')], UNIT_SCOPE(company.id))
      harnessOf().signIn(viewer.identity)
      expect(errorOf(await confirm(company.id, DAY)).code).toBe('forbidden')
      expect((await list()).map((row) => row.unit_id)).toEqual([company.id])

      harnessOf().signIn(owner)
      const confirmer = await seedActor(harnessOf(), organization, [pair('day_reports', 'confirm')], UNIT_SCOPE(other.id))
      harnessOf().signIn(confirmer.identity)
      const moved = valueOf(await confirm(other.id, DAY))
      expect(moved.confirmed_by).toBe(confirmer.soldierId)
      expect((await list()).map((row) => row.unit_id)).toEqual([other.id])
      expect(issuesOf(await confirm(company.id, DAY))).toEqual([{ path: ['unit_id'], code: 'reference_not_found' }])
    })

    it("lets a rotation's report owner read its units' confirmations without other access", async () => {
      const company = await unit('Company')
      const squad = await unit('Squad', company.id)
      const reader = await seedActor(harnessOf(), organization, [], { anchor_type: 'organization' })
      await rotation(company.id, reader.soldierId)
      valueOf(await confirm(squad.id, DAY))
      harnessOf().signIn(reader.identity)
      expect((await list()).map((row) => row.unit_id)).toEqual([squad.id])
      expect(issuesOf(await confirm(squad.id, DAY))).toEqual([{ path: ['unit_id'], code: 'reference_not_found' }])
    })
  })
}
