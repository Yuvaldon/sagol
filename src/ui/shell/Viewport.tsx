import { useToday } from '@logic'
import { EmptyNotice, LoadingNotice } from '../patterns/Notices'
import { useBoardView } from '../board/views'
import { engineOf } from '../engines/registry'
import { useNoBoard } from './boardShown'

// The central viewport (D-023): it shows the active engine from the registry, each in the board's frame (D-480). Every
// engine needs today. A soldier who may not view the organization and reads no soldier at all sees a notice (D-151,
// D-160). In routine (שגרה), with no rotation in scope, the board still shows, under a band that says so (D-257, D-296).

const CENTERED = 'flex h-full items-center justify-center px-lg'

export function Viewport() {
  const { view } = useBoardView()
  const today = useToday()
  const noBoard = useNoBoard()
  if (noBoard) {
    return (
      <div className={CENTERED}>
        <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
      </div>
    )
  }
  if (today === null) {
    return (
      <div className={CENTERED}>
        <LoadingNotice />
      </div>
    )
  }
  const { Engine } = engineOf(view)
  return <Engine />
}
