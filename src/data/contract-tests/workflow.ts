import {
  LeaveCommentId,
  LeaveId,
  LeaveTypeId,
  SoldierId,
  SoldierPreferences,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type DeploymentId,
  type CommentVisibility,
  type CreateLeaveInput,
  type CreateLeaveTypeInput,
  type DataChange,
  type Leave,
  type LeaveEventType,
  type LeaveTransition,
  type OrganizationId,
  type Permission,
  type RuleEnforcement,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import {
  NOW,
  PAST_DATE,
  errorOf,
  issuesOf,
  seedActor,
  seedRotation,
  seedRule as seedSharedRule,
  seedServing,
  valueOf,
} from './support'

// The approval workflow against the shared contract (D-063, D-064, D-117 … D-121): transitions, edits and their
// effect on approval, comments by visibility, the rule gate on a step, and a soldier's own preferences. Sample
// data, test files only.

const TODAY = '2026-11-08'
const TOMORROW = '2026-11-09'
const NEXT_WEEK = '2026-11-15'

const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const VIEW_TYPES: Permission = { resource: 'leave_types', action: 'view' }
const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const CREATE_LEAVES: Permission = { resource: 'leaves', action: 'create' }
const UPDATE_LEAVES: Permission = { resource: 'leaves', action: 'update' }
const CANCEL_LEAVES: Permission = { resource: 'leaves', action: 'delete' }
const APPROVE_LEAVES: Permission = { resource: 'leaves', action: 'approve' }
const VIEW_COMMENTS: Permission = { resource: 'leave_comments', action: 'view' }
const CREATE_COMMENTS: Permission = { resource: 'leave_comments', action: 'create' }
const VIEW_INTERNAL: Permission = { resource: 'internal_comments', action: 'view' }
const CREATE_INTERNAL: Permission = { resource: 'internal_comments', action: 'create' }

const ORGANIZATION = { anchor_type: 'organization' } as const

const newCommentId = () => LeaveCommentId.parse(crypto.randomUUID())

export function describeLeaveWorkflowContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter
  const leaves = () => adapter().commands.leaves
  const comments = () => adapter().commands.leave_comments

  describe('the approval workflow', () => {
    let organization: OrganizationId
    let root: UnitId
    let ownerId: SoldierId
    let owner: AuthIdentity
    let rotation: DeploymentId

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      root = claimed.input.root_unit_id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
      rotation = await seedRotation(harnessOf(), organization, [ownerId])
    })

    /** A second soldier holding exactly `pairs` over the whole organization. */
    async function actorWith(pairs: readonly Permission[]) {
      harnessOf().signIn(owner)
      const actor = await seedActor(harnessOf(), organization, pairs, ORGANIZATION)
      harnessOf().signIn(actor.identity)
      return actor
    }

    /** A soldier who serves in the test's rotation, so a request of theirs has one (D-216). */
    async function soldier(unitId: UnitId | null = null) {
      const created = valueOf(
        await adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership: unitId === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unitId, valid_from: PAST_DATE },
        }),
      )
      await seedServing(harnessOf(), organization, rotation, [created.id])
      return created
    }

    async function createType(overrides: Partial<CreateLeaveTypeInput> = {}) {
      return valueOf(
        await adapter().commands.leave_types.create({
          id: LeaveTypeId.parse(crypto.randomUUID()),
          group_id: null,
          name: 'Home',
          color_key: 'teal',
          icon_key: null,
          availability_effect: 'unavailable',
          requires_reason: false,
          sort_order: 0,
          ...overrides,
        }),
      )
    }

    /** A leave of a new soldier, created by the owner. */
    async function leaveOf(overrides: Partial<CreateLeaveInput> = {}, unitId: UnitId | null = null) {
      const type = overrides.leave_type_id === undefined ? await createType() : null
      const yael = overrides.soldier_id === undefined ? await soldier(unitId) : null
      const input: CreateLeaveInput = {
        id: LeaveId.parse(crypto.randomUUID()),
        soldier_id: yael?.id ?? SoldierId.parse(crypto.randomUUID()),
        leave_type_id: type?.id ?? LeaveTypeId.parse(crypto.randomUUID()),
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
      return valueOf(await leaves().create(input))
    }

    const step = (leave: Leave, transition: LeaveTransition, overrides: { expected_version?: number; comment?: CommentVisibility } = {}) =>
      leaves().transition({
        id: leave.id,
        expected_version: overrides.expected_version ?? leave.version,
        transition,
        acknowledged_rule_ids: [],
        comment: overrides.comment === undefined ? null : { id: newCommentId(), body: 'Why', visibility: overrides.comment },
      })

    const eventsOf = async (leave: Leave) => valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
    /** The suite's clock stands still, so events are found by their type, not by their place. */
    const eventOf = async (leave: Leave, type: LeaveEventType) => (await eventsOf(leave)).find((event) => event.event_type === type)

    async function setReschedulePolicy(reschedule_policy: 'keep_if_can_approve' | 'always_pending') {
      const [stored] = await harnessOf().rows('organizations')
      if (stored === undefined) throw new Error('no organization')
      await harnessOf().seed('organizations', [{ ...stored, settings: { reschedule_policy } }])
    }

    describe('transitions (D-063, D-117)', () => {
      it('approves a pending leave, records the reviewer and the event, and tells the feed', async () => {
        const leave = await leaveOf()
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const approved = valueOf(await step(leave, 'approve'))
        expect(approved).toMatchObject({ status: 'approved', reviewed_by: ownerId, reviewed_at: NOW, version: 2, updated_by: ownerId })
        expect((await heard).map((change) => change.table).sort()).toEqual(['leave_events', 'leaves'])
        expect(await eventsOf(leave)).toHaveLength(2)
        expect(await eventOf(leave, 'approved')).toMatchObject({ from_status: 'pending', to_status: 'approved', actor_id: ownerId, changes: {} })
      })

      it('walks the state machine: reject, reopen, cancel, and the review each keeps or clears', async () => {
        const leave = await leaveOf()
        const rejected = valueOf(await step(leave, 'reject', { comment: 'shared' }))
        expect(rejected).toMatchObject({ status: 'rejected', reviewed_by: ownerId, reviewed_at: NOW })
        expect(await harnessOf().rows('leave_comments')).toMatchObject([{ leave_id: leave.id, body: 'Why', visibility: 'shared' }])

        const reopened = valueOf(await step(rejected, 'reopen'))
        expect(reopened).toMatchObject({ status: 'pending', reviewed_by: null, reviewed_at: null })

        const approved = valueOf(await step(reopened, 'approve'))
        const cancelled = valueOf(await step(approved, 'cancel'))
        expect(cancelled).toMatchObject({ status: 'cancelled', reviewed_by: ownerId, version: 5 })
        expect((await eventsOf(leave)).map((event) => event.event_type).sort()).toEqual([
          'approved',
          'cancelled',
          'created',
          'rejected',
          'reopened',
        ])
      })

      it('refuses a step the status does not allow, and names a cancelled leave archived', async () => {
        const approved = await leaveOf({ as_approved: true })
        expect(issuesOf(await step(approved, 'approve'))).toEqual([{ path: ['transition'], code: 'invalid_transition' }])
        const cancelled = valueOf(await step(approved, 'cancel'))
        expect(issuesOf(await step(cancelled, 'approve'))).toEqual([{ path: ['transition'], code: 'archived' }])
        expect(valueOf(await step(cancelled, 'reopen')).status).toBe('pending')
      })

      it('answers stale_version before the state, and writes nothing', async () => {
        const leave = await leaveOf()
        valueOf(await step(leave, 'approve'))
        // The second tab still holds version 1: its approve is stale, not an invalid step.
        expect(errorOf(await step(leave, 'approve')).code).toBe('stale_version')
        expect(errorOf(await step(leave, 'reject')).code).toBe('stale_version')
        expect(await eventsOf(leave)).toHaveLength(2)
      })

      it('needs the permission of each step over the soldier', async () => {
        const pending = await leaveOf()
        const approved = await leaveOf({ as_approved: true })
        const rejected = valueOf(await step(await leaveOf(), 'reject'))

        await actorWith([VIEW_LEAVES, CREATE_LEAVES])
        expect(errorOf(await step(pending, 'approve')).code).toBe('forbidden')
        expect(errorOf(await step(pending, 'reject')).code).toBe('forbidden')
        expect(errorOf(await step(pending, 'cancel')).code).toBe('forbidden')
        // Undoing an approval is an approver's step; reopening a closed leave is a new request.
        expect(errorOf(await step(approved, 'reopen')).code).toBe('forbidden')
        expect(valueOf(await step(rejected, 'reopen')).status).toBe('pending')

        await actorWith([VIEW_LEAVES, CANCEL_LEAVES])
        expect(valueOf(await step(pending, 'cancel')).status).toBe('cancelled')

        const { soldierId } = await actorWith([VIEW_LEAVES, APPROVE_LEAVES])
        expect(valueOf(await step(approved, 'reopen'))).toMatchObject({ status: 'pending', updated_by: soldierId })
      })

      it('answers not_found for a leave the actor cannot see, and the state for a step that cannot be', async () => {
        const approved = await leaveOf({ as_approved: true })
        await actorWith([APPROVE_LEAVES])
        expect(errorOf(await step(approved, 'reject')).code).toBe('not_found')
        // Whoever sees the leave sees its status, so a step it does not allow reveals nothing (D-117).
        await actorWith([VIEW_LEAVES])
        expect(issuesOf(await step(approved, 'approve'))).toEqual([{ path: ['transition'], code: 'invalid_transition' }])
      })

      it('needs the comment pair to write a comment with a step, and then writes nothing', async () => {
        const leave = await leaveOf()
        await actorWith([VIEW_LEAVES, APPROVE_LEAVES, CREATE_COMMENTS])
        expect(errorOf(await step(leave, 'reject', { comment: 'internal' })).code).toBe('forbidden')
        expect(await harnessOf().rows('leave_comments')).toEqual([])
        expect(valueOf(await adapter().repositories.leaves.get(leave.id)).status).toBe('pending')
        expect(valueOf(await step(leave, 'reject', { comment: 'shared' })).status).toBe('rejected')
      })
    })

    describe('edits and approval (D-064, D-117)', () => {
      it('updates the reason without touching the status, and records before and after', async () => {
        const leave = await leaveOf({ as_approved: true })
        const updated = valueOf(
          await leaves().update({ id: leave.id, expected_version: 1, changes: { reason: ' Wedding ' }, acknowledged_rule_ids: [] }),
        )
        expect(updated).toMatchObject({ reason: ' Wedding ', status: 'approved', reviewed_at: leave.reviewed_at, version: 2 })
        expect(await eventOf(leave, 'updated')).toMatchObject({
          event_type: 'updated',
          from_status: null,
          to_status: null,
          changes: { reason: { before: null, after: ' Wedding ' } },
        })
      })

      it('answers no_changes when nothing differs, a blank reason included (D-101)', async () => {
        const leave = await leaveOf()
        const blank = await leaves().update({ id: leave.id, expected_version: 1, changes: { reason: '   ' }, acknowledged_rule_ids: [] })
        expect(issuesOf(blank)).toEqual([{ path: ['changes'], code: 'no_changes' }])
        const same = await leaves().update({ id: leave.id, expected_version: 1, changes: { start_date: leave.start_date, end_date: leave.end_date }, acknowledged_rule_ids: [] })
        expect(issuesOf(same)).toEqual([{ path: ['changes'], code: 'no_changes' }])
        expect(await eventsOf(leave)).toHaveLength(1)
      })

      it('keeps a moved approved leave approved for who may approve, as its new reviewer', async () => {
        const leave = await leaveOf({ as_approved: true })
        const { soldierId } = await actorWith([VIEW_LEAVES, UPDATE_LEAVES, APPROVE_LEAVES])
        const moved = valueOf(
          await leaves().update({ id: leave.id, expected_version: 1, changes: { start_date: TOMORROW, end_date: NEXT_WEEK }, acknowledged_rule_ids: [] }),
        )
        expect(moved).toMatchObject({ status: 'approved', reviewed_by: soldierId, start_date: TOMORROW, end_date: NEXT_WEEK })
        expect(await eventOf(leave, 'rescheduled')).toMatchObject({
          event_type: 'rescheduled',
          from_status: null,
          to_status: null,
          changes: { start_date: { before: TODAY, after: TOMORROW }, end_date: { before: TOMORROW, after: NEXT_WEEK } },
        })
      })

      it('returns it to pending for who may not approve, and under always_pending for anyone', async () => {
        const first = await leaveOf({ as_approved: true })
        const second = await leaveOf({ as_approved: true })
        await actorWith([VIEW_LEAVES, UPDATE_LEAVES])
        const moved = valueOf(
          await leaves().update({ id: first.id, expected_version: 1, changes: { start_date: TODAY, end_date: NEXT_WEEK }, acknowledged_rule_ids: [] }),
        )
        expect(moved).toMatchObject({ status: 'pending', reviewed_by: null, reviewed_at: null })
        expect(await eventOf(first, 'rescheduled')).toMatchObject({ from_status: 'approved', to_status: 'pending' })

        harnessOf().signIn(owner)
        await setReschedulePolicy('always_pending')
        const byOwner = valueOf(
          await leaves().update({ id: second.id, expected_version: 1, changes: { start_date: TODAY, end_date: NEXT_WEEK }, acknowledged_rule_ids: [] }),
        )
        expect(byOwner.status).toBe('pending')
      })

      it('treats a type change as material, and a reason change as not (D-064)', async () => {
        const other = await createType({ name: 'Course' })
        const leave = await leaveOf({ as_approved: true })
        await setReschedulePolicy('always_pending')
        const reasoned = valueOf(
          await leaves().update({ id: leave.id, expected_version: 1, changes: { reason: 'Note' }, acknowledged_rule_ids: [] }),
        )
        expect(reasoned.status).toBe('approved')
        const retyped = valueOf(
          await leaves().update({ id: leave.id, expected_version: 2, changes: { leave_type_id: other.id }, acknowledged_rule_ids: [] }),
        )
        expect(retyped).toMatchObject({ status: 'pending', leave_type_id: other.id })
      })

      it('checks a new type and the reason it asks for, and leaves an archived type the leave has alone', async () => {
        const archived = await createType({ name: 'Old' })
        valueOf(await adapter().commands.leave_types.archive({ id: archived.id, expected_version: 1 }))
        const strict = await createType({ name: 'Sick', requires_reason: true })
        const leave = await leaveOf()
        const change = (leave_type_id: LeaveTypeId, reason?: string) =>
          leaves().update({
            id: leave.id,
            expected_version: 1,
            changes: reason === undefined ? { leave_type_id } : { leave_type_id, reason },
            acknowledged_rule_ids: [],
          })
        expect(issuesOf(await change(archived.id))).toEqual([{ path: ['changes', 'leave_type_id'], code: 'reference_archived' }])
        expect(issuesOf(await change(LeaveTypeId.parse(crypto.randomUUID())))).toEqual([
          { path: ['changes', 'leave_type_id'], code: 'reference_not_found' },
        ])
        expect(issuesOf(await change(strict.id))).toEqual([{ path: ['changes', 'reason'], code: 'reason_required' }])
        expect(valueOf(await change(strict.id, 'Flu'))).toMatchObject({ leave_type_id: strict.id, reason: 'Flu' })

        // The type is archived after the leave took it: the leave keeps it and can still be edited (D-113).
        valueOf(await adapter().commands.leave_types.archive({ id: strict.id, expected_version: 1 }))
        const edited = await leaves().update({ id: leave.id, expected_version: 2, changes: { reason: 'Fever' }, acknowledged_rule_ids: [] })
        expect(valueOf(edited).reason).toBe('Fever')
        const cleared = await leaves().update({ id: leave.id, expected_version: 3, changes: { reason: null }, acknowledged_rule_ids: [] })
        expect(issuesOf(cleared)).toEqual([{ path: ['changes', 'reason'], code: 'reason_required' }])
      })

      it('edits only pending and approved leaves, with leaves:update, at the stored version', async () => {
        const leave = await leaveOf()
        const move = (expected_version: number) =>
          leaves().update({ id: leave.id, expected_version, changes: { start_date: TODAY, end_date: NEXT_WEEK }, acknowledged_rule_ids: [] })
        expect(errorOf(await move(7)).code).toBe('stale_version')
        const inverted = await leaves().update({ id: leave.id, expected_version: 1, changes: { start_date: TOMORROW, end_date: TODAY }, acknowledged_rule_ids: [] })
        expect(issuesOf(inverted)).toEqual([{ path: ['changes', 'end_date'], code: 'range_inverted' }])

        await actorWith([VIEW_LEAVES, APPROVE_LEAVES])
        expect(errorOf(await move(1)).code).toBe('forbidden')
        await actorWith([UPDATE_LEAVES])
        expect(errorOf(await move(1)).code).toBe('not_found')

        harnessOf().signIn(owner)
        const rejected = valueOf(await step(leave, 'reject'))
        expect(issuesOf(await move(rejected.version))).toEqual([{ path: [], code: 'invalid_transition' }])
        const cancelled = valueOf(await step(valueOf(await step(rejected, 'reopen')), 'cancel'))
        expect(issuesOf(await move(cancelled.version))).toEqual([{ path: [], code: 'archived' }])
      })
    })

    describe('the rule gate on a step (D-073, D-117, OI-027)', () => {
      /** "At least one available in the platoon", counting approved leaves only. The platoon, not the organization:
       * the owner is placed in the root unit (D-251) and stays available. */
      let platoonId: UnitId
      const seedRule = (enforcement: RuleEnforcement) =>
        seedSharedRule(harnessOf(), organization, { enforcement, scope_unit_id: platoonId })

      async function lastSoldierStanding() {
        const platoon = valueOf(
          await adapter().commands.units.create({
            id: UnitId.parse(crypto.randomUUID()),
            parent_id: root,
            sort_order: 0,
            name: 'Platoon',
            code: null,
            unit_level_id: null,
            kind: 'standing',
            valid_from: null,
            valid_to: null,
            color_key: null,
            properties: {},
          }),
        )
        platoonId = platoon.id
        return leaveOf({}, platoon.id)
      }

      it('refuses an approval that breaks a hard rule, and lets a rejection through', async () => {
        const leave = await lastSoldierStanding()
        const ruleId = await seedRule('hard')
        expect(errorOf(await step(leave, 'approve'))).toMatchObject({ code: 'rule_violation', violations: [{ rule_id: ruleId }] })
        expect(valueOf(await adapter().repositories.leaves.get(leave.id)).status).toBe('pending')
        expect(valueOf(await step(leave, 'reject')).status).toBe('rejected')
      })

      it('asks to acknowledge a soft rule, and stores the acknowledgment in the step event', async () => {
        const leave = await lastSoldierStanding()
        const ruleId = await seedRule('soft')
        expect(errorOf(await step(leave, 'approve')).code).toBe('rule_acknowledgment_required')
        const approved = await leaves().transition({
          id: leave.id,
          expected_version: 1,
          transition: 'approve',
          acknowledged_rule_ids: [ruleId],
          comment: null,
        })
        expect(valueOf(approved).status).toBe('approved')
        expect(await eventOf(leave, 'approved')).toMatchObject({ acknowledged_rule_ids: [ruleId] })
      })

      it('gates a move onto days it leaves nobody on', async () => {
        const leave = await lastSoldierStanding()
        const approved = valueOf(await step(leave, 'approve'))
        await seedRule('hard')
        // The days it already covers are no worse; a longer leave is (D-073).
        const longer = await leaves().update({ id: leave.id, expected_version: approved.version, changes: { start_date: TODAY, end_date: NEXT_WEEK }, acknowledged_rule_ids: [] })
        expect(errorOf(longer).code).toBe('rule_violation')
        const shorter = await leaves().update({ id: leave.id, expected_version: approved.version, changes: { start_date: TODAY, end_date: TODAY }, acknowledged_rule_ids: [] })
        expect(valueOf(shorter).end_date).toBe(TODAY)
      })

      it('gates a reopen that counts again (OI-084)', async () => {
        const leave = await lastSoldierStanding()
        const rejected = valueOf(await step(leave, 'reject'))
        const ruleId = await seedSharedRule(harnessOf(), organization, { enforcement: 'hard', count_pending_as_unavailable: true, scope_unit_id: platoonId })
        expect(errorOf(await step(rejected, 'reopen'))).toMatchObject({ code: 'rule_violation', violations: [{ rule_id: ruleId }] })
        expect(valueOf(await adapter().repositories.leaves.get(leave.id)).status).toBe('rejected')
      })

      it('gates an update whose new type makes the soldier absent (OI-084)', async () => {
        const marker = await createType({ name: 'Exam', availability_effect: 'available' })
        const absence = await createType({ name: 'Home' })
        const platoon = valueOf(
          await adapter().commands.units.create({
            id: UnitId.parse(crypto.randomUUID()),
            parent_id: root,
            sort_order: 0,
            name: 'Platoon',
            code: null,
            unit_level_id: null,
            kind: 'standing',
            valid_from: null,
            valid_to: null,
            color_key: null,
            properties: {},
          }),
        )
        platoonId = platoon.id
        const leave = await leaveOf({ as_approved: true, leave_type_id: marker.id, soldier_id: (await soldier(platoon.id)).id })
        const ruleId = await seedRule('soft')
        const retype = (acknowledged_rule_ids: typeof ruleId[]) =>
          leaves().update({ id: leave.id, expected_version: 1, changes: { leave_type_id: absence.id }, acknowledged_rule_ids })
        expect(errorOf(await retype([]))).toMatchObject({ code: 'rule_acknowledgment_required', violations: [{ rule_id: ruleId }] })
        expect(valueOf(await retype([ruleId])).leave_type_id).toBe(absence.id)
        expect(await eventOf(leave, 'updated')).toMatchObject({ acknowledged_rule_ids: [ruleId] })
      })
    })

    describe('one edit command (D-123, OI-076)', () => {
      it('saves the dates and the details of one edit together, as one updated event', async () => {
        const leave = await leaveOf()
        const edited = valueOf(
          await leaves().update({
            id: leave.id,
            expected_version: 1,
            changes: { end_date: NEXT_WEEK, reason: 'Wedding' },
            acknowledged_rule_ids: [],
          }),
        )
        expect(edited).toMatchObject({ end_date: NEXT_WEEK, reason: 'Wedding', version: 2 })
        expect((await eventsOf(leave)).map((event) => event.event_type).sort()).toEqual(['created', 'updated'])
        expect((await eventOf(leave, 'updated'))?.changes).toEqual({
          end_date: { before: TOMORROW, after: NEXT_WEEK },
          reason: { before: null, after: 'Wedding' },
        })
      })

      it('saves nothing of an edit it refuses, the dates included', async () => {
        const strict = await createType({ name: 'Sick', requires_reason: true })
        const leave = await leaveOf()
        const refused = await leaves().update({
          id: leave.id,
          expected_version: 1,
          changes: { end_date: NEXT_WEEK, leave_type_id: strict.id },
          acknowledged_rule_ids: [],
        })
        expect(issuesOf(refused)).toEqual([{ path: ['changes', 'reason'], code: 'reason_required' }])
        expect(valueOf(await adapter().repositories.leaves.get(leave.id))).toMatchObject({ end_date: TOMORROW, version: 1 })
        expect(await eventsOf(leave)).toHaveLength(1)
      })
    })

    describe('a leave of an archived soldier (D-124, OI-077)', () => {
      async function archivedSoldiersLeave() {
        const leave = await leaveOf()
        const stored = valueOf(await adapter().repositories.soldiers.get(leave.soldier_id))
        valueOf(await adapter().commands.soldiers.archive({ id: stored.id, expected_version: stored.version }))
        return leave
      }

      it('can only be cancelled; every other step and an edit answer archived', async () => {
        const leave = await archivedSoldiersLeave()
        expect(issuesOf(await step(leave, 'approve'))).toEqual([{ path: ['transition'], code: 'archived' }])
        expect(issuesOf(await step(leave, 'reject'))).toEqual([{ path: ['transition'], code: 'archived' }])
        const edit = await leaves().update({ id: leave.id, expected_version: 1, changes: { reason: 'x' }, acknowledged_rule_ids: [] })
        expect(issuesOf(edit)).toEqual([{ path: [], code: 'archived' }])
        const cancelled = valueOf(await step(leave, 'cancel'))
        expect(cancelled.status).toBe('cancelled')
        expect(issuesOf(await step(cancelled, 'reopen'))).toEqual([{ path: ['transition'], code: 'archived' }])
        expect(valueOf(await comments().add({ id: newCommentId(), leave_id: leave.id, body: 'Left', visibility: 'shared' })).body).toBe('Left')
      })

      it('checks the permission and the version first', async () => {
        const leave = await archivedSoldiersLeave()
        expect(errorOf(await step(leave, 'approve', { expected_version: 9 })).code).toBe('stale_version')
        await actorWith([VIEW_LEAVES])
        expect(errorOf(await step(leave, 'approve')).code).toBe('forbidden')
      })
    })

    describe('comments (D-118)', () => {
      const add = (leave: Leave, visibility: CommentVisibility, body = 'Note') =>
        comments().add({ id: newCommentId(), leave_id: leave.id, body, visibility })
      const thread = async (leave: Leave) => valueOf(await adapter().repositories.leave_comments.list({ leave_id: leave.id }))

      it('adds shared and internal comments, and lists them oldest first', async () => {
        const leave = await leaveOf()
        const shared = valueOf(await add(leave, 'shared', '  First  '))
        const internal = valueOf(await add(leave, 'internal', 'Second'))
        expect(shared).toMatchObject({ author_id: ownerId, body: 'First', created_at: NOW, edited_at: null, archived_at: null })
        expect((await thread(leave)).map((comment) => comment.id).sort()).toEqual([shared.id, internal.id].sort())
        expect(valueOf(await adapter().repositories.leave_comments.get(internal.id)).visibility).toBe('internal')
        expect(issuesOf(await add(leave, 'shared', '   '))).toEqual([{ path: ['body'], code: 'required' }])
      })

      it('shows each visibility only with its own view pair (D-040)', async () => {
        const leave = await leaveOf()
        const shared = valueOf(await add(leave, 'shared'))
        const internal = valueOf(await add(leave, 'internal'))

        await actorWith([VIEW_LEAVES, VIEW_COMMENTS])
        expect((await thread(leave)).map((comment) => comment.id)).toEqual([shared.id])
        expect(errorOf(await adapter().repositories.leave_comments.get(internal.id)).code).toBe('not_found')

        await actorWith([VIEW_LEAVES, VIEW_INTERNAL])
        expect((await thread(leave)).map((comment) => comment.id)).toEqual([internal.id])

        await actorWith([VIEW_LEAVES])
        expect(await thread(leave)).toEqual([])

        // Without the leave there is no thread at all (D-046).
        await actorWith([VIEW_COMMENTS, CREATE_COMMENTS])
        expect(errorOf(await adapter().repositories.leave_comments.list({ leave_id: leave.id })).code).toBe('not_found')
        expect(errorOf(await add(leave, 'shared')).code).toBe('not_found')
      })

      it('needs the create pair of the visibility it writes', async () => {
        const leave = await leaveOf()
        await actorWith([VIEW_LEAVES, VIEW_COMMENTS, CREATE_COMMENTS])
        expect(valueOf(await add(leave, 'shared')).visibility).toBe('shared')
        expect(errorOf(await add(leave, 'internal')).code).toBe('forbidden')
        await actorWith([VIEW_LEAVES, CREATE_INTERNAL])
        expect(valueOf(await add(leave, 'internal')).visibility).toBe('internal')
        expect(errorOf(await add(leave, 'shared')).code).toBe('forbidden')
      })

      it('takes comments on a closed leave too (D-063)', async () => {
        const cancelled = valueOf(await step(await leaveOf(), 'cancel'))
        expect(valueOf(await add(cancelled, 'shared')).leave_id).toBe(cancelled.id)
      })

      it('lets only the author edit or archive, and an archived comment leaves the thread', async () => {
        const leave = await leaveOf()
        const mine = valueOf(await add(leave, 'shared'))
        const edited = valueOf(await comments().edit({ id: mine.id, body: 'Better' }))
        expect(edited).toMatchObject({ body: 'Better', edited_at: NOW, author_id: ownerId })

        await actorWith([VIEW_LEAVES, VIEW_COMMENTS, CREATE_COMMENTS])
        expect(errorOf(await comments().edit({ id: mine.id, body: 'Theirs' })).code).toBe('forbidden')
        expect(errorOf(await comments().archive({ id: mine.id })).code).toBe('forbidden')
        await actorWith([VIEW_LEAVES])
        expect(errorOf(await comments().archive({ id: mine.id })).code).toBe('not_found')

        harnessOf().signIn(owner)
        expect(valueOf(await comments().archive({ id: mine.id })).archived_at).toBe(NOW)
        expect(await thread(leave)).toEqual([])
        expect(issuesOf(await comments().edit({ id: mine.id, body: 'Late' }))).toEqual([{ path: [], code: 'archived' }])
        expect(issuesOf(await comments().archive({ id: mine.id }))).toEqual([{ path: [], code: 'archived' }])
      })
    })

    describe('reading without a window (D-120)', () => {
      it('lists leaves of any dates, by status', async () => {
        const far = await leaveOf({ start_date: '2027-03-01', end_date: '2027-03-02' })
        const closed = valueOf(await step(await leaveOf(), 'reject'))
        const query = { window: null, soldier_ids: null }
        const pending = valueOf(await adapter().repositories.leaves.list({ ...query, statuses: ['pending'] }))
        expect(pending.map((leave) => leave.id)).toEqual([far.id])
        const done = valueOf(await adapter().repositories.leaves.list({ ...query, statuses: ['rejected', 'cancelled'] }))
        expect(done.map((leave) => leave.id)).toEqual([closed.id])
      })
    })

    describe('my preferences (D-041, D-121)', () => {
      const mine = () => adapter().repositories.soldier_preferences.mine()
      const save = (expected_version: number | null, create_leaves_as_approved: boolean) =>
        adapter().commands.accounts.updateMyPreferences({ expected_version, preferences: SoldierPreferences.parse({ create_leaves_as_approved }) })

      it('has no row until first saved, then keeps a version', async () => {
        expect(valueOf(await mine())).toBeNull()
        const first = valueOf(await save(null, true))
        expect(first).toMatchObject({ soldier_id: ownerId, preferences: { create_leaves_as_approved: true }, version: 1, updated_at: NOW })
        expect(valueOf(await mine())).toEqual(first)
        expect(valueOf(await save(1, false))).toMatchObject({ preferences: { create_leaves_as_approved: false }, version: 2 })
      })

      it('answers stale_version to a save that missed a change', async () => {
        valueOf(await save(null, true))
        expect(errorOf(await save(null, false)).code).toBe('stale_version')
        expect(errorOf(await save(5, false)).code).toBe('stale_version')
        expect(valueOf(await mine())?.version).toBe(1)
      })

      it('is each soldier\'s own row, with no permission needed, and never for a signed-out caller', async () => {
        valueOf(await save(null, true))
        const { soldierId } = await actorWith([])
        expect(valueOf(await mine())).toBeNull()
        expect(valueOf(await save(null, false)).soldier_id).toBe(soldierId)
        expect(await harnessOf().rows('soldier_preferences')).toHaveLength(2)
        harnessOf().signIn(null)
        expect(errorOf(await mine()).code).toBe('unauthenticated')
        expect(errorOf(await save(null, true)).code).toBe('unauthenticated')
      })
    })

    it('keeps the soldiers and types the tests read behind their own pairs', async () => {
      // A guard for the helpers above: an actor with no pair sees neither.
      await leaveOf()
      await actorWith([VIEW_SOLDIERS, VIEW_TYPES])
      expect(valueOf(await adapter().repositories.leaves.list({ window: null, soldier_ids: null, statuses: null }))).toEqual([])
    })
  })
}
