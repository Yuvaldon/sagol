import {
  DeploymentId,
  LeaveBatchId,
  LeaveId,
  LeaveTypeId,
  SeniorityOverrideId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CreateDeploymentInput,
  type CreateLeaveInput,
  type CreateSeniorityOverrideInput,
  type OrganizationId,
  type Permission,
} from "@contracts";
import { LEAVE_SHEET } from "@config";
import { beforeEach, describe, expect, it } from "vitest";
import type { ContractHarness } from "./harness";
import {
  NOW,
  errorOf,
  issuesOf,
  seedActor,
  seedRotation,
  seedServing,
  valueOf,
} from "./support";

// Deployments and their members, personal seniority, leaves created together and copies of a leave (D-012, D-019,
// D-029, D-049, D-179). Sample data, test files only.

const LAST_WEEK = "2026-11-01";
const YESTERDAY = "2026-11-07";
const TODAY = "2026-11-08";
const TOMORROW = "2026-11-09";
const MID_MONTH = "2026-11-15";
const MONTH_END = "2026-11-30";
const EARLIER_START = "2025-06-01";
const EARLIER_END = "2025-06-10";
const BEFORE_NARROW = "2025-07-01";
const NARROW_DAY = "2025-07-02";
const ELSEWHERE_DAY = "2025-08-01";
const NEXT_MONTH = "2026-12-01";

const newDeploymentId = () => DeploymentId.parse(crypto.randomUUID());
const newOverrideId = () => SeniorityOverrideId.parse(crypto.randomUUID());
const newLeaveId = () => LeaveId.parse(crypto.randomUUID());
const newBatchId = () => LeaveBatchId.parse(crypto.randomUUID());

const pair = (resource: Permission["resource"], action: Permission["action"]) =>
  ({ resource, action }) as Permission;

export function describeDeploymentContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{
    input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId };
    owner: AuthIdentity;
  }>,
): void {
  const adapter = () => harnessOf().adapter;

  describe("deployments, seniority and leaves together", () => {
    let organization: OrganizationId;
    let root: UnitId;
    let ownerId: SoldierId;
    let owner: AuthIdentity;

    beforeEach(async () => {
      const claimed = await claim();
      organization = claimed.input.organization.id;
      root = claimed.input.root_unit_id;
      ownerId = claimed.input.soldier.id;
      owner = claimed.owner;
    });

    async function unit(name: string) {
      return valueOf(
        await adapter().commands.units.create({
          id: UnitId.parse(crypto.randomUUID()),
          parent_id: root,
          sort_order: 0,
          name,
          code: null,
          unit_level_id: null,
          kind: "standing",
          valid_from: null,
          valid_to: null,
          color_key: null,
          properties: {},
        }),
      );
    }

    async function soldier(unitId: UnitId | null, first_name = "Yael") {
      return valueOf(
        await adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name,
          last_name: "Bar",
          nickname: null,
          command_rank_id: null,
          status: "active",
          properties: {},
          private: null,
          membership:
            unitId === null
              ? null
              : {
                  id: UnitMembershipId.parse(crypto.randomUUID()),
                  unit_id: unitId,
                  valid_from: LAST_WEEK,
                },
        }),
      );
    }

    function deploymentInput(
      unit_id: UnitId,
      overrides: Partial<CreateDeploymentInput> = {},
    ): CreateDeploymentInput {
      return {
        id: newDeploymentId(),
        name: "Winter",
        unit_id,
        start_date: LAST_WEEK,
        end_date: MONTH_END,
        ...overrides,
      };
    }

    describe("deployments (D-019, D-179)", () => {
      it("creates, lists latest first, and refuses a unit that is unknown or archived", async () => {
        const company = await unit("Company");
        const early = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id, { name: "Early", end_date: YESTERDAY }),
          ),
        );
        const late = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id, { name: "Late", start_date: TODAY }),
          ),
        );
        expect(early).toMatchObject({
          version: 1,
          created_by: ownerId,
          organization_id: organization,
        });
        const listed = valueOf(
          await adapter().repositories.deployments.list({
            include_archived: false,
          }),
        );
        expect(listed.map((row) => row.id)).toEqual([late.id, early.id]);

        const unknown = await adapter().commands.deployments.create(
          deploymentInput(UnitId.parse(crypto.randomUUID()), { start_date: NEXT_MONTH, end_date: null }),
        );
        expect(issuesOf(unknown)).toEqual([
          { path: ["unit_id"], code: "reference_not_found" },
        ]);
        const gone = await unit("Gone");
        valueOf(
          await adapter().commands.units.archive({
            id: gone.id,
            expected_version: 1,
          }),
        );
        expect(
          issuesOf(
            await adapter().commands.deployments.create(
              deploymentInput(gone.id, { start_date: NEXT_MONTH, end_date: null }),
            ),
          ),
        ).toEqual([{ path: ["unit_id"], code: "reference_archived" }]);
      });

      it("replaces the member set under the version, and checks each member", async () => {
        const company = await unit("Company");
        const deployment = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id),
          ),
        );
        const first = await soldier(company.id, "Avi");
        const second = await soldier(company.id, "Ben");

        const members = valueOf(
          await adapter().commands.deployments.setMembers({
            deployment_id: deployment.id,
            expected_version: 1,
            members: [
              { soldier_id: first.id, start_date: null, end_date: null },
              { soldier_id: second.id, start_date: TODAY, end_date: MID_MONTH },
            ],
          }),
        );
        expect(members).toHaveLength(2);
        expect(
          members.find((member) => member.soldier_id === second.id),
        ).toMatchObject({
          deployment_id: deployment.id,
          start_date: TODAY,
          end_date: MID_MONTH,
          created_at: NOW,
          created_by: ownerId,
        });
        expect(
          valueOf(await adapter().repositories.deployments.get(deployment.id))
            .version,
        ).toBe(2);

        expect(
          errorOf(
            await adapter().commands.deployments.setMembers({
              deployment_id: deployment.id,
              expected_version: 1,
              members: [],
            }),
          ).code,
        ).toBe("stale_version");

        const outside = await adapter().commands.deployments.setMembers({
          deployment_id: deployment.id,
          expected_version: 2,
          members: [
            { soldier_id: first.id, start_date: "2026-10-01", end_date: null },
            {
              soldier_id: SoldierId.parse(crypto.randomUUID()),
              start_date: null,
              end_date: null,
            },
          ],
        });
        expect(issuesOf(outside)).toEqual([
          { path: ["members", 0, "start_date"], code: "invalid_value" },
          { path: ["members", 1, "soldier_id"], code: "reference_not_found" },
        ]);

        const kept = valueOf(
          await adapter().commands.deployments.setMembers({
            deployment_id: deployment.id,
            expected_version: 2,
            members: [
              { soldier_id: second.id, start_date: null, end_date: null },
            ],
          }),
        );
        expect(kept.map((member) => member.soldier_id)).toEqual([second.id]);
        expect(kept[0]).toMatchObject({ start_date: null, end_date: null });
        const listed = valueOf(
          await adapter().repositories.deployment_members.list({
            deployment_ids: [deployment.id],
          }),
        );
        expect(listed.map((member) => member.soldier_id)).toEqual([second.id]);
      });

      it("refuses new dates that would leave a member's own dates outside", async () => {
        const company = await unit("Company");
        const deployment = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id),
          ),
        );
        const member = await soldier(company.id);
        valueOf(
          await adapter().commands.deployments.setMembers({
            deployment_id: deployment.id,
            expected_version: 1,
            members: [
              { soldier_id: member.id, start_date: TODAY, end_date: MID_MONTH },
            ],
          }),
        );
        const narrowed = await adapter().commands.deployments.update({
          id: deployment.id,
          expected_version: 2,
          changes: { start_date: TOMORROW },
        });
        expect(issuesOf(narrowed)).toEqual([
          { path: ["changes", "start_date"], code: "invalid_value" },
        ]);
        // The answer names the deployment's date that cuts the member off.
        const shortened = await adapter().commands.deployments.update({
          id: deployment.id,
          expected_version: 2,
          changes: { end_date: TODAY },
        });
        expect(issuesOf(shortened)).toEqual([
          { path: ["changes", "end_date"], code: "invalid_value" },
        ]);
        const moved = valueOf(
          await adapter().commands.deployments.update({
            id: deployment.id,
            expected_version: 2,
            changes: { end_date: MID_MONTH },
          }),
        );
        expect(moved).toMatchObject({ end_date: MID_MONTH, version: 3 });
      });

      it("shows and keeps members by what the actor can see", async () => {
        const company = await unit("Company");
        const other = await unit("Other");
        const deployment = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id),
          ),
        );
        const inside = await soldier(company.id, "Avi");
        const outside = await soldier(other.id, "Ben");
        valueOf(
          await adapter().commands.deployments.setMembers({
            deployment_id: deployment.id,
            expected_version: 1,
            members: [
              { soldier_id: inside.id, start_date: null, end_date: null },
              { soldier_id: outside.id, start_date: null, end_date: null },
            ],
          }),
        );

        const actor = await seedActor(
          harnessOf(),
          organization,
          [
            pair("deployments", "view"),
            pair("deployments", "update"),
            pair("soldiers", "view"),
            pair("units", "view"),
          ],
          {
            anchor_type: "unit",
            anchor_unit_id: company.id,
            include_descendants: true,
          },
        );
        harnessOf().signIn(actor.identity);
        const seen = valueOf(
          await adapter().repositories.deployment_members.list({
            deployment_ids: null,
          }),
        );
        expect(seen.map((member) => member.soldier_id)).toEqual([inside.id]);
        const refused = await adapter().commands.deployments.setMembers({
          deployment_id: deployment.id,
          expected_version: 2,
          members: [
            { soldier_id: outside.id, start_date: null, end_date: null },
          ],
        });
        expect(issuesOf(refused)).toEqual([
          { path: ["members", 0, "soldier_id"], code: "reference_not_found" },
        ]);
        expect(
          valueOf(
            await adapter().commands.deployments.setMembers({
              deployment_id: deployment.id,
              expected_version: 2,
              members: [],
            }),
          ),
        ).toEqual([]);

        harnessOf().signIn(owner);
        const left = valueOf(
          await adapter().repositories.deployment_members.list({
            deployment_ids: [deployment.id],
          }),
        );
        expect(left.map((member) => member.soldier_id)).toEqual([outside.id]);
      });

      it("hides a deployment of a unit outside the scope", async () => {
        const company = await unit("Company");
        const other = await unit("Other");
        const hidden = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(other.id),
          ),
        );
        const actor = await seedActor(
          harnessOf(),
          organization,
          [pair("deployments", "view")],
          {
            anchor_type: "unit",
            anchor_unit_id: company.id,
            include_descendants: true,
          },
        );
        harnessOf().signIn(actor.identity);
        expect(
          valueOf(
            await adapter().repositories.deployments.list({
              include_archived: false,
            }),
          ),
        ).toEqual([]);
        expect(
          errorOf(await adapter().repositories.deployments.get(hidden.id)).code,
        ).toBe("not_found");
        expect(
          errorOf(
            await adapter().commands.deployments.setMembers({
              deployment_id: hidden.id,
              expected_version: 1,
              members: [],
            }),
          ).code,
        ).toBe("not_found");
      });
    });

    describe("rotation mode (D-221)", () => {
      it("closes on today, refuses changes while closed, and reopens", async () => {
        const company = await unit("Company");
        const rotation = valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id, { end_date: null }),
          ),
        );
        const closed = valueOf(
          await adapter().commands.deployments.close({ id: rotation.id, expected_version: 1 }),
        );
        expect(closed).toMatchObject({ end_date: TODAY, closed_at: NOW, closed_by: ownerId, version: 2 });
        expect(
          issuesOf(await adapter().commands.deployments.close({ id: rotation.id, expected_version: 2 })),
        ).toEqual([{ path: ["id"], code: "rotation_closed" }]);
        expect(
          issuesOf(
            await adapter().commands.deployments.update({
              id: rotation.id,
              expected_version: 2,
              changes: { name: "Renamed" },
            }),
          ),
        ).toEqual([{ path: ["changes"], code: "rotation_closed" }]);
        expect(
          issuesOf(
            await adapter().commands.deployments.setMembers({
              deployment_id: rotation.id,
              expected_version: 2,
              members: [],
            }),
          ),
        ).toEqual([{ path: ["deployment_id"], code: "rotation_closed" }]);

        const reopened = valueOf(
          await adapter().commands.deployments.reopen({ id: rotation.id, expected_version: 2 }),
        );
        expect(reopened).toMatchObject({ end_date: TODAY, closed_at: null, closed_by: null, version: 3 });
        expect(
          issuesOf(await adapter().commands.deployments.reopen({ id: rotation.id, expected_version: 3 })),
        ).toEqual([{ path: ["id"], code: "invalid_value" }]);
      });

      it("refuses to close a rotation whose planned end is still ahead", async () => {
        const company = await unit("Company");
        const rotation = valueOf(
          await adapter().commands.deployments.create(deploymentInput(company.id)),
        );
        expect(
          issuesOf(await adapter().commands.deployments.close({ id: rotation.id, expected_version: 1 })),
        ).toEqual([{ path: ["id"], code: "rotation_not_ended" }]);
      });

      it("holds one live rotation at a time, archived ones aside", async () => {
        const company = await unit("Company");
        const other = await unit("Other");
        const first = valueOf(
          await adapter().commands.deployments.create(deploymentInput(company.id)),
        );
        expect(
          issuesOf(
            await adapter().commands.deployments.create(
              deploymentInput(other.id, { start_date: MID_MONTH, end_date: null }),
            ),
          ),
        ).toEqual([{ path: ["start_date"], code: "rotation_overlap" }]);
        valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(other.id, { start_date: NEXT_MONTH, end_date: null }),
          ),
        );
        valueOf(await adapter().commands.deployments.archive({ id: first.id, expected_version: 1 }));
        valueOf(
          await adapter().commands.deployments.create(
            deploymentInput(company.id, { start_date: MID_MONTH, end_date: MONTH_END }),
          ),
        );
      });
    });

    describe("seniority overrides (D-029, D-179)", () => {
      function overrideInput(
        soldier_id: SoldierId,
        overrides: Partial<CreateSeniorityOverrideInput> = {},
      ) {
        const input: CreateSeniorityOverrideInput = {
          id: newOverrideId(),
          soldier_id,
          seniority: 3,
          valid_from: LAST_WEEK,
          valid_to: MONTH_END,
          reason: "  ",
          ...overrides,
        };
        return input;
      }

      it("creates, refuses an overlap, revokes once, and lists by state", async () => {
        const person = await soldier(null);
        const created = valueOf(
          await adapter().commands.seniority_overrides.create(
            overrideInput(person.id),
          ),
        );
        expect(created).toMatchObject({
          seniority: 3,
          reason: null,
          created_by: ownerId,
          revoked_at: null,
        });

        const overlap = await adapter().commands.seniority_overrides.create(
          overrideInput(person.id, { valid_from: MID_MONTH, valid_to: null }),
        );
        expect(issuesOf(overlap)).toEqual([
          { path: ["valid_from"], code: "seniority_override_overlap" },
        ]);
        expect(
          issuesOf(
            await adapter().commands.seniority_overrides.create(
              overrideInput(person.id, { id: created.id }),
            ),
          ),
        ).toEqual([{ path: ["id"], code: "already_exists" }]);

        const revoked = valueOf(
          await adapter().commands.seniority_overrides.revoke({
            id: created.id,
          }),
        );
        expect(revoked).toMatchObject({ revoked_at: NOW, revoked_by: ownerId });
        expect(
          issuesOf(
            await adapter().commands.seniority_overrides.revoke({
              id: created.id,
            }),
          ),
        ).toEqual([{ path: [], code: "archived" }]);
        const next = valueOf(
          await adapter().commands.seniority_overrides.create(
            overrideInput(person.id, { valid_from: MID_MONTH, valid_to: null }),
          ),
        );

        const live = valueOf(
          await adapter().repositories.seniority_overrides.list({
            soldier_ids: [person.id],
            include_revoked: false,
          }),
        );
        expect(live.map((row) => row.id)).toEqual([next.id]);
        const all = valueOf(
          await adapter().repositories.seniority_overrides.list({
            soldier_ids: null,
            include_revoked: true,
          }),
        );
        expect(all.map((row) => row.id)).toEqual([next.id, created.id]);
      });

      it("answers not_found for an override of a soldier outside the scope", async () => {
        const company = await unit("Company");
        const other = await unit("Other");
        const person = await soldier(other.id);
        const created = valueOf(
          await adapter().commands.seniority_overrides.create(
            overrideInput(person.id),
          ),
        );
        const actor = await seedActor(
          harnessOf(),
          organization,
          [
            pair("seniority_overrides", "view"),
            pair("seniority_overrides", "delete"),
            pair("soldiers", "view"),
          ],
          {
            anchor_type: "unit",
            anchor_unit_id: company.id,
            include_descendants: true,
          },
        );
        harnessOf().signIn(actor.identity);
        expect(
          errorOf(
            await adapter().repositories.seniority_overrides.get(created.id),
          ).code,
        ).toBe("not_found");
        expect(
          errorOf(
            await adapter().commands.seniority_overrides.revoke({
              id: created.id,
            }),
          ).code,
        ).toBe("not_found");
      });
    });

    describe("leaves created together (D-012, D-049)", () => {
      // Every request belongs to a rotation its soldiers serve in (D-216).
      let rotation: DeploymentId;
      beforeEach(async () => {
        rotation = await seedRotation(harnessOf(), organization);
      });
      const serve = (...soldier_ids: SoldierId[]) =>
        seedServing(harnessOf(), organization, rotation, soldier_ids);

      async function leaveType(requires_reason = false) {
        return valueOf(
          await adapter().commands.leave_types.create({
            id: LeaveTypeId.parse(crypto.randomUUID()),
            group_id: null,
            name: "Home",
            color_key: "teal",
            icon_key: null,
            availability_effect: "unavailable",
            requires_reason,
            sort_order: 0,
          }),
        );
      }

      const draft = (soldier_id: SoldierId, leave_type_id: LeaveTypeId) => ({
        id: newLeaveId(),
        soldier_id,
        leave_type_id,
        start_date: TODAY,
        end_date: TOMORROW,
        availability_effect_override: null,
        reason: null,
        properties: {},
      });

      it("creates a batch and its leaves, all or none", async () => {
        const type = await leaveType();
        const first = await soldier(null, "Avi");
        const second = await soldier(null, "Ben");
        await serve(first.id, second.id);
        const created = valueOf(
          await adapter().commands.leaves.createBatch({
            batch: { id: newBatchId(), name: "Holiday", description: "" },
            leaves: [draft(first.id, type.id), draft(second.id, type.id)],
            deployment_id: rotation,
            as_approved: true,
            acknowledged_rule_ids: [],
          }),
        );
        expect(created.batch).toMatchObject({
          name: "Holiday",
          description: null,
          created_by: ownerId,
        });
        expect(
          created.leaves.map((leave) => [leave.batch_id, leave.status]),
        ).toEqual([
          [created.batch.id, "approved"],
          [created.batch.id, "approved"],
        ]);
        expect(
          valueOf(await adapter().repositories.leave_batches.list({})),
        ).toEqual([created.batch]);

        const taken = draft(first.id, type.id);
        const refused = await adapter().commands.leaves.createBatch({
          batch: { id: created.batch.id, name: "Again", description: null },
          leaves: [
            draft(second.id, type.id),
            { ...taken, id: created.leaves[0]?.id ?? taken.id },
          ],
          deployment_id: rotation,
          as_approved: false,
          acknowledged_rule_ids: [],
        });
        expect(issuesOf(refused)).toEqual([
          { path: ["batch", "id"], code: "already_exists" },
          { path: ["leaves", 1, "id"], code: "already_exists" },
        ]);
        expect(await harnessOf().rows("leaves")).toHaveLength(2);
        expect(await harnessOf().rows("leave_batches")).toHaveLength(1);
      });

      const single = (leave: ReturnType<typeof draft>): CreateLeaveInput => ({
        ...leave,
        deployment_id: rotation,
        as_approved: false,
        acknowledged_rule_ids: [],
        comment: null,
      });

      it("takes a request of the whole unit from its memberships in the unit's subtree (D-221)", async () => {
        const type = await leaveType();
        const { unit_id } = valueOf(await adapter().repositories.deployments.get(rotation));
        const inside = await soldier(unit_id, "Avi");
        const outside = await soldier(null, "Ben");
        valueOf(await adapter().commands.leaves.create(single(draft(inside.id, type.id))));
        expect(
          issuesOf(await adapter().commands.leaves.create(single(draft(outside.id, type.id)))),
        ).toEqual([{ path: ["soldier_id"], code: "not_a_member" }]);
      });

      it("refuses a move that strands a request of the whole unit (D-216, D-221)", async () => {
        const type = await leaveType();
        const { unit_id } = valueOf(await adapter().repositories.deployments.get(rotation));
        const inside = await soldier(unit_id, "Avi");
        valueOf(await adapter().commands.leaves.create(single(draft(inside.id, type.id))));
        const [membership] = (await harnessOf().rows("unit_memberships")).filter((row) => row.soldier_id === inside.id);
        if (membership === undefined) throw new Error("no membership");
        const leaving = await adapter().commands.soldiers.changeMembership({
          soldier_id: inside.id,
          effective_date: TOMORROW,
          current_membership: { id: membership.id, expected_version: membership.version },
          new_membership: null,
        });
        expect(issuesOf(leaving)).toEqual([{ path: ["effective_date"], code: "leaves_outside_rotation" }]);
        expect((await harnessOf().rows("unit_memberships")).find((row) => row.id === membership.id)?.valid_to).toBeNull();
      });

      it("takes no new request, edit or transition in a closed rotation (D-221)", async () => {
        const type = await leaveType();
        const member = await soldier(null, "Avi");
        await serve(member.id);
        const leave = valueOf(
          await adapter().commands.leaves.create(
            single({ ...draft(member.id, type.id), start_date: LAST_WEEK, end_date: LAST_WEEK }),
          ),
        );
        valueOf(await adapter().commands.deployments.close({ id: rotation, expected_version: 1 }));
        const closed = [{ path: ["deployment_id"], code: "rotation_closed" }];
        expect(
          issuesOf(
            await adapter().commands.leaves.create(
              single({ ...draft(member.id, type.id), start_date: LAST_WEEK, end_date: LAST_WEEK }),
            ),
          ),
        ).toEqual(closed);
        expect(
          issuesOf(
            await adapter().commands.leaves.update({
              id: leave.id,
              expected_version: 1,
              changes: { reason: "Later" },
              acknowledged_rule_ids: [],
            }),
          ),
        ).toEqual(closed);
        expect(
          issuesOf(
            await adapter().commands.leaves.transition({
              id: leave.id,
              expected_version: 1,
              transition: "approve",
              acknowledged_rule_ids: [],
              comment: null,
            }),
          ),
        ).toEqual(closed);
      });

      it("copies a leave to other soldiers and dates, without its batch", async () => {
        const type = await leaveType();
        const first = await soldier(null, "Avi");
        const second = await soldier(null, "Ben");
        await serve(first.id, second.id);
        const input: CreateLeaveInput = {
          ...draft(first.id, type.id),
          reason: "Family",
          deployment_id: rotation,
          as_approved: false,
          acknowledged_rule_ids: [],
          comment: null,
        };
        const source = valueOf(await adapter().commands.leaves.create(input));
        const copies = valueOf(
          await adapter().commands.leaves.duplicate({
            leave_id: source.id,
            copies: [
              {
                id: newLeaveId(),
                soldier_id: second.id,
                start_date: MID_MONTH,
                end_date: MONTH_END,
              },
            ],
            as_approved: false,
            acknowledged_rule_ids: [],
          }),
        );
        expect(copies).toEqual([
          expect.objectContaining({
            soldier_id: second.id,
            leave_type_id: type.id,
            reason: "Family",
            start_date: MID_MONTH,
            end_date: MONTH_END,
            batch_id: null,
            status: "pending",
          }),
        ]);
        const refused = await adapter().commands.leaves.duplicate({
          leave_id: source.id,
          copies: [
            {
              id: source.id,
              soldier_id: second.id,
              start_date: TODAY,
              end_date: TODAY,
            },
          ],
          as_approved: false,
          acknowledged_rule_ids: [],
        });
        expect(issuesOf(refused)).toEqual([
          { path: ["copies", 0, "id"], code: "already_exists" },
        ]);
      });

      it("creates several leaves of one soldier, each its own, all or none (D-275)", async () => {
        const type = await leaveType();
        const person = await soldier(null, "Avi");
        await serve(person.id);
        const { soldier_id: _soldier, ...row } = draft(person.id, type.id);
        const later = { ...row, id: newLeaveId(), start_date: MID_MONTH, end_date: MONTH_END, reason: "Family" };
        const created = valueOf(
          await adapter().commands.leaves.createMany({
            soldier_id: person.id,
            leaves: [
              { ...row, deployment_id: rotation },
              { ...later, deployment_id: rotation },
            ],
            as_approved: false,
            acknowledged_rule_ids: [],
          }),
        );
        expect(
          created.map((leave) => [leave.soldier_id, leave.batch_id, leave.status, leave.start_date, leave.reason]),
        ).toEqual([
          [person.id, null, "pending", TODAY, null],
          [person.id, null, "pending", MID_MONTH, "Family"],
        ]);
        expect(await harnessOf().rows("leave_batches")).toHaveLength(0);

        // One row outside any rotation the soldier serves in refuses the sheet, and writes nothing.
        const refused = await adapter().commands.leaves.createMany({
          soldier_id: person.id,
          leaves: [
            { ...row, id: newLeaveId(), deployment_id: rotation },
            { ...row, id: newLeaveId(), deployment_id: newDeploymentId() },
          ],
          as_approved: false,
          acknowledged_rule_ids: [],
        });
        expect(issuesOf(refused).map((issue) => issue.path.slice(0, 2))).toEqual([["leaves", 1]]);
        expect(await harnessOf().rows("leaves")).toHaveLength(2);
      });

      it("checks each row of a sheet as a single request: its own rotation, its days, distinct ids (D-275)", async () => {
        const type = await leaveType();
        const person = await soldier(null, "Avi");
        await serve(person.id);
        // One live rotation at a time (D-221): the others are earlier than the test's rotation, which starts on PAST_DATE.
        const second = await seedRotation(harnessOf(), organization, [person.id], { start_date: EARLIER_START, end_date: EARLIER_END });
        const { soldier_id: _soldier, ...row } = draft(person.id, type.id);
        const created = valueOf(
          await adapter().commands.leaves.createMany({
            soldier_id: person.id,
            leaves: [
              { ...row, deployment_id: rotation },
              { ...row, id: newLeaveId(), start_date: EARLIER_START, end_date: EARLIER_END, deployment_id: second },
            ],
            as_approved: false,
            acknowledged_rule_ids: [],
          }),
        );
        expect(created.map((leave) => leave.deployment_id)).toEqual([rotation, second]);

        const narrow = await seedRotation(harnessOf(), organization, [person.id], { start_date: NARROW_DAY, end_date: NARROW_DAY });
        const elsewhere = await seedRotation(harnessOf(), organization, [], { start_date: ELSEWHERE_DAY, end_date: ELSEWHERE_DAY });
        const sheet = (leaves: Parameters<ReturnType<typeof adapter>["commands"]["leaves"]["createMany"]>[0]["leaves"]) =>
          adapter().commands.leaves.createMany({ soldier_id: person.id, leaves, as_approved: false, acknowledged_rule_ids: [] });
        expect(issuesOf(await sheet([{ ...row, id: newLeaveId(), start_date: BEFORE_NARROW, end_date: NARROW_DAY, deployment_id: narrow }]))).toEqual([
          { path: ["leaves", 0, "start_date"], code: "outside_rotation" },
        ]);
        expect(issuesOf(await sheet([{ ...row, id: newLeaveId(), start_date: ELSEWHERE_DAY, end_date: ELSEWHERE_DAY, deployment_id: elsewhere }]))).toEqual([
          { path: ["leaves", 0, "soldier_id"], code: "not_a_member" },
        ]);
        const twice = newLeaveId();
        expect(
          issuesOf(
            await sheet([
              { ...row, id: twice, deployment_id: rotation },
              { ...row, id: twice, deployment_id: rotation },
            ]),
          ).map((issue) => issue.path),
        ).toEqual([["leaves", 1]]);
        expect(issuesOf(await sheet([{ ...row, deployment_id: rotation }]))).toEqual([
          { path: ["leaves", 0, "id"], code: "already_exists" },
        ]);
        expect(await harnessOf().rows("leaves")).toHaveLength(2);
      });

      it("checks a sheet's reasons on their rows, and refuses past its limit before reading any (D-275)", async () => {
        const type = await leaveType(true);
        const person = await soldier(null, "Avi");
        await serve(person.id);
        const { soldier_id: _soldier, ...row } = draft(person.id, type.id);
        const sheet = (leaves: Parameters<ReturnType<typeof adapter>["commands"]["leaves"]["createMany"]>[0]["leaves"]) =>
          adapter().commands.leaves.createMany({ soldier_id: person.id, leaves, as_approved: false, acknowledged_rule_ids: [] });
        expect(
          issuesOf(
            await sheet([
              { ...row, id: newLeaveId(), reason: "Family", deployment_id: rotation },
              { ...row, id: newLeaveId(), reason: " ", deployment_id: rotation },
            ]),
          ),
        ).toEqual([{ path: ["leaves", 1, "reason"], code: "reason_required" }]);
        const endless = Array.from({ length: LEAVE_SHEET.maxLeaves + 1 }, () => ({
          ...row,
          id: newLeaveId(),
          reason: "Family",
          deployment_id: rotation,
        }));
        expect(issuesOf(await sheet(endless))).toEqual([{ path: ["leaves"], code: "too_big" }]);
        expect(await harnessOf().rows("leaves")).toHaveLength(0);
      });

      it("needs leaves:create over the soldier for a sheet, and leaves:approve to approve it now (D-275)", async () => {
        const type = await leaveType();
        const person = await soldier(null, "Avi");
        await serve(person.id);
        const { soldier_id: _soldier, ...row } = draft(person.id, type.id);
        const viewer = [pair("soldiers", "view"), pair("leaves", "view"), pair("leave_types", "view")];
        const sheet = (as_approved: boolean) =>
          adapter().commands.leaves.createMany({
            soldier_id: person.id,
            leaves: [{ ...row, id: newLeaveId(), deployment_id: rotation }],
            as_approved,
            acknowledged_rule_ids: [],
          });
        const looker = await seedActor(harnessOf(), organization, viewer, { anchor_type: "organization" });
        harnessOf().signIn(looker.identity);
        expect(errorOf(await sheet(false)).code).toBe("forbidden");
        const requester = await seedActor(harnessOf(), organization, [...viewer, pair("leaves", "create")], {
          anchor_type: "organization",
        });
        harnessOf().signIn(requester.identity);
        expect(errorOf(await sheet(true)).code).toBe("forbidden");
        expect(await harnessOf().rows("leaves")).toHaveLength(0);
        expect(valueOf(await sheet(false)).map((leave) => leave.status)).toEqual(["pending"]);
        harnessOf().signIn(owner);
        expect(valueOf(await sheet(true)).map((leave) => [leave.status, leave.reviewed_by])).toEqual([["approved", ownerId]]);
      });

      it("shows a batch only with a leave the actor can see", async () => {
        const type = await leaveType();
        const person = await soldier(null);
        await serve(person.id);
        valueOf(
          await adapter().commands.leaves.createBatch({
            batch: { id: newBatchId(), name: "Holiday", description: null },
            leaves: [draft(person.id, type.id)],
            deployment_id: rotation,
            as_approved: false,
            acknowledged_rule_ids: [],
          }),
        );
        const company = await unit("Company");
        const actor = await seedActor(
          harnessOf(),
          organization,
          [pair("leaves", "view"), pair("soldiers", "view")],
          {
            anchor_type: "unit",
            anchor_unit_id: company.id,
            include_descendants: true,
          },
        );
        harnessOf().signIn(actor.identity);
        expect(
          valueOf(await adapter().repositories.leave_batches.list({})),
        ).toEqual([]);
      });
    });
  });
}
