import { useCurrentOrganization, useDateWindow, useActiveView, useSoldiers } from '@logic'
import { EmptyNotice } from '../patterns/Notices'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'

// The central viewport (D-023): it shows the active engine from the registry. Every engine needs a date window, which
// needs today. A soldier who may not view the organization and reads no soldier at all sees a notice (D-151, D-160).

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

export function Viewport() {
  const { view } = useActiveView(AVAILABLE_VIEWS)
  const { window } = useDateWindow()
  const noBoard = useNoBoard()
  if (window === null || noBoard) {
    return (
      <div className="flex h-full items-center justify-center px-lg">
        <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
      </div>
    )
  }
  const { Engine } = engineOf(view)
  return <Engine />
}
