import {
  CreateDeploymentInput,
  DeploymentId,
  SetDeploymentMembersInput,
  UpdateDeploymentInput,
  type CalendarDate,
  type Deployment,
  type DeploymentMember,
  type Issue,
  type SoldierId,
  type UnitId,
} from '@contracts'
import { compareDates, deploymentMemberIssues, withPathPrefix } from '@domain'
import { formIssues } from '../forms/issues'

// Deployments and their members (D-019, D-179), between the module's forms and the commands. Pure. "Active" is
// derived from the dates, never stored (D-019).

export interface DeploymentFormValues {
  readonly name: string
  readonly unit_id: UnitId | null
  /** '' while the field is empty; the schema then answers. */
  readonly start_date: CalendarDate | ''
  /** '' = open-ended. */
  readonly end_date: CalendarDate | ''
}

export function newDeploymentValues(today: CalendarDate, unitId: UnitId | null): DeploymentFormValues {
  return { name: '', unit_id: unitId, start_date: today, end_date: '' }
}

export function deploymentFormValues(deployment: Deployment): DeploymentFormValues {
  return {
    name: deployment.name,
    unit_id: deployment.unit_id,
    start_date: deployment.start_date,
    end_date: deployment.end_date ?? '',
  }
}

function deploymentContent(values: DeploymentFormValues) {
  return {
    name: values.name.trim(),
    unit_id: values.unit_id ?? undefined,
    start_date: values.start_date === '' ? undefined : values.start_date,
    end_date: values.end_date === '' ? null : values.end_date,
  }
}

function createInput(values: DeploymentFormValues) {
  return { id: DeploymentId.parse(crypto.randomUUID()), ...deploymentContent(values) }
}

/** The codes the command answers on the row (D-068). */
export function deploymentFormIssues(values: DeploymentFormValues): Issue[] {
  return formIssues(CreateDeploymentInput, createInput(values))
}

export function toCreateDeploymentInput(values: DeploymentFormValues): CreateDeploymentInput {
  return CreateDeploymentInput.parse(createInput(values))
}

/** Only what differs from the stored deployment, at the version the form opened with. NULL when nothing changed. */
export function toUpdateDeploymentInput(
  deployment: Deployment,
  openedVersion: number,
  values: DeploymentFormValues,
): UpdateDeploymentInput | null {
  const content = deploymentContent(values)
  const stored: Readonly<Record<string, unknown>> = deployment
  const changes = Object.fromEntries(Object.entries(content).filter(([column, value]) => value !== stored[column]))
  if (Object.keys(changes).length === 0) return null
  return UpdateDeploymentInput.parse({ id: deployment.id, expected_version: openedVersion, changes })
}

/** Live deployments, the latest first, as the repository orders them. */
export function liveDeployments(deployments: readonly Deployment[]): Deployment[] {
  return deployments.filter((deployment) => deployment.archived_at === null)
}

/** Whether a deployment runs on a day (D-019): derived from its dates. */
export function isDeploymentActive(deployment: Pick<Deployment, 'start_date' | 'end_date'>, date: CalendarDate): boolean {
  return (
    compareDates(deployment.start_date, date) <= 0 && (deployment.end_date === null || compareDates(date, deployment.end_date) <= 0)
  )
}

// -------------------------------------------------------------------- members

/** One member row of the editor. '' = the deployment's own date (D-179). */
export interface DeploymentMemberValues {
  readonly soldier_id: SoldierId
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
}

export function deploymentMemberValues(members: readonly DeploymentMember[], deployment: Deployment): DeploymentMemberValues[] {
  return members
    .filter((member) => member.deployment_id === deployment.id)
    .map((member) => ({ soldier_id: member.soldier_id, start_date: member.start_date ?? '', end_date: member.end_date ?? '' }))
}

function membersInput(deployment: Deployment, openedVersion: number, members: readonly DeploymentMemberValues[]) {
  return {
    deployment_id: deployment.id,
    expected_version: openedVersion,
    members: members.map((member) => ({
      soldier_id: member.soldier_id,
      start_date: member.start_date === '' ? null : member.start_date,
      end_date: member.end_date === '' ? null : member.end_date,
    })),
  }
}

/** The codes the command answers: the schema's, and a member's dates outside the deployment's, on that member. */
export function deploymentMembersIssues(deployment: Deployment, members: readonly DeploymentMemberValues[]): Issue[] {
  const input = membersInput(deployment, deployment.version, members)
  return [
    ...formIssues(SetDeploymentMembersInput, input),
    ...input.members.flatMap((member, index) => withPathPrefix(['members', index], deploymentMemberIssues(deployment, member))),
  ]
}

export function toSetDeploymentMembersInput(
  deployment: Deployment,
  openedVersion: number,
  members: readonly DeploymentMemberValues[],
): SetDeploymentMembersInput {
  return SetDeploymentMembersInput.parse(membersInput(deployment, openedVersion, members))
}
