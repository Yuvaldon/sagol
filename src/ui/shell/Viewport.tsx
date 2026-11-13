import { t } from '@i18n'
import { useActiveView, useDateWindow, useQuickAction, useRotationScope } from '@logic'
import { EmptyNotice, LoadingNotice } from '../patterns/Notices'
import { useViewDevice } from '../patterns/media'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { useNoBoard } from './boardShown'

// The central viewport (D-023): it shows the active engine from the registry. Every engine needs a date window, which
// needs today. A soldier who may not view the organization and reads no soldier at all sees a notice (D-151, D-160).
// A window that is not there yet, while the rotations it opens on load, is a board that loads, never that notice (D-330).
// In routine (שגרה), with no rotation in scope, the board still shows, under a band that says so (D-257, D-296).

const CENTERED = 'flex h-full items-center justify-center px-lg'

/**
 * Routine (D-257, D-296): a quiet band that names the mode and what opens it, with no action of its own; the quick
 * action in the bottom strip opens a rotation.
 */
function RoutineBand() {
  const action = useQuickAction()
  const bodyKey = action === 'open_rotation' ? 'workspace.routineOpenBody' : 'workspace.noRotationBody'
  return (
    <section
      aria-labelledby="routine-band"
      className="flex flex-wrap items-center justify-between gap-sm border-b border-line bg-inner px-lg pt-under-bars pb-sm md:pt-under-bars-md"
    >
      <div className="flex flex-col gap-2xs">
        <h2 id="routine-band" className="text-name font-bold">
          {t('workspace.routineTitle')}
        </h2>
        <p className="text-label text-text-muted">{t(bodyKey)}</p>
      </div>
    </section>
  )
}

export function Viewport() {
  const { view } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const { window } = useDateWindow()
  const scope = useRotationScope()
  const noBoard = useNoBoard()
  if (noBoard) {
    return (
      <div className={CENTERED}>
        <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
      </div>
    )
  }
  if (window === null) {
    return (
      <div className={CENTERED}>
        <LoadingNotice />
      </div>
    )
  }
  const { Engine } = engineOf(view)
  if (!(scope.ready && scope.none)) return <Engine />
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <RoutineBand />
      {/* The band clears the floating bars, so the board under it starts at its top. */}
      <div className="flex-1 overflow-hidden below-bars">
        <Engine />
      </div>
    </div>
  )
}
