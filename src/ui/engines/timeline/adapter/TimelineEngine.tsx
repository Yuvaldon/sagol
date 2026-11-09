import { PANEL_IDS } from '@config'
import type { CalendarDate, FilterExpression } from '@contracts'
import { t } from '@i18n'
import {
  useDateWindow,
  useModuleAccess,
  usePanel,
  useTimeline,
  useViewFilter,
  type DateWindow,
  type TimelineModel,
} from '@logic'
import { Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../../patterns/Notices'
import { Button } from '../../../primitives/Button'
import { TimelineGrid } from '../view/TimelineGrid'
import { dayCells, timelineRows } from './model'

// The timeline as the viewport shows it. The adapter is the only part that meets the domain (model.ts).
// Window and filter come from the URL through
// `logic`, the same state every engine reads (D-103, D-104).

/** A state of the board, in the middle of the viewport, clear of the bars. */
function Centered({ children }: { readonly children: ReactNode }) {
  return <div className="flex h-full items-center justify-center px-lg">{children}</div>
}

function Board({ model }: { readonly model: TimelineModel }) {
  const access = useModuleAccess()
  const panel = usePanel()
  const open = access.soldiers
    ? (soldierId: string) => {
        panel.open(PANEL_IDS.soldiers, { entity: soldierId })
      }
    : null

  if (model.rosterCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="timeline.emptyRosterTitle" bodyKey="timeline.emptyRosterBody" headingLevel={2}>
        {access.soldiers ? (
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.soldiers)
            }}
          >
            <Users aria-hidden size={14} />
            {t('soldiers.open')}
          </Button>
        ) : null}
        </EmptyNotice>
      </Centered>
    )
  }
  if (model.soldierCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="timeline.emptyScopeTitle" bodyKey="timeline.emptyScopeBody" headingLevel={2} />
      </Centered>
    )
  }
  return <TimelineGrid days={dayCells(model.days, model.today)} rows={timelineRows(model.items, model.days, open)} />
}

function TimelineData({
  window,
  today,
  filter,
}: {
  readonly window: DateWindow
  readonly today: CalendarDate
  readonly filter: FilterExpression | null
}) {
  const model = useTimeline(window, today, filter)
  if (model.status === 'loading') {
    return (
      <Centered>
        <LoadingNotice />
      </Centered>
    )
  }
  if (model.status === 'failed') {
    return (
      <Centered>
        <FailureNotice error={model.error} />
      </Centered>
    )
  }
  return <Board model={model.value} />
}

/** The timeline engine. The viewport shows it only once today is known. */
export function TimelineEngine() {
  const { window, today } = useDateWindow()
  const { filter } = useViewFilter()
  if (window === null || today === null) return null
  return <TimelineData window={window} today={today} filter={filter} />
}
