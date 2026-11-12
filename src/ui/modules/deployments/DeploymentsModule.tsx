import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, Deployment, Soldier, Unit } from '@contracts'
import { t } from '@i18n'
import {
  defaultDeploymentMembers,
  fullName,
  isDeploymentActive,
  liveDeployments,
  useDeploymentCommands,
  useDeploymentMembers,
  useDeploymentPermissions,
  useDeployments,
  useMemberships,
  usePanel,
  useSoldiersWithArchived,
  useToday,
  useUnitsWithArchived,
} from '@logic'
import { Archive, Plus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { DeploymentForm, type DeploymentFormProps } from './DeploymentForm'
import { DeploymentMembersForm } from './DeploymentMembersForm'

// The deployments drawer (D-019, D-179): reserve duty periods of a unit, the latest first, each with who serves in it.
// "Active" is read from the dates. A rule can count only a deployment's members (D-071).

const PART_SEPARATOR = ' · '

function DeploymentRow({
  deployment,
  unitName,
  memberCount,
  active,
  canUpdate,
  actions,
}: {
  readonly deployment: Deployment
  readonly unitName: string
  readonly memberCount: number
  readonly active: boolean
  readonly canUpdate: boolean
  readonly actions: readonly RowAction[]
}) {
  const panel = usePanel()
  const span = [formatDate(deployment.start_date), deployment.end_date === null ? t('deployments.openEnd') : formatDate(deployment.end_date)].join(
    ` ${t('deployments.until')} `,
  )
  const content = (
    <span className="flex min-w-none flex-col gap-2xs">
      <span className="flex items-center gap-sm">
        <span className="min-w-none truncate text-name font-semibold">{deployment.name}</span>
        {active ? (
          <span className="shrink-0 rounded-pill bg-inner px-sm text-micro font-semibold">{t('deployments.active')}</span>
        ) : null}
      </span>
      <span className="text-micro text-text-muted tabular-nums">
        {[unitName, span, `${t('deployments.memberCount')} ${String(memberCount)}`].join(PART_SEPARATOR)}
      </span>
    </span>
  )
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.deployments, { entity: deployment.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {content}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{content}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

/** The editor remounts on "reload", from the stored row. */
function DeploymentEditor(props: Omit<DeploymentFormProps, 'onReload'>) {
  const [generation, setGeneration] = useState(0)
  return (
    <DeploymentForm
      key={generation}
      {...props}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function MembersEditor({
  deployment,
  soldiers,
  units,
  onDone,
}: {
  readonly deployment: Deployment
  readonly soldiers: readonly Soldier[]
  readonly units: readonly Unit[]
  readonly onDone: () => void
}) {
  const members = useDeploymentMembers()
  const memberships = useMemberships()
  const [generation, setGeneration] = useState(0)
  if (members.status === 'failed') return <FailureNotice error={members.error} />
  if (memberships.status === 'failed') return <FailureNotice error={memberships.error} />
  if (members.status === 'loading' || memberships.status === 'loading') return <LoadingNotice />
  const serving = new Set(members.value.filter((member) => member.deployment_id === deployment.id).map((member) => member.soldier_id))
  // Whoever already serves stays a choice, even when no longer active.
  const choices = soldiers
    .filter((soldier) => (soldier.status === 'active' && soldier.archived_at === null) || serving.has(soldier.id))
    .toSorted((first, second) => fullName(first).localeCompare(fullName(second)))
  return (
    <DeploymentMembersForm
      key={`${deployment.id}:${String(generation)}`}
      deployment={deployment}
      members={members.value}
      soldiers={choices}
      // A new rotation starts with the soldiers of its unit who can be chosen (D-219).
      defaults={defaultDeploymentMembers(deployment, units, memberships.value, choices)}
      onDone={onDone}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function NotFound() {
  const panel = usePanel()
  return (
    <div className="flex flex-col items-center gap-md py-xl text-center">
      <p className="text-name text-text-muted">{t('deployments.notFound')}</p>
      <Button
        onPress={() => {
          panel.open(PANEL_IDS.deployments)
        }}
      >
        {t('common.backToList')}
      </Button>
    </div>
  )
}

export function DeploymentsModule() {
  const panel = usePanel()
  const today = useToday()
  const deployments = useDeployments()
  const members = useDeploymentMembers()
  const units = useUnitsWithArchived()
  const soldiers = useSoldiersWithArchived()
  const commands = useDeploymentCommands()
  const liveUnits = useMemo(() => (units.status === 'ready' ? units.value.filter((row) => row.archived_at === null) : NO_UNITS), [units])
  const live = useMemo(() => (deployments.status === 'ready' ? liveDeployments(deployments.value) : NO_DEPLOYMENTS), [deployments])
  const permissions = useDeploymentPermissions(liveUnits, live)
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<Deployment | null>(null)
  const [staffing, setStaffing] = useState<Deployment | null>(null)

  for (const loaded of [deployments, members, units, soldiers]) {
    if (loaded.status === 'failed') return <FailureNotice error={loaded.error} />
  }
  if (deployments.status !== 'ready' || members.status !== 'ready' || units.status !== 'ready' || soldiers.status !== 'ready' || today === null) {
    return <LoadingNotice />
  }

  if (panel.entity === NEW_ENTITY) {
    return (
      <DeploymentEditor
        deployment={null}
        units={units.value}
        today={today}
        placeable={permissions.createIn}
        onCreated={(created) => {
          setStaffing(created)
          panel.open(PANEL_IDS.deployments)
        }}
      />
    )
  }
  if (panel.entity !== null) {
    const deployment = live.find((candidate) => candidate.id === panel.entity)
    if (deployment === undefined) return <NotFound />
    return <DeploymentEditor key={deployment.id} deployment={deployment} units={units.value} today={today} placeable={permissions.moveTo} />
  }
  // The row as stored now, so the editor opens on its current version; a rotation just created is the row the command
  // returned until the list refetches it.
  const staffed = staffing === null ? undefined : (live.find((candidate) => candidate.id === staffing.id) ?? justCreated(staffing, deployments.value))
  if (staffed !== undefined) {
    return (
      <MembersEditor
        deployment={staffed}
        soldiers={soldiers.value}
        units={units.value}
        onDone={() => {
          setStaffing(null)
        }}
      />
    )
  }

  const unitName = (unit: Unit | undefined) => unit?.name ?? t('deployments.hiddenUnit')
  const countOf = (deployment: Deployment) => members.value.filter((member) => member.deployment_id === deployment.id).length
  const newDeployment = () => {
    setFailure(null)
    panel.open(PANEL_IDS.deployments, { entity: NEW_ENTITY })
  }
  const actionsOf = (deployment: Deployment): RowAction[] => [
    ...(permissions.update(deployment)
      ? [
          {
            id: 'members',
            labelKey: 'deployments.editMembers' as const,
            icon: <Users aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setStaffing(deployment)
            },
          },
        ]
      : []),
    ...(permissions.archive(deployment)
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive' as const,
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(deployment)
            },
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-lg">
      {live.length === 0 ? (
        <EmptyNotice titleKey="deployments.emptyTitle" bodyKey={emptyBody(liveUnits.length > 0, permissions.createAny)}>
          {permissions.createAny ? (
            <Button variant="primary" onPress={newDeployment}>
              <Plus aria-hidden size={14} />
              {t('deployments.new')}
            </Button>
          ) : null}
        </EmptyNotice>
      ) : (
        <>
          {failure === null ? null : <FailureNotice error={failure} />}
          <ul aria-label={t('deployments.listLabel')} className="flex flex-col">
            {live.map((deployment) => (
              <DeploymentRow
                key={deployment.id}
                deployment={deployment}
                unitName={unitName(units.value.find((unit) => unit.id === deployment.unit_id))}
                memberCount={countOf(deployment)}
                active={isDeploymentActive(deployment, today)}
                canUpdate={permissions.update(deployment)}
                actions={actionsOf(deployment)}
              />
            ))}
          </ul>
          {permissions.createAny ? (
            <div>
              <Button onPress={newDeployment}>
                <Plus aria-hidden size={14} />
                {t('deployments.new')}
              </Button>
            </div>
          ) : null}
        </>
      )}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="deployments.archiveTitle"
          hintKey="deployments.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}

/** Without a live unit there is nowhere to place a deployment yet. */
function emptyBody(hasUnits: boolean, canCreate: boolean) {
  if (!hasUnits) return 'deployments.emptyNoUnits' as const
  return canCreate ? undefined : ('deployments.emptyReadOnly' as const)
}

/** The command's row while the list has not heard of it yet; once listed, the list decides (it may be archived). */
function justCreated(deployment: Deployment, listed: readonly Deployment[]): Deployment | undefined {
  return listed.some((candidate) => candidate.id === deployment.id) ? undefined : deployment
}

const NO_UNITS: readonly Unit[] = []
const NO_DEPLOYMENTS: readonly Deployment[] = []
