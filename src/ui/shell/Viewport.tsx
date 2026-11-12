import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import {
  useActiveView,
  useCurrentOrganization,
  useDateWindow,
  useDeploymentPermissions,
  usePanel,
  useRotationScope,
  useSoldiers,
  useUnitPermissions,
  useUnits,
} from '@logic'
import { EmptyNotice } from '../patterns/Notices'
import { Button } from '../primitives/Button'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'

// The central viewport (D-023): it shows the active engine from the registry. Every engine needs a date window, which
// needs today. A soldier who may not view the organization and reads no soldier at all sees a notice (D-151, D-160).
// In routine (שגרה), with no rotation in scope, the board still shows, under a band that says so (D-257, D-222).

function useNoBoard(): boolean {
  const organization = useCurrentOrganization()
  const soldiers = useSoldiers()
  return (
    organization.status === 'ready' &&
    organization.value === null &&
    soldiers.status === 'ready' &&
    soldiers.value.length === 0
  )
}

const CENTERED = 'flex h-full items-center justify-center px-lg'

const NO_UNITS: readonly never[] = []

/**
 * Routine (D-257, D-222): who may open a rotation opens it here; anyone else reads who does. A rotation belongs to a
 * unit, so before any unit exists, who may found the tree is sent to found it first.
 */
function RoutineBand() {
  const { rotations } = useDateWindow()
  const units = useUnits()
  const panel = usePanel()
  const live = units.status === 'ready' ? units.value : NO_UNITS
  const { createAny } = useDeploymentPermissions(live, rotations)
  const tree = useUnitPermissions(live)
  const foundFirst = !createAny && units.status === 'ready' && live.length === 0 && tree.createUnder(null)
  const bodyKey = foundFirst ? 'deployments.emptyNoUnits' : createAny ? 'workspace.routineOpenBody' : 'workspace.noRotationBody'
  return (
    <section
      aria-labelledby="routine-band"
      className="flex flex-wrap items-center justify-between gap-sm border-b border-line bg-inner px-lg py-sm"
    >
      <div className="flex flex-col gap-2xs">
        <h2 id="routine-band" className="text-name font-bold">
          {t('workspace.routineTitle')}
        </h2>
        <p className="text-label text-text-muted">{t(bodyKey)}</p>
      </div>
      {createAny || foundFirst ? (
        <Button
          variant="primary"
          onPress={() => {
            panel.open(foundFirst ? PANEL_IDS.units : PANEL_IDS.deployments, { entity: NEW_ENTITY })
          }}
        >
          {t(foundFirst ? 'workspace.foundUnits' : 'workspace.openRotation')}
        </Button>
      ) : null}
    </section>
  )
}

export function Viewport() {
  const { view } = useActiveView(AVAILABLE_VIEWS)
  const { window } = useDateWindow()
  const scope = useRotationScope()
  const noBoard = useNoBoard()
  if (window === null || noBoard) {
    return (
      <div className={CENTERED}>
        <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
      </div>
    )
  }
  const { Engine } = engineOf(view)
  if (!(scope.ready && scope.none)) return <Engine />
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <RoutineBand />
      <div className="flex-1 overflow-hidden">
        <Engine />
      </div>
    </div>
  )
}
