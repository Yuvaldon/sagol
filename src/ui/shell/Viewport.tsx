import { useActiveView, useDateWindow } from '@logic'
import { EmptyNotice } from '../patterns/Notices'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'

// The central viewport (D-023): it shows the active engine from the registry. Every engine needs a
// date window, which needs today, so a soldier who may not view the organization sees a notice.

export function Viewport() {
  const { view } = useActiveView(AVAILABLE_VIEWS)
  const { window } = useDateWindow()
  if (window === null) {
    return (
      <div className="flex h-full items-center justify-center px-lg">
        <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
      </div>
    )
  }
  const { Engine } = engineOf(view)
  return <Engine />
}
