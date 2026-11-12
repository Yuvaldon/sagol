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
// With no rotation running or to come in scope, the viewport holds "no active rotation" instead (D-218).

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
 * Who may open a rotation opens it here; anyone else reads who does (D-218). A rotation belongs to a unit, so before
 * any unit exists, who may found the tree is sent to found it first.
 */
function NoRotation() {
  const { rotations } = useDateWindow()
  const units = useUnits()
  const panel = usePanel()
  const live = units.status === 'ready' ? units.value : NO_UNITS
  const { createAny } = useDeploymentPermissions(live, rotations)
  const tree = useUnitPermissions(live)
  const foundFirst = !createAny && units.status === 'ready' && live.length === 0 && tree.createUnder(null)
  const bodyKey = foundFirst ? 'deployments.emptyNoUnits' : createAny ? undefined : 'workspace.noRotationBody'
  return (
    <div className={CENTERED}>
      <EmptyNotice titleKey="workspace.noRotationTitle" bodyKey={bodyKey} headingLevel={2}>
        {createAny || foundFirst ? (
          <Button
            variant="primary"
            onPress={() => {
              panel.open(foundFirst ? PANEL_IDS.units : PANEL_IDS.deployments, { entity: NEW_ENTITY })
            }}
          >
            {t(foundFirst ? 'units.new' : 'workspace.openRotation')}
          </Button>
        ) : null}
      </EmptyNotice>
    </div>
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
  if (scope.ready && scope.none) return <NoRotation />
  const { Engine } = engineOf(view)
  return <Engine />
}
