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
import { beforeEach, describe, expect, it } from "vitest";
import type { ContractHarness } from "./harness";
import { NOW, errorOf, issuesOf, seedActor, valueOf } from "./support";

// Deployments and their members, personal seniority, leaves created together and copies of a leave (D-012, D-019,
// D-029, D-049, D-179). Sample data, test files only.

const LAST_WEEK = "2026-11-01";
const TODAY = "2026-11-08";
const TOMORROW = "2026-11-09";
const MID_MONTH = "2026-11-15";
const MONTH_END = "2026-11-30";

const newDeploymentId = () => DeploymentId.parse(crypto.randomUUID());
const newOverrideId = () => SeniorityOverrideId.parse(crypto.randomUUID());
const newLeaveId = () => LeaveId.parse(crypto.randomUUID());
const newBatchId = () => LeaveBatchId.parse(crypto.randomUUID());

const pair = (resource: Permission["resource"], action: Permission["action"]) =>
  ({ resource, action }) as Permission;

export function describeDeploymentContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{
    input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } };
    owner: AuthIdentity;
  }>,
): void {
  const adapter = () => harnessOf().adapter;

  describe("deployments, seniority and leaves together", () => {
    let organization: OrganizationId;
    let ownerId: SoldierId;
    let owner: AuthIdentity;

    beforeEach(async () => {
      const claimed = await claim();
      organization = claimed.input.organization.id;
      ownerId = claimed.input.soldier.id;
      owner = claimed.owner;
    });

    async function unit(name: string) {
      return valueOf(
        await adapter().commands.units.create({
          id: UnitId.parse(crypto.randomUUID()),
          parent_id: null,
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
            deploymentInput(company.id, { name: "Early" }),
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
          deploymentInput(UnitId.parse(crypto.randomUUID())),
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
              deploymentInput(gone.id),
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
      async function leaveType() {
        return valueOf(
          await adapter().commands.leave_types.create({
            id: LeaveTypeId.parse(crypto.randomUUID()),
            group_id: null,
            name: "Home",
            color_key: "teal",
            icon_key: null,
            availability_effect: "unavailable",
            requires_reason: false,
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
        const created = valueOf(
          await adapter().commands.leaves.createBatch({
            batch: { id: newBatchId(), name: "Holiday", description: "" },
            leaves: [draft(first.id, type.id), draft(second.id, type.id)],
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

      it("copies a leave to other soldiers and dates, without its batch", async () => {
        const type = await leaveType();
        const first = await soldier(null, "Avi");
        const second = await soldier(null, "Ben");
        const input: CreateLeaveInput = {
          ...draft(first.id, type.id),
          reason: "Family",
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

      it("shows a batch only with a leave the actor can see", async () => {
        const type = await leaveType();
        const person = await soldier(null);
        valueOf(
          await adapter().commands.leaves.createBatch({
            batch: { id: newBatchId(), name: "Holiday", description: null },
            leaves: [draft(person.id, type.id)],
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
