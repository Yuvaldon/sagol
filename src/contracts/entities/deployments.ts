import { z } from 'zod'
import { auditColumns, createdColumns } from '../common/audit'
import { DeploymentId, OrganizationId, SoldierId, UnitId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import { CalendarDate, label } from '../common/scalars'

/** `deployments`: reserve duty periods. "Active" is derived from dates (D-019). */
export const Deployment = z
  .object({
    id: DeploymentId,
    organization_id: OrganizationId,
    name: label(255),
    unit_id: UnitId,
    start_date: CalendarDate,
    end_date: CalendarDate.nullable(),
    ...auditColumns,
  })
  .superRefine((row, ctx) => {
    checkDateRange(ctx, row.start_date, row.end_date, 'end_date')
  })
export type Deployment = z.infer<typeof Deployment>

/** `deployment_members`. NULL dates fall back to the dates of the deployment. */
export const DeploymentMember = z
  .object({
    deployment_id: DeploymentId,
    soldier_id: SoldierId,
    organization_id: OrganizationId,
    start_date: CalendarDate.nullable(),
    end_date: CalendarDate.nullable(),
    ...createdColumns,
  })
  .superRefine((row, ctx) => {
    checkDateRange(ctx, row.start_date, row.end_date, 'end_date')
  })
export type DeploymentMember = z.infer<typeof DeploymentMember>
