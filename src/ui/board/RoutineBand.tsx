import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import { usePanel, useQuickAction } from '@logic'
import { Button } from '../primitives/Button'

/**
 * Routine (D-257, D-296): a quiet band that names the mode and what opens it. Who may open a rotation does it from the
 * band: the tab bar holds no quick action of the role (D-455).
 */
export function RoutineBand() {
  const action = useQuickAction()
  const panel = usePanel()
  const bodyKey = action === 'open_rotation' ? 'workspace.routineOpenBody' : 'workspace.noRotationBody'
  return (
    <section
      aria-labelledby="routine-band"
      className="mx-lg mb-sm flex shrink-0 flex-wrap items-center justify-between gap-sm rounded-card bg-surface px-lg py-md"
    >
      <div className="flex flex-col gap-2xs">
        <h2 id="routine-band" className="text-body font-bold">
          {t('workspace.routineTitle')}
        </h2>
        <p className="text-small text-text-muted">{t(bodyKey)}</p>
      </div>
      {action === 'open_rotation' ? (
        <Button
          variant="primary"
          onPress={() => {
            panel.open(PANEL_IDS.deployments, { entity: NEW_ENTITY })
          }}
        >
          {t('workspace.openRotation')}
        </Button>
      ) : null}
    </section>
  )
}
