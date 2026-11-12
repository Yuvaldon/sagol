import type { AppError, Deployment, DeploymentMember, Issue, Soldier } from '@contracts'
import { t } from '@i18n'
import { deploymentMemberValues, deploymentMembersIssues, fullName, useDeploymentCommands, type DeploymentMemberValues } from '@logic'
import { useState } from 'react'
import { EntityForm } from '../../patterns/EntityForm'
import { fieldError, formStateOf } from '../../patterns/forms'
import { formatDate } from '../../patterns/dates'
import { CheckList, RadioList } from '../../primitives/ChoiceList'
import { DateField } from '../../primitives/DateField'

// Who serves in a deployment (D-019, D-179): the soldiers chosen, each with the deployment's own days unless given
// their own, inside the deployment's. Saved as the whole list, at the version the editor opened with. "The whole unit"
// saves no list: whoever serves in the unit on a day serves in the rotation (D-259, D-222).

const WHOLE = 'whole'
const LISTED = 'listed'

/** The date fields on screen; any other issue goes above the actions. */
const memberFields = (rows: readonly DeploymentMemberValues[]) =>
  rows.flatMap((_, index) => [`members.${String(index)}.start_date`, `members.${String(index)}.end_date`])

export function DeploymentMembersForm({
  deployment,
  members,
  soldiers,
  defaults,
  onDone,
  onReload,
}: {
  readonly deployment: Deployment
  readonly members: readonly DeploymentMember[]
  /** Who may be chosen: the live soldiers the actor sees, and whoever already serves. */
  readonly soldiers: readonly Soldier[]
  /** Who a new list starts with: the previous rotation's soldiers, else the rotation's unit (D-219, D-222). */
  readonly defaults: readonly DeploymentMemberValues[]
  readonly onDone: () => void
  readonly onReload: () => void
}) {
  const { setMembers } = useDeploymentCommands()
  const [opened] = useState(deployment)
  const [serving] = useState(() => deploymentMemberValues(members, deployment))
  const [whole, setWhole] = useState(serving.length === 0)
  const [rows, setRows] = useState<readonly DeploymentMemberValues[]>(serving.length === 0 ? defaults : serving)
  const saved = whole ? [] : rows
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)
  const nameOf = new Map(soldiers.map((soldier) => [soldier.id, fullName(soldier)]))
  const span = [formatDate(deployment.start_date), deployment.end_date === null ? t('deployments.openEnd') : formatDate(deployment.end_date)].join(
    ` ${t('deployments.until')} `,
  )

  const choose = (keys: readonly string[]) => {
    const kept = rows.filter((row) => keys.includes(row.soldier_id))
    const added = soldiers
      .filter((soldier) => keys.includes(soldier.id) && !rows.some((row) => row.soldier_id === soldier.id))
      .map((soldier): DeploymentMemberValues => ({ soldier_id: soldier.id, start_date: '', end_date: '' }))
    setRows([...kept, ...added])
  }
  const change = (index: number, patch: Partial<DeploymentMemberValues>) => {
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  }

  async function submit() {
    setFailure(null)
    const issues = deploymentMembersIssues(opened, saved)
    setAnswered(issues)
    const unplaced = issues.filter((issue) => !memberFields(saved).includes(issue.path.join('.')))
    if (unplaced.length > 0) setFailure({ code: 'validation_failed', issues: unplaced })
    if (issues.length > 0) return
    const result = await setMembers.run({ deployment: opened, openedVersion: opened.version, members: saved })
    if (result.ok) {
      onDone()
      return
    }
    const state = formStateOf(result.error, memberFields(saved))
    setAnswered(state.answered)
    setFailure(state.failure)
  }

  return (
    <EntityForm
      titleKey="deployments.membersTitle"
      submitKey="common.save"
      isPending={setMembers.isPending}
      failure={failure}
      onReload={onReload}
      onCancel={onDone}
      onSubmit={() => {
        void submit()
      }}
    >
      <p className="text-name font-semibold">{deployment.name}</p>
      <p className="text-micro text-text-muted tabular-nums">{span}</p>
      <RadioList
        label={{ key: 'deployments.whoServes' }}
        choices={[
          { key: WHOLE, label: { key: 'deployments.wholeUnit' } },
          { key: LISTED, label: { key: 'deployments.listed' } },
        ]}
        selected={whole ? WHOLE : LISTED}
        onChange={(key) => {
          setWhole(key === WHOLE)
        }}
      />
      {whole ? (
        <p className="text-micro text-text-muted">{t('deployments.wholeUnitHint')}</p>
      ) : (
        <CheckList
          label={{ key: 'deployments.members' }}
          choices={soldiers.map((soldier) => ({ key: soldier.id, label: { text: fullName(soldier) } }))}
          selected={rows.map((row) => row.soldier_id)}
          onChange={choose}
        />
      )}
      {saved.length === 0 ? null : (
        <fieldset className="flex flex-col gap-md">
          <legend className="pb-xs text-label font-semibold text-text-muted">{t('deployments.memberDates')}</legend>
          <p className="text-micro text-text-muted">{t('deployments.memberDatesHint')}</p>
          {rows.map((row, index) => (
            <div key={row.soldier_id} className="flex flex-col gap-xs border-b border-line pb-sm">
              <span className="text-name font-semibold">{nameOf.get(row.soldier_id) ?? t('deployments.hiddenSoldier')}</span>
              <div className="grid grid-cols-2 gap-md">
                <DateField
                  labelKey="deployments.from"
                  name={`members.${String(index)}.start_date`}
                  value={row.start_date}
                  onChange={(value) => {
                    change(index, { start_date: value })
                  }}
                  error={fieldError([], `members.${String(index)}.start_date`, answered)}
                />
                <DateField
                  labelKey="deployments.to"
                  name={`members.${String(index)}.end_date`}
                  value={row.end_date}
                  onChange={(value) => {
                    change(index, { end_date: value })
                  }}
                  error={fieldError([], `members.${String(index)}.end_date`, answered)}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}
    </EntityForm>
  )
}
