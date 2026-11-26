import { DEFAULT_TAB, TAB_IDS, type TabId } from '@config'
import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useBoardFilters, useCurrentOrganization, useOverlayHistory, useShellAccess, useShellPlace } from '@logic'
import { useCallback, useMemo, useState } from 'react'
import { DayReportDialog } from '../modules/presence/DayReportDialog'
import { useAppliedAppearance } from './appearance'
import { BoardPlace } from './BoardPlace'
import { useBoardShown, useNoBoard } from './boardShown'
import { BuilderOpenContext, type BuilderOpen, type BuilderTarget } from './builderOpen'
import { ShellChromeContext, useShellChromeScope } from './chrome'
import { FilterFocusContext, useFilterFocusScope } from './filterFocus'
import { FocusModeContext, useFocusModeScope } from './focusMode'
import { InstallInvitation } from './InstallInvitation'
import { ManagePage } from './manage/ManagePage'
import { useManageAccess } from './manage/rows'
import { MePage } from './me/MePage'
import { ModuleDrawer } from './ModuleDrawer'
import { PreferenceFailureContext, usePreferenceFailureScope } from './preferenceFailure'
import { PreferenceFailureNotice } from './PreferenceFailureNotice'
import { SavedViewNoticeContext, useSavedViewNoticeScope } from './savedViewNotice'
import { FailureScreen, LoadingScreen } from './states'
import { TabBar } from './TabBar'
import { TodayPage } from './today/TodayPage'

/**
 * The workspace (D-455): four destinations behind one floating tab bar, "היום", "לוח", "ניהול" and "אני", each for who
 * its permissions open it to. The destination lives in the URL; an address that names none, or one the actor does not
 * have, shows "היום". A module opens over any of them as a drawer. Everything sits inside the safe area; the canvas
 * paints under the cutout (D-191).
 */
export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const { active } = useBoardFilters()
  const place = useShellPlace()
  const answered = useShellAccess()
  // The answers are asked again whenever the soldiers in sight change. Until the new ones arrive the last ones stand,
  // so the screen and what is open over it never give way to a loading screen in the middle of work.
  const [settled, setSettled] = useState(answered)
  if (answered.ready && (!settled.ready || answered.board !== settled.board || answered.requestsForSelf !== settled.requestsForSelf)) {
    setSettled(answered)
  }
  const access = answered.ready ? answered : settled
  const manages = useManageAccess()
  const boardShown = useBoardShown()
  const noBoard = useNoBoard()
  const focus = useFilterFocusScope()
  const preferenceFailure = usePreferenceFailureScope()
  const savedViewNotice = useSavedViewNoticeScope()
  const chrome = useShellChromeScope()
  // What of "filter and sort" is open (D-312); the builder exists only with the board.
  const [building, setBuilding] = useState<BuilderTarget | null>(null)
  const builder = useMemo<BuilderOpen>(() => ({ open: setBuilding }), [])
  const [boardStarted, setBoardStarted] = useState(false)
  const startBoard = useCallback(() => {
    setBoardStarted(true)
  }, [])
  const tabs = useMemo(
    () => TAB_IDS.filter((tab) => (tab === 'board' ? access.board : tab === 'manage' ? manages : true)),
    [access.board, manages],
  )
  const tab: TabId = tabs.includes(place.tab) ? place.tab : DEFAULT_TAB
  const onBoard = tab === 'board'
  const focusMode = useFocusModeScope(onBoard && boardShown && !noBoard)
  useOverlayHistory()
  useAppliedAppearance()
  if (organization.status === 'loading' || !access.ready) return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />
  const name = organization.value?.name ?? t('app.name')
  const bar = <TabBar tabs={tabs} current={tab} action={access.requestsForSelf} />

  return (
    <FilterFocusContext value={focus}>
      <BuilderOpenContext value={builder}>
      <PreferenceFailureContext value={preferenceFailure}>
      <SavedViewNoticeContext value={savedViewNotice}>
      <FocusModeContext value={focusMode}>
      <ShellChromeContext value={chrome}>
      <div
        // The row under the board's strip pushes its first row down while a condition is set (D-173, D-252).
        data-filter-row={onBoard && boardShown && active && !focusMode.on ? 'shown' : undefined}
        data-focus-mode={focusMode.on ? 'on' : undefined}
        className="relative h-dvh bg-canvas"
      >
        {onBoard ? (
          <BoardPlace
            name={name}
            started={boardStarted}
            onStarted={startBoard}
            building={building}
            onBuilt={() => {
              setBuilding(null)
            }}
          >
            {bar}
          </BoardPlace>
        ) : (
          <>
            {tab === 'today' ? <TodayPage name={name} commands={access.board} requests={access.requestsForSelf} /> : null}
            {tab === 'manage' ? <ManagePage name={name} /> : null}
            {tab === 'me' ? <MePage identity={identity} /> : null}
            <div className="pointer-events-none absolute inset-safe">{bar}</div>
          </>
        )}
        <ModuleDrawer />
        <DayReportDialog />
        <PreferenceFailureNotice />
        <InstallInvitation />
      </div>
      </ShellChromeContext>
      </FocusModeContext>
      </SavedViewNoticeContext>
      </PreferenceFailureContext>
      </BuilderOpenContext>
    </FilterFocusContext>
  )
}
