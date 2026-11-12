import { z } from 'zod'
import { CommandRankId, DeploymentId, SeniorityOverrideId, SoldierId, TagId, UnitMembershipId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import { CalendarDate } from '../common/scalars'
import {
  CommandRank,
  SeniorityOverrideColumns,
  Soldier,
  SoldierPrivate,
  UnitMembershipColumns,
} from '../entities/soldiers'
import { IssueCode } from '../errors'
import { ExpectedVersion, archiveInput, changesOf, distinctIds, updateInput } from './common'

// ------------------------------------------------------------------ command ranks

const rankContent = CommandRank.pick({
  title: true,
  short_title: true,
  seniority: true,
  color_key: true,
}).shape

export const CreateCommandRankInput = z.strictObject({ id: CommandRankId, ...rankContent })
export type CreateCommandRankInput = z.infer<typeof CreateCommandRankInput>

/** Changing `seniority` affects every holder of the rank at once (D-029). */
export const UpdateCommandRankInput = updateInput(CommandRankId, rankContent)
export type UpdateCommandRankInput = z.infer<typeof UpdateCommandRankInput>

export const ArchiveCommandRankInput = archiveInput(CommandRankId)
export type ArchiveCommandRankInput = z.infer<typeof ArchiveCommandRankInput>

// ---------------------------------------------------------------------- soldiers

/** A new primary membership that starts on `valid_from` (D-010). */
export const MembershipPlacement = z.strictObject({
  id: UnitMembershipId,
  ...UnitMembershipColumns.pick({ unit_id: true, valid_from: true }).shape,
})
export type MembershipPlacement = z.infer<typeof MembershipPlacement>

const soldierContent = Soldier.pick({
  first_name: true,
  last_name: true,
  nickname: true,
  command_rank_id: true,
  status: true,
  properties: true,
}).shape

const privateContent = SoldierPrivate.pick({ personal_id: true, invite_email: true, phone: true }).shape

/**
 * `createSoldier`: a soldier with optional private fields and first placement, atomically.
 * Names alone are enough (D-030).
 */
export const CreateSoldierInput = z.strictObject({
  id: SoldierId,
  ...soldierContent,
  private: z.strictObject(privateContent).nullable(),
  membership: MembershipPlacement.nullable(),
})
export type CreateSoldierInput = z.infer<typeof CreateSoldierInput>

export const UpdateSoldierInput = updateInput(SoldierId, soldierContent)
export type UpdateSoldierInput = z.infer<typeof UpdateSoldierInput>

export const ArchiveSoldierInput = archiveInput(SoldierId)
export type ArchiveSoldierInput = z.infer<typeof ArchiveSoldierInput>

/** Private fields (resource `soldier_private`, D-018). `expected_version` is NULL while no row exists. */
export const UpdateSoldierPrivateInput = z.strictObject({
  soldier_id: SoldierId,
  expected_version: ExpectedVersion.nullable(),
  changes: changesOf(privateContent),
})
export type UpdateSoldierPrivateInput = z.infer<typeof UpdateSoldierPrivateInput>

/**
 * Replaces the soldier's tag set in one scope (`soldiers:update`, D-040): the persistent tags when `deployment_id` is
 * NULL, else that rotation's (D-260). Bumps the soldier's version. Domain enforces `single` categories per scope.
 */
export const SetSoldierTagsInput = z.strictObject({
  soldier_id: SoldierId,
  expected_version: ExpectedVersion,
  deployment_id: DeploymentId.nullable(),
  tag_ids: distinctIds(TagId),
})
export type SetSoldierTagsInput = z.infer<typeof SetSoldierTagsInput>

/**
 * `changeMembership` (D-010): closes the current primary membership the day before
 * `effective_date` and opens the new one on it. NULL current = first placement; NULL new =
 * the soldier leaves without a new unit.
 */
export const ChangeMembershipInput = z
  .strictObject({
    soldier_id: SoldierId,
    effective_date: CalendarDate,
    current_membership: z
      .strictObject({ id: UnitMembershipId, expected_version: ExpectedVersion })
      .nullable(),
    new_membership: z
      .strictObject({ id: UnitMembershipId, unit_id: UnitMembershipColumns.shape.unit_id })
      .nullable(),
  })
  .refine((input) => input.current_membership !== null || input.new_membership !== null, {
    message: IssueCode.enum.required,
    path: ['new_membership'],
  })
export type ChangeMembershipInput = z.infer<typeof ChangeMembershipInput>

// ------------------------------------------------------------ seniority overrides

export const CreateSeniorityOverrideInput = z
  .strictObject({
    id: SeniorityOverrideId,
    ...SeniorityOverrideColumns.pick({
      soldier_id: true,
      seniority: true,
      valid_from: true,
      valid_to: true,
      reason: true,
    }).shape,
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.valid_from, input.valid_to, 'valid_to')
  })
export type CreateSeniorityOverrideInput = z.infer<typeof CreateSeniorityOverrideInput>

/** Revocation is final (resource action `delete`, D-040). The row has no version. */
export const RevokeSeniorityOverrideInput = z.strictObject({ id: SeniorityOverrideId })
export type RevokeSeniorityOverrideInput = z.infer<typeof RevokeSeniorityOverrideInput>
