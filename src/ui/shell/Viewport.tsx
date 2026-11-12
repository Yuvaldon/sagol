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

/** Who may open a rotation opens it here; anyone else reads who does (D-218). */
function NoRotation() {
  const { rotations } = useDateWindow()
  const units = useUnits()
  const panel = usePanel()
  const { createAny } = useDeploymentPermissions(units.status === 'ready' ? units.value : [], rotations)
  return (
    <div className={CENTERED}>
      <EmptyNotice titleKey="workspace.noRotationTitle" bodyKey={createAny ? undefined : 'workspace.noRotationBody'} headingLevel={2}>
        {createAny ? (
          <Button
            variant="primary"
            onPress={() => {
              panel.open(PANEL_IDS.deployments, { entity: NEW_ENTITY })
            }}
          >
            {t('workspace.openRotation')}
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
