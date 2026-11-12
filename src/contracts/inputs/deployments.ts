import { z } from 'zod'
import { DeploymentId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import { DeploymentColumns, DeploymentMemberColumns } from '../entities/deployments'
import { ExpectedVersion, archiveInput, checkDistinct, updateInput } from './common'

const deploymentContent = DeploymentColumns.pick({
  name: true,
  unit_id: true,
  start_date: true,
  end_date: true,
}).shape

export const CreateDeploymentInput = z
  .strictObject({ id: DeploymentId, ...deploymentContent })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentInput>

export const UpdateDeploymentInput = updateInput(DeploymentId, deploymentContent)
export type UpdateDeploymentInput = z.infer<typeof UpdateDeploymentInput>

export const ArchiveDeploymentInput = archiveInput(DeploymentId)
export type ArchiveDeploymentInput = z.infer<typeof ArchiveDeploymentInput>

/** Closes an ended rotation (D-258): its dates, members, rotation tags and requests become read-only. */
export const CloseDeploymentInput = z.strictObject({ id: DeploymentId, expected_version: ExpectedVersion })
export type CloseDeploymentInput = z.infer<typeof CloseDeploymentInput>

/** Reopens a closed rotation (D-258). */
export const ReopenDeploymentInput = z.strictObject({ id: DeploymentId, expected_version: ExpectedVersion })
export type ReopenDeploymentInput = z.infer<typeof ReopenDeploymentInput>

const DeploymentMemberDraft = z
  .strictObject(
    DeploymentMemberColumns.pick({ soldier_id: true, start_date: true, end_date: true }).shape,
  )
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })

/** Replaces the member set of a deployment; the deployment's version covers the set. */
export const SetDeploymentMembersInput = z.strictObject({
  deployment_id: DeploymentId,
  expected_version: ExpectedVersion,
  members: z.array(DeploymentMemberDraft).superRefine((members, ctx) => {
    checkDistinct(ctx, members, (member) => member.soldier_id)
  }),
})
export type SetDeploymentMembersInput = z.infer<typeof SetDeploymentMembersInput>
