import { PANEL_IDS, type BarColorMode } from '@config'
import type { CalendarDate, FilterExpression, Leave } from '@contracts'
import { t } from '@i18n'
import {
  hasLeaveConditions,
  useBarColors,
  useBoard,
  useLeaveConditions,
  useLeaves,
  useModuleAccess,
  usePanel,
  usePresenceDay,
  useSetupUnfinished,
  useSortRules,
  useWorkspaceSearch,
  useViewFilter,
  type BoardConditions,
  type BoardModel,
  type DateWindow,
  type ReadRules,
} from '@logic'
import { ListChecks } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../patterns/Notices'
import { Button } from '../primitives/Button'
import { useOpenUnitSetup } from '../shell/unitSetup'

// What every engine shares around the board model (D-174): the window its view shows (D-480), the filter and the
// board's own conditions from the URL (D-103, D-104, D-131, D-132), the states of an empty or loading board, and how a
// soldier or a leave opens. An engine draws only the board it is handed, so the views never disagree on who is in view.

/** What an engine draws from. */
export interface BoardFrame {
  readonly model: BoardModel
  readonly window: DateWindow
  readonly filter: FilterExpression | null
  readonly colors: BarColorMode
  /** Opens a soldier's record. NULL when the actor may not open the soldiers module. */
  readonly openSoldier: ((soldierId: string) => void) | null
  /** Opens a leave's details: every leave on the board is a control (D-119). */
  readonly openLeave: (leaveId: string) => void
  /** Opens the day report on a day (D-193). NULL when the actor may not open the soldiers module; the day's own NULL
   *  when the scope has no rotation on it. */
  readonly openDay: ((day: CalendarDate) => (() => void) | null) | null
  /** The stored leaves of the window, by id: a request answered from the board is answered as stored (D-467). */
  readonly stored: ReadonlyMap<string, Leave>
}

/** A state of the board, in the middle of the viewport, clear of the bars. */
export function Centered({ children }: { readonly children: ReactNode }) {
  return <div className="flex h-full items-center justify-center px-lg">{children}</div>
}

/** Why the board is empty when soldiers exist: what the bar asks for, or the unit and the window (D-131 to D-133). */
function emptyKeys(board: BoardConditions, rules: ReadRules) {
  const chips =
    rules.kind === 'other' ||
    rules.filter.rules.length > 0 ||
    hasLeaveConditions(board.leaves)
  if (chips) return { titleKey: 'timeline.emptyFilterTitle', bodyKey: 'timeline.emptyFilterBody' } as const
  return { titleKey: 'timeline.emptyScopeTitle', bodyKey: 'timeline.emptyScopeBody' } as const
}

type Draw = (frame: BoardFrame) => ReactNode

function Board({
  model,
  board,
  rules,
  window,
  filter,
  draw,
  stored,
}: {
  readonly model: BoardModel
  readonly stored: ReadonlyMap<string, Leave>
  readonly board: BoardConditions
  readonly rules: ReadRules
  readonly window: DateWindow
  readonly filter: FilterExpression | null
  readonly draw: Draw
}) {
  const access = useModuleAccess()
  const canSetUp = useSetupUnfinished()
  // The setup's checklist is in "הגדרות היחידה" (D-297).
  const openUnitSetup = useOpenUnitSetup()
  const panel = usePanel()
  const { mode } = useBarColors()
  const { open } = panel
  const openSoldier = useCallback(
    (soldierId: string) => {
      open(PANEL_IDS.soldiers, { entity: soldierId })
    },
    [open],
  )
  const openLeave = useCallback(
    (leaveId: string) => {
      open(PANEL_IDS.leaves, { entity: leaveId })
    },
    [open],
  )
  const { reportable, openOn } = usePresenceDay()
  const openDay = useCallback(
    (day: CalendarDate) =>
      reportable(day)
        ? () => {
            openOn(day)
          }
        : null,
    [reportable, openOn],
  )

  if (model.rosterCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="timeline.emptyRosterTitle" bodyKey="timeline.emptyRosterBody" headingLevel={2}>
          {canSetUp ? (
            <Button
              variant="primary"
              onPress={openUnitSetup}
            >
              <ListChecks aria-hidden size={14} />
              {t('navigation.setupTitle')}
            </Button>
          ) : null}
        </EmptyNotice>
      </Centered>
    )
  }
  if (model.soldierCount === 0) {
    const empty = emptyKeys(board, rules)
    return (
      <Centered>
        <EmptyNotice titleKey={empty.titleKey} bodyKey={empty.bodyKey} headingLevel={2} />
      </Centered>
    )
  }
  return draw({ model, window, filter, colors: mode, openSoldier: access.soldiers ? openSoldier : null, openLeave, openDay: access.soldiers ? openDay : null, stored })
}

const NO_LEAVES: readonly Leave[] = []

function BoardData({
  window,
  today,
  keepLast,
  draw,
}: {
  readonly window: DateWindow
  readonly today: CalendarDate
  readonly keepLast: boolean
  readonly draw: Draw
}) {
  const { filter, rules } = useViewFilter()
  const { conditions } = useLeaveConditions()
  const { rules: sorts } = useSortRules()
  const { group: grouping } = useWorkspaceSearch()
  const board = useMemo((): BoardConditions => ({ leaves: conditions, sorts, grouping }), [conditions, sorts, grouping])
  const model = useBoard(window, today, filter, board)
  const leaves = useLeaves(window)
  const stored = useMemo(
    () => new Map((leaves.status === 'ready' ? leaves.value : NO_LEAVES).map((leave) => [leave.id, leave] as const)),
    [leaves],
  )
  // What a view that grows its window keeps on screen while the wider one is read, so it never jumps to a loading state.
  const [last, setLast] = useState<{ readonly model: BoardModel; readonly window: DateWindow } | null>(null)
  if (keepLast && model.status === 'ready' && last?.model !== model.value) setLast({ model: model.value, window })
  if (model.status === 'loading') {
    if (keepLast && last !== null) return <Board model={last.model} stored={stored} board={board} rules={rules} window={last.window} filter={filter} draw={draw} />
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
  return <Board model={model.value} stored={stored} board={board} rules={rules} window={window} filter={filter} draw={draw} />
}

/** The frame of every engine, on the window its view shows; `keepLast` keeps the last board while a wider one loads. */
export function BoardEngine({
  window,
  today,
  keepLast = false,
  children,
}: {
  readonly window: DateWindow | null
  readonly today: CalendarDate | null
  readonly keepLast?: boolean
  readonly children: Draw
}) {
  if (window === null || today === null) {
    return (
      <Centered>
        <LoadingNotice />
      </Centered>
    )
  }
  return <BoardData window={window} today={today} keepLast={keepLast} draw={children} />
}
