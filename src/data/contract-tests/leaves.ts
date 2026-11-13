import {
  DeploymentId,
  LeaveCommentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  SoldierId,
  SoldierTagId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CalendarDate,
  type CreateLeaveInput,
  type CreateLeaveTypeInput,
  type CreateSoldierInput,
  type DataChange,
  type OrganizationId,
  type Permission,
  type PermissionCheck,
  type RuleEnforcement,
  type AvailabilityRuleId,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import {
  NOW,
  errorOf,
  hintAndCommand,
  issuesOf,
  seedActor,
  seedRotation,
  seedRule as seedSharedRule,
  seedServing,
  valueOf,
} from './support'

// Leave types, their groups and creating a leave against the shared contract (D-113, D-114), with the rule gate
// tested on seeded rules long before the rules screen exists (D-076, OI-027). Sample data, test files only.

const TODAY = '2026-11-08'
const TOMORROW = '2026-11-09'
const LAST_WEEK = '2026-11-01'
const NEXT_WEEK = '2026-11-15'
const EARLIER_START = '2025-06-01'
const EARLIER_END = '2025-12-31'

const newTypeId = () => LeaveTypeId.parse(crypto.randomUUID())
const newGroupId = () => LeaveTypeGroupId.parse(crypto.randomUUID())
const newLeaveId = () => LeaveId.parse(crypto.randomUUID())
const newSoldierId = () => SoldierId.parse(crypto.randomUUID())
const newUnitId = () => UnitId.parse(crypto.randomUUID())

function typeInput(overrides: Partial<CreateLeaveTypeInput> = {}): CreateLeaveTypeInput {
  return {
    id: newTypeId(),
    group_id: null,
    name: 'Home',
    color_key: 'teal',
    icon_key: null,
    availability_effect: 'unavailable',
    requires_reason: false,
    sort_order: 0,
    ...overrides,
  }
}

const VIEW_TYPES: Permission = { resource: 'leave_types', action: 'view' }
const CREATE_TYPES: Permission = { resource: 'leave_types', action: 'create' }
const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const CREATE_LEAVES: Permission = { resource: 'leaves', action: 'create' }
const APPROVE_LEAVES: Permission = { resource: 'leaves', action: 'approve' }
const CREATE_COMMENTS: Permission = { resource: 'leave_comments', action: 'create' }
const UPDATE_LEAVES: Permission = { resource: 'leaves', action: 'update' }
const CREATE_INTERNAL: Permission = { resource: 'internal_comments', action: 'create' }

export function describeLeaveContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{
    input: {
      organization: { id: OrganizationId }
      soldier: { id: SoldierId }
      root_unit_id: UnitId
      rotation_group: { id: LeaveTypeGroupId; name: string }
      rotation_type: { id: LeaveTypeId; name: string }
    }
    owner: AuthIdentity
  }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('leaves', () => {
    let organization: OrganizationId
    let root: UnitId
    let ownerId: SoldierId
    let owner: AuthIdentity
    let rotation: DeploymentId
    let rotationGroup: LeaveTypeGroupId
    let rotationType: LeaveTypeId

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      rotationGroup = claimed.input.rotation_group.id
      rotationType = claimed.input.rotation_type.id
      root = claimed.input.root_unit_id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
      rotation = await seedRotation(harnessOf(), organization, [ownerId])
    })

    const actorWith = (pairs: readonly Permission[], scope: Parameters<typeof seedActor>[3], home?: UnitId) =>
      seedActor(harnessOf(), organization, pairs, scope, home)

    async function unit(name: string, parent_id: UnitId | null = root) {
      return valueOf(
        await adapter().commands.units.create({
          id: newUnitId(),
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

    /** A soldier who serves in the test's rotation, so a request of theirs has one (D-216). */
    async function soldier(unitId: UnitId | null, overrides: Partial<CreateSoldierInput> = {}) {
      const created = valueOf(
        await adapter().commands.soldiers.create({
          id: newSoldierId(),
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership:
            unitId === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unitId, valid_from: LAST_WEEK },
          ...overrides,
        }),
      )
      await seedServing(harnessOf(), organization, rotation, [created.id])
      return created
    }

    const createType = async (overrides: Partial<CreateLeaveTypeInput> = {}) =>
      valueOf(await adapter().commands.leave_types.create(typeInput(overrides)))

    function leaveInput(soldier_id: SoldierId, leave_type_id: LeaveTypeId, overrides: Partial<CreateLeaveInput> = {}) {
      const input: CreateLeaveInput = {
        id: newLeaveId(),
        soldier_id,
        leave_type_id,
        deployment_id: rotation,
        start_date: TODAY,
        end_date: TOMORROW,
        availability_effect_override: null,
        reason: null,
        properties: {},
        as_approved: false,
        acknowledged_rule_ids: [],
        comment: null,
        ...overrides,
      }
      return input
    }

    describe('leave type groups and types (D-113)', () => {
      it('creates groups and types, in order, with the defaults of a new type (D-032)', async () => {
        const second = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'Courses', sort_order: 1 }))
        const first = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'Home', sort_order: 0 }))
        const groups = valueOf(await adapter().repositories.leave_type_groups.list({ include_archived: false }))
        expect(groups.filter((group) => !group.is_rotation_leave).map((group) => group.id)).toEqual([first.id, second.id])
        expect([first, second].map((group) => group.is_rotation_leave)).toEqual([false, false])

        const type = await createType({ group_id: first.id, icon_key: 'home' })
        expect(type).toMatchObject({ availability_effect: 'unavailable', requires_reason: false, version: 1, created_by: ownerId })
        expect(valueOf(await adapter().repositories.leave_types.get(type.id))).toEqual(type)
      })

      it('checks the color and the icon against their closed lists (D-074, D-113)', async () => {
        const result = await adapter().commands.leave_types.create(typeInput({ color_key: 'magenta', icon_key: 'rocket' }))
        expect(issuesOf(result)).toEqual([
          { path: ['color_key'], code: 'invalid_value' },
          { path: ['icon_key'], code: 'invalid_value' },
        ])
        const type = await createType({ icon_key: 'exam' })
        const renamed = await adapter().commands.leave_types.update({ id: type.id, expected_version: 1, changes: { icon_key: 'x' } })
        expect(issuesOf(renamed)).toEqual([{ path: ['changes', 'icon_key'], code: 'invalid_value' }])
      })

      it('refuses a group that is unknown or archived, and leaves an unchanged archived one alone', async () => {
        expect(issuesOf(await adapter().commands.leave_types.create(typeInput({ group_id: newGroupId() })))).toEqual([
          { path: ['group_id'], code: 'reference_not_found' },
        ])
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const type = await createType({ group_id: group.id })
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        valueOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leave_types.create(typeInput({ group_id: group.id })))).toEqual([
          { path: ['group_id'], code: 'reference_archived' },
        ])
      })

      it('refuses to archive a group that holds a live type, and allows it once none does', async () => {
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const type = await createType({ group_id: group.id })
        expect(issuesOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'group_in_use' },
        ])
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(valueOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 })).archived_at).toBe(NOW)
      })

      it('reorders types inside their group only', async () => {
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const a = await createType({ group_id: group.id, name: 'A', sort_order: 0 })
        const b = await createType({ group_id: group.id, name: 'B', sort_order: 1 })
        const loose = await createType({ name: 'Loose' })
        const reordered = valueOf(
          await adapter().commands.leave_types.reorder({
            items: [
              { id: b.id, expected_version: 1 },
              { id: a.id, expected_version: 1 },
            ],
          }),
        )
        expect(reordered.map((type) => [type.name, type.sort_order])).toEqual([
          ['B', 0],
          ['A', 1],
        ])
        const mixed = await adapter().commands.leave_types.reorder({
          items: [
            { id: loose.id, expected_version: 1 },
            { id: a.id, expected_version: 2 },
          ],
        })
        expect(issuesOf(mixed)).toEqual([{ path: ['items'], code: 'invalid_order' }])
      })

      it('keeps types behind leave_types, at organization scope only (D-053)', async () => {
        const type = await createType()
        const { identity: nobody } = await actorWith([], { anchor_type: 'organization' })
        harnessOf().signIn(nobody)
        expect(valueOf(await adapter().repositories.leave_types.list({ include_archived: true }))).toEqual([])
        expect(errorOf(await adapter().repositories.leave_types.get(type.id)).code).toBe('not_found')

        harnessOf().signIn(owner)
        const { identity: viewer } = await actorWith([VIEW_TYPES], { anchor_type: 'organization' })
        harnessOf().signIn(viewer)
        expect(errorOf(await adapter().commands.leave_types.create(typeInput())).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 })).code).toBe(
          'forbidden',
        )

        harnessOf().signIn(owner)
        const platoon = await unit('Platoon')
        const { identity: local } = await actorWith([VIEW_TYPES, CREATE_TYPES], { anchor_type: 'unit', anchor_unit_id: platoon.id })
        harnessOf().signIn(local)
        expect(valueOf(await adapter().repositories.leave_types.get(type.id)).id).toBe(type.id)
        expect(errorOf(await adapter().commands.leave_types.create(typeInput())).code).toBe('forbidden')
      })
    })

    describe('the built-in group (D-345, D-347)', () => {
      it('comes with the organization, holding one calm type that asks no reason', async () => {
        const groups = valueOf(await adapter().repositories.leave_type_groups.list({ include_archived: false }))
        expect(groups.filter((group) => group.is_rotation_leave)).toEqual([
          expect.objectContaining({ id: rotationGroup, name: 'Rotation leave', archived_at: null }),
        ])
        expect(valueOf(await adapter().repositories.leave_types.get(rotationType))).toMatchObject({
          group_id: rotationGroup,
          name: 'Rotation leave 1',
          color_key: 'blue',
          availability_effect: 'unavailable',
          requires_reason: false,
        })
      })

      it('refuses to archive the group or its last type, in any order', async () => {
        expect(issuesOf(await adapter().commands.leave_type_groups.archive({ id: rotationGroup, expected_version: 1 }))).toEqual([
          { path: [], code: 'group_builtin' },
        ])
        expect(issuesOf(await adapter().commands.leave_types.archive({ id: rotationType, expected_version: 1 }))).toEqual([
          { path: [], code: 'last_rotation_type' },
        ])
        const second = await createType({ group_id: rotationGroup, name: 'Rotation leave 2', color_key: 'cyan' })
        expect(valueOf(await adapter().commands.leave_types.archive({ id: rotationType, expected_version: 1 })).archived_at).toBe(NOW)
        expect(issuesOf(await adapter().commands.leave_types.archive({ id: second.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'last_rotation_type' },
        ])
      })

      it('fixes what a type of the group is: absent, no reason, a calm color, and no moving in or out', async () => {
        expect(
          issuesOf(
            await adapter().commands.leave_types.create(
              typeInput({ group_id: rotationGroup, availability_effect: 'available', requires_reason: true, color_key: 'red' }),
            ),
          ),
        ).toEqual([
          { path: ['availability_effect'], code: 'fixed_by_group' },
          { path: ['requires_reason'], code: 'fixed_by_group' },
          { path: ['color_key'], code: 'invalid_value' },
        ])
        const loose = await createType()
        expect(issuesOf(await adapter().commands.leave_types.update({ id: loose.id, expected_version: 1, changes: { group_id: rotationGroup } }))).toEqual([
          { path: ['changes', 'group_id'], code: 'fixed_by_group' },
        ])
        expect(issuesOf(await adapter().commands.leave_types.update({ id: rotationType, expected_version: 1, changes: { group_id: null } }))).toEqual([
          { path: ['changes', 'group_id'], code: 'fixed_by_group' },
        ])
        const renamed = valueOf(await adapter().commands.leave_types.update({ id: rotationType, expected_version: 1, changes: { name: 'Weekend', color_key: 'teal' } }))
        expect(renamed).toMatchObject({ name: 'Weekend', color_key: 'teal' })
      })

      it('makes an ordinary group from a command', async () => {
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        expect(group.is_rotation_leave).toBe(false)
        expect(valueOf(await adapter().repositories.leave_type_groups.list({ include_archived: false })).filter((row) => row.is_rotation_leave)).toHaveLength(1)
      })
    })

    describe('creating a leave (D-063, D-114)', () => {
      it('is pending by default, writes its created event, and tells the feed', async () => {
        const type = await createType()
        const platoon = await unit('Platoon')
        const yael = await soldier(platoon.id)
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: '   ' })))
        expect(leave).toMatchObject({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          reason: null,
          batch_id: null,
          version: 1,
          created_by: ownerId,
        })
        expect((await heard).map((change) => change.table).sort()).toEqual(['leave_events', 'leaves'])
        const events = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(events).toMatchObject([
          { event_type: 'created', from_status: null, to_status: 'pending', actor_id: ownerId, acknowledged_rule_ids: [], changes: {} },
        ])
      })

      it('is approved in one step by who may approve, with the actor as reviewer (D-013)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { as_approved: true })))
        expect(leave).toMatchObject({ status: 'approved', reviewed_by: ownerId, reviewed_at: NOW })
        const [event] = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(event?.to_status).toBe('approved')
      })

      it('asks for a reason when the type requires one (D-064)', async () => {
        const type = await createType({ requires_reason: true })
        const yael = await soldier(null)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: ' ' })))).toEqual([
          { path: ['reason'], code: 'reason_required' },
        ])
        expect(valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: 'Wedding' }))).reason).toBe('Wedding')
      })

      it('refuses a type that is unknown or archived, and an archived soldier', async () => {
        const yael = await soldier(null)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, newTypeId())))).toEqual([
          { path: ['leave_type_id'], code: 'reference_not_found' },
        ])
        const type = await createType()
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['leave_type_id'], code: 'reference_archived' },
        ])
        const live = await createType()
        valueOf(await adapter().commands.soldiers.archive({ id: yael.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, live.id)))).toEqual([
          { path: ['soldier_id'], code: 'archived' },
        ])
        expect(await harnessOf().rows('leaves')).toEqual([])
      })

      it('keeps showing a leave whose type was archived later (D-113)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(valueOf(await adapter().repositories.leaves.get(leave.id)).leave_type_id).toBe(type.id)
      })

      it('answers field codes from the schema, and an id that is taken (D-044, D-068)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const inverted = await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: TOMORROW, end_date: TODAY }))
        expect(issuesOf(inverted)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
        const first = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { id: first.id })))).toEqual([
          { path: ['id'], code: 'already_exists' },
        ])
      })

      it('writes a comment with its leave, for who may write one (D-063)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const comment = { id: LeaveCommentId.parse(crypto.randomUUID()), body: 'Family event', visibility: 'shared' as const }
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment })))
        expect(await harnessOf().rows('leave_comments')).toMatchObject([{ id: comment.id, author_id: ownerId, body: 'Family event' }])
      })
    })

    describe('the rotation of a leave (D-216)', () => {
      const newRotationId = () => DeploymentId.parse(crypto.randomUUID())
      const members = (
        soldier_id: SoldierId,
        dates: { start_date: CalendarDate | null; end_date: CalendarDate | null } = { start_date: null, end_date: null },
      ) => [{ soldier_id, ...dates }]

      it('refuses a rotation that is unknown, one the soldier does not serve in, and dates outside their days', async () => {
        const type = await createType()
        const yael = await soldier(null)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { deployment_id: newRotationId() })))).toEqual([
          { path: ['deployment_id'], code: 'reference_not_found' },
        ])
        // A rotation that lists only its owner (D-216).
        valueOf(await adapter().commands.deployments.setMembers({ deployment_id: rotation, expected_version: 1, members: members(ownerId) }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['soldier_id'], code: 'not_a_member' },
        ])
        // One live rotation at a time (D-221): the next one starts once this one is archived.
        valueOf(await adapter().commands.deployments.archive({ id: rotation, expected_version: 2 }))
        const narrow = await seedRotation(harnessOf(), organization, [yael.id], { start_date: TOMORROW, end_date: TOMORROW })
        const wide = leaveInput(yael.id, type.id, { deployment_id: narrow, start_date: TODAY, end_date: NEXT_WEEK })
        expect(issuesOf(await adapter().commands.leaves.create(wide))).toEqual([
          { path: ['start_date'], code: 'outside_rotation' },
          { path: ['end_date'], code: 'outside_rotation' },
        ])
        expect(await harnessOf().rows('leaves')).toEqual([])
      })

      it('holds a member’s own dates, and checks an edit of the dates', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const narrowed = { start_date: TODAY, end_date: TOMORROW }
        valueOf(await adapter().commands.deployments.setMembers({ deployment_id: rotation, expected_version: 1, members: members(yael.id, narrowed) }))
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        const longer = { id: leave.id, expected_version: 1, changes: { end_date: NEXT_WEEK }, acknowledged_rule_ids: [] }
        expect(issuesOf(await adapter().commands.leaves.update(longer))).toEqual([{ path: ['changes', 'end_date'], code: 'outside_rotation' }])
      })

      it('takes no new request in an archived rotation, and keeps the ones it holds', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        valueOf(await adapter().commands.deployments.archive({ id: rotation, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['deployment_id'], code: 'reference_archived' },
        ])
        const approve = { id: leave.id, expected_version: 1, transition: 'approve' as const, acknowledged_rule_ids: [], comment: null }
        expect(valueOf(await adapter().commands.leaves.transition(approve)).status).toBe('approved')
      })

      it('refuses a member or rotation change that strands a live request, not a closed one', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        const narrowed = { start_date: null, end_date: TODAY }
        expect(
          issuesOf(await adapter().commands.deployments.setMembers({ deployment_id: rotation, expected_version: 1, members: members(yael.id, narrowed) })),
        ).toEqual([{ path: ['members', 0], code: 'leaves_outside_rotation' }])
        const kept = members(ownerId)
        expect(issuesOf(await adapter().commands.deployments.setMembers({ deployment_id: rotation, expected_version: 1, members: kept }))).toEqual([
          { path: ['members'], code: 'leaves_outside_rotation' },
        ])
        const move = { id: rotation, expected_version: 1, changes: { start_date: TOMORROW } }
        expect(issuesOf(await adapter().commands.deployments.update(move))).toEqual([{ path: ['changes', 'start_date'], code: 'leaves_outside_rotation' }])

        const cancel = { id: leave.id, expected_version: 1, transition: 'cancel' as const, acknowledged_rule_ids: [], comment: null }
        valueOf(await adapter().commands.leaves.transition(cancel))
        valueOf(await adapter().commands.deployments.setMembers({ deployment_id: rotation, expected_version: 1, members: kept }))
        const reopen = { id: leave.id, expected_version: 2, transition: 'reopen' as const, acknowledged_rule_ids: [], comment: null }
        expect(issuesOf(await adapter().commands.leaves.transition(reopen))).toEqual([{ path: ['soldier_id'], code: 'not_a_member' }])
      })

      it('lets a soldier read the rotations they serve in and their own membership (D-218)', async () => {
        const home = await unit('Home')
        const { identity, soldierId } = await actorWith([VIEW_LEAVES], { anchor_type: 'self' }, home.id)
        await seedServing(harnessOf(), organization, rotation, [soldierId])
        // An earlier rotation, before this one (D-221).
        await seedRotation(harnessOf(), organization, [], { start_date: EARLIER_START, end_date: EARLIER_END })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.deployments.list({ include_archived: false })).map((row) => row.id)).toEqual([rotation])
        const own = valueOf(await adapter().repositories.deployment_members.list({ deployment_ids: null }))
        expect(own.map((row) => row.soldier_id)).toEqual([soldierId])
      })
    })

    describe('permissions of a leave (D-114)', () => {
      async function platoons() {
        const company = await unit('Company')
        return { platoonA: await unit('Platoon A', company.id), platoonB: await unit('Platoon B', company.id) }
      }

      it('needs leaves:create over the soldier, and leaves:approve to approve now', async () => {
        const type = await createType()
        const { platoonA, platoonB } = await platoons()
        const inA = await soldier(platoonA.id)
        const inB = await soldier(platoonB.id)
        const { identity } = await actorWith(
          [VIEW_SOLDIERS, VIEW_LEAVES, CREATE_LEAVES, VIEW_TYPES],
          { anchor_type: 'unit', anchor_unit_id: platoonA.id },
        )
        harnessOf().signIn(identity)
        valueOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id)))
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id, { as_approved: true }))).code).toBe(
          'forbidden',
        )
        // A soldier the actor cannot see answers not_found, not forbidden (D-046).
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(inB.id, type.id))).code).toBe('not_found')
        expect((await harnessOf().rows('leaves')).length).toBe(1)
      })

      it('answers forbidden to who sees the soldier but may not create a leave, before the state of the type', async () => {
        const type = await createType()
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        const yael = await soldier(null)
        const { identity } = await actorWith([VIEW_SOLDIERS, VIEW_TYPES], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id))).code).toBe('forbidden')
      })

      it('approves in one step with both pairs', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const { identity, soldierId } = await actorWith(
          [VIEW_SOLDIERS, CREATE_LEAVES, APPROVE_LEAVES, VIEW_TYPES],
          { anchor_type: 'organization' },
        )
        harnessOf().signIn(identity)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { as_approved: true })))
        expect(leave).toMatchObject({ status: 'approved', reviewed_by: soldierId })
      })

      it('needs the comment pair to write a comment, and then writes nothing', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const pairs = [VIEW_SOLDIERS, CREATE_LEAVES, VIEW_TYPES]
        const { identity } = await actorWith(pairs, { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        const comment = { id: LeaveCommentId.parse(crypto.randomUUID()), body: 'Note', visibility: 'shared' as const }
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment }))).code).toBe('forbidden')
        expect(await harnessOf().rows('leaves')).toEqual([])

        harnessOf().signIn(owner)
        const { identity: writer } = await actorWith([...pairs, CREATE_COMMENTS], { anchor_type: 'organization' })
        harnessOf().signIn(writer)
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment })))
      })

      it('needs leave_types:view to point at a type (D-046)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const { identity } = await actorWith([VIEW_SOLDIERS, CREATE_LEAVES], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['leave_type_id'], code: 'reference_not_found' },
        ])
      })
    })

    describe('reading leaves', () => {
      it('lists the leaves that overlap the window, by soldier and status', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const dan = await soldier(null, { first_name: 'Dan' })
        const before = valueOf(
          await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: LAST_WEEK, end_date: LAST_WEEK })),
        )
        const across = valueOf(
          await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: LAST_WEEK, end_date: TODAY })),
        )
        const approved = valueOf(
          await adapter().commands.leaves.create(leaveInput(dan.id, type.id, { start_date: NEXT_WEEK, end_date: NEXT_WEEK, as_approved: true })),
        )
        const window = { start_date: TODAY, end_date: NEXT_WEEK }
        const all = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: null }))
        expect(all.map((leave) => leave.id)).toEqual([across.id, approved.id])
        const onlyApproved = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: ['approved'] }))
        expect(onlyApproved.map((leave) => leave.id)).toEqual([approved.id])
        const ofYael = valueOf(
          await adapter().repositories.leaves.list({ window: { start_date: LAST_WEEK, end_date: NEXT_WEEK }, soldier_ids: [yael.id], statuses: null }),
        )
        expect(ofYael.map((leave) => leave.id).sort()).toEqual([before.id, across.id].sort())
      })

      it('shows a leave and its events only with leaves:view over its soldier (D-046)', async () => {
        const type = await createType()
        const platoonA = await unit('Platoon A')
        const platoonB = await unit('Platoon B')
        const inA = await soldier(platoonA.id)
        const inB = await soldier(platoonB.id)
        const seen = valueOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id)))
        const hidden = valueOf(await adapter().commands.leaves.create(leaveInput(inB.id, type.id)))
        const { identity } = await actorWith([VIEW_LEAVES], { anchor_type: 'unit', anchor_unit_id: platoonA.id })
        harnessOf().signIn(identity)
        const window = { start_date: TODAY, end_date: TOMORROW }
        const listed = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: null }))
        expect(listed.map((leave) => leave.id)).toEqual([seen.id])
        expect(errorOf(await adapter().repositories.leaves.get(hidden.id)).code).toBe('not_found')
        expect(errorOf(await adapter().repositories.leave_events.list({ leave_id: hidden.id })).code).toBe('not_found')
        expect(valueOf(await adapter().repositories.leave_events.list({ leave_id: seen.id }))).toHaveLength(1)
      })

      it("reads a rotation's span of events, only of leaves the actor reads (D-358)", async () => {
        const type = await createType()
        const platoonA = await unit('Platoon A')
        const platoonB = await unit('Platoon B')
        const inA = await soldier(platoonA.id)
        const alsoA = await soldier(platoonA.id)
        const inB = await soldier(platoonB.id)
        const seen = valueOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id)))
        valueOf(await adapter().commands.leaves.create(leaveInput(alsoA.id, type.id)))
        valueOf(await adapter().commands.leaves.create(leaveInput(inB.id, type.id)))
        const { identity } = await actorWith([VIEW_LEAVES], { anchor_type: 'unit', anchor_unit_id: platoonA.id })
        harnessOf().signIn(identity)
        const span = await adapter().repositories.leave_events.list({ deployment_id: rotation, soldier_ids: [inA.id, inB.id] })
        expect(valueOf(span).map((event) => event.leave_id)).toEqual([seen.id])
        expect(valueOf(await adapter().repositories.leave_events.list({ deployment_id: DeploymentId.parse(crypto.randomUUID()), soldier_ids: [inA.id] }))).toEqual([])
      })
    })

    describe('the rule gate (D-047, D-073, OI-027)', () => {
      /** "At least one available in the organization", counting pending leaves. */
      // The rule counts the platoon, not the organization: the owner is placed in the root unit (D-251).
      let platoonId: UnitId
      const seedRule = (enforcement: RuleEnforcement) =>
        seedSharedRule(harnessOf(), organization, { enforcement, count_pending_as_unavailable: true, scope_unit_id: platoonId })

      async function lastSoldierStanding() {
        const type = await createType()
        const platoon = await unit('Platoon')
        platoonId = platoon.id
        return { type, yael: await soldier(platoon.id) }
      }

      it('refuses what breaks a hard rule, and writes nothing', async () => {
        const { type, yael } = await lastSoldierStanding()
        const ruleId = await seedRule('hard')
        const refused = errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { acknowledged_rule_ids: [ruleId] })))
        expect(refused).toMatchObject({ code: 'rule_violation', violations: [{ rule_id: ruleId, enforcement: 'hard', bound: 'min' }] })
        expect(await harnessOf().rows('leaves')).toEqual([])
        expect(await harnessOf().rows('leave_events')).toEqual([])
      })

      it('asks to acknowledge a soft rule, then stores the acknowledgment in the event', async () => {
        const { type, yael } = await lastSoldierStanding()
        const ruleId = await seedRule('soft')
        const asked = errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        expect(asked).toMatchObject({
          code: 'rule_acknowledgment_required',
          violations: [{ rule_id: ruleId, days: [{ date: TODAY, required: 1, actual: 0 }, { date: TOMORROW, required: 1, actual: 0 }] }],
        })
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { acknowledged_rule_ids: [ruleId] })))
        const [event] = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(event?.acknowledged_rule_ids).toEqual([ruleId])
      })

      it('judges a sheet of leaves together, then writes a created event for each (D-275, OI-252)', async () => {
        const { type, yael } = await lastSoldierStanding()
        const ruleId = await seedRule('soft')
        const row = (start_date: string, end_date: string) => {
          const { soldier_id: _soldier, as_approved: _approved, acknowledged_rule_ids: _rules, comment: _comment, ...leave } =
            leaveInput(yael.id, type.id, { start_date, end_date })
          return leave
        }
        const sheet = (acknowledged_rule_ids: AvailabilityRuleId[]) =>
          adapter().commands.leaves.createMany({
            soldier_id: yael.id,
            leaves: [row(TODAY, TODAY), row(NEXT_WEEK, NEXT_WEEK)],
            as_approved: false,
            acknowledged_rule_ids,
          })
        // One violation names the days of both rows: the rule reads the sheet as a whole.
        expect(errorOf(await sheet([]))).toMatchObject({
          code: 'rule_acknowledgment_required',
          violations: [{ rule_id: ruleId, days: [{ date: TODAY }, { date: NEXT_WEEK }] }],
        })
        expect(await harnessOf().rows('leaves')).toEqual([])
        const created = valueOf(await sheet([ruleId]))
        for (const leave of created) {
          expect(valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))).toMatchObject([
            { event_type: 'created', from_status: null, to_status: 'pending', acknowledged_rule_ids: [ruleId] },
          ])
        }
        expect(await harnessOf().rows('leave_events')).toHaveLength(2)
      })

      it('names who is unavailable each day, a soldier the actor cannot see included (D-138, OI-075)', async () => {
        const type = await createType()
        const company = await unit('Company')
        const platoonA = await unit('A', company.id)
        const platoonB = await unit('B', company.id)
        const yael = await soldier(platoonA.id)
        const hidden = await soldier(platoonB.id, { first_name: 'Omer', last_name: 'Tal' })
        valueOf(await adapter().commands.leaves.create(leaveInput(hidden.id, type.id, { as_approved: true })))
        const ruleId = await seedSharedRule(harnessOf(), organization, {
          min_value: 2,
          count_pending_as_unavailable: true,
          scope_unit_id: company.id,
        })
        const { identity } = await actorWith([VIEW_SOLDIERS, VIEW_TYPES, CREATE_LEAVES], {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
        })
        harnessOf().signIn(identity)
        const asked = errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        const unavailable = [
          { id: yael.id, first_name: 'Yael', last_name: 'Bar' },
          { id: hidden.id, first_name: 'Omer', last_name: 'Tal' },
        ].sort((a, b) => (a.id < b.id ? -1 : 1))
        expect(asked).toMatchObject({
          code: 'rule_acknowledgment_required',
          violations: [{ rule_id: ruleId, days: [{ date: TODAY, required: 2, actual: 0, unavailable }, { date: TOMORROW, unavailable }] }],
        })
      })

      it('counts the tags a soldier holds in the rotation of the leave, not in another (D-260, D-222)', async () => {
        const { type, yael } = await lastSoldierStanding()
        const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1, archived_at: null }
        const categoryId = TagCategoryId.parse(crypto.randomUUID())
        const tagId = TagId.parse(crypto.randomUUID())
        await harnessOf().seed('tag_categories', [
          { id: categoryId, organization_id: organization, name: 'Role', selection_mode: 'multiple', default_lifetime: 'rotation', color_key: 'teal', sort_order: 0, ...audit },
        ])
        await harnessOf().seed('tags', [
          { id: tagId, organization_id: organization, category_id: categoryId, name: 'Driver', color_key: null, sort_order: 0, ...audit },
        ])
        const earlier = await seedRotation(harnessOf(), organization, [], { start_date: '2025-06-01', end_date: '2025-06-30' })
        const holds = (deployment_id: DeploymentId) => ({
          id: SoldierTagId.parse(crypto.randomUUID()),
          organization_id: organization,
          soldier_id: yael.id,
          tag_id: tagId,
          deployment_id,
          created_at: NOW,
          created_by: null,
        })
        await harnessOf().seed('soldier_tags', [holds(earlier)])
        const ruleId = await seedSharedRule(harnessOf(), organization, {
          enforcement: 'hard',
          count_pending_as_unavailable: true,
          population_filter: { where: { kind: 'tag', match: 'any', tag_ids: [tagId] } },
        })
        // A driver of the earlier rotation only: nobody this rotation counts, so the leave makes nothing worse.
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: NEXT_WEEK, end_date: NEXT_WEEK })))
        await harnessOf().seed('soldier_tags', [holds(rotation)])
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toMatchObject({
          code: 'rule_violation',
          violations: [{ rule_id: ruleId }],
        })
      })

      it('lets a marker through, because the soldier stays available (D-032)', async () => {
        const { yael } = await lastSoldierStanding()
        await seedRule('hard')
        const marker = await createType({ availability_effect: 'available' })
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, marker.id)))
      })
    })

    describe('the can hint agrees with the commands (D-091, D-114, OI-049)', () => {
      const ALL_PAIRS = [VIEW_SOLDIERS, VIEW_TYPES, VIEW_LEAVES, CREATE_LEAVES, UPDATE_LEAVES, APPROVE_LEAVES, CREATE_COMMENTS]
      const on = (soldier_id: SoldierId, ...permissions: Permission[]): PermissionCheck[] =>
        permissions.map((permission) => ({ permission, target: { kind: 'soldier', soldier_id } }))
      let typeId: LeaveTypeId
      let inA: SoldierId
      let inB: SoldierId
      let actor: AuthIdentity

      /** The actor holds `pairs` on platoon A only, and nothing on platoon B. */
      async function signInOnPlatoonA(pairs: readonly Permission[] = ALL_PAIRS) {
        harnessOf().signIn(owner)
        const company = await unit('Company')
        const platoonA = await unit('Platoon A', company.id)
        const platoonB = await unit('Platoon B', company.id)
        inA = (await soldier(platoonA.id)).id
        inB = (await soldier(platoonB.id)).id
        actor = (await actorWith(pairs, { anchor_type: 'unit', anchor_unit_id: platoonA.id })).identity
        harnessOf().signIn(actor)
      }

      /** A pending leave of the soldier, created by the owner. */
      async function pendingOf(soldier_id: SoldierId) {
        harnessOf().signIn(owner)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(soldier_id, typeId)))
        harnessOf().signIn(actor)
        return leave
      }

      beforeEach(async () => {
        typeId = (await createType()).id
      })

      it('creates a leave, and approves it in one step, where the pairs hold on the soldier', async () => {
        await signInOnPlatoonA()
        const create = (soldier_id: SoldierId, as_approved = false) => () =>
          adapter().commands.leaves.create(leaveInput(soldier_id, typeId, { as_approved }))
        expect(await hintAndCommand(harnessOf(), on(inA, CREATE_LEAVES), create(inA))).toEqual([true])
        expect(await hintAndCommand(harnessOf(), on(inB, CREATE_LEAVES), create(inB))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), on(inA, CREATE_LEAVES, APPROVE_LEAVES), create(inA, true))).toEqual([true, true])

        await signInOnPlatoonA([VIEW_SOLDIERS, VIEW_TYPES, CREATE_LEAVES])
        expect(await hintAndCommand(harnessOf(), on(inA, CREATE_LEAVES, APPROVE_LEAVES), create(inA, true))).toEqual([true, false])
      })

      it('edits and approves a leave where leaves:update and leaves:approve hold on its soldier', async () => {
        const edit = (id: LeaveId) => () =>
          adapter().commands.leaves.update({ id, expected_version: 1, changes: { end_date: NEXT_WEEK }, acknowledged_rule_ids: [] })
        const approve = (id: LeaveId) => () =>
          adapter().commands.leaves.transition({ id, expected_version: 1, transition: 'approve', acknowledged_rule_ids: [], comment: null })

        await signInOnPlatoonA([VIEW_SOLDIERS, VIEW_TYPES, VIEW_LEAVES, CREATE_LEAVES])
        const held = await pendingOf(inA)
        expect(await hintAndCommand(harnessOf(), on(inA, UPDATE_LEAVES), edit(held.id))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), on(inA, APPROVE_LEAVES), approve(held.id))).toEqual([false])

        await signInOnPlatoonA()
        const mine = await pendingOf(inA)
        const foreign = await pendingOf(inB)
        expect(await hintAndCommand(harnessOf(), on(inB, UPDATE_LEAVES), edit(foreign.id))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), on(inB, APPROVE_LEAVES), approve(foreign.id))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), on(inA, APPROVE_LEAVES), approve(mine.id))).toEqual([true])
        const other = await pendingOf(inA)
        expect(await hintAndCommand(harnessOf(), on(inA, UPDATE_LEAVES), edit(other.id))).toEqual([true])
      })

      it('adds a comment where the create pair of its visibility holds on the soldier (D-118)', async () => {
        const add = (leave_id: LeaveId, visibility: 'shared' | 'internal') => () =>
          adapter().commands.leave_comments.add({ id: LeaveCommentId.parse(crypto.randomUUID()), leave_id, body: 'Note', visibility })
        await signInOnPlatoonA()
        const mine = await pendingOf(inA)
        const foreign = await pendingOf(inB)
        expect(await hintAndCommand(harnessOf(), on(inA, CREATE_COMMENTS), add(mine.id, 'shared'))).toEqual([true])
        expect(await hintAndCommand(harnessOf(), on(inA, CREATE_INTERNAL), add(mine.id, 'internal'))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), on(inB, CREATE_COMMENTS), add(foreign.id, 'shared'))).toEqual([false])
      })
    })
  })
}
