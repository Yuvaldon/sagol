import { DEFAULT_TAB, FULL_SCREEN_PAGES, TAB_IDS, type TabId } from '@config'
import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useCurrentOrganization, useOverlayHistory, useShellAccess, useShellPlace } from '@logic'
import { useCallback, useMemo, useState } from 'react'
import { SheetIntentContext, useSheetIntentScope } from '../board/sheetIntent'
import { DayReportDialog } from '../modules/presence/DayReportDialog'
import { useAppliedAppearance } from './appearance'
import { BoardPlace } from './BoardPlace'
import { useBoardShown, useNoBoard } from './boardShown'
import { BuilderOpenContext, type BuilderOpen, type BuilderTarget } from './builderOpen'
import { ShellChromeContext, useShellChromeScope } from './chrome'
import { FocusModeContext, useFocusModeScope } from './focusMode'
import { InstallInvitation } from './InstallInvitation'
import { LeaveDrawer } from './LeaveDrawer'
import { JoinDrawer } from './manage/JoinDrawer'
import { ManagePage } from './manage/ManagePage'
import { RuleDrawer } from './manage/RuleDrawer'
import { useManageAccess } from './manage/rows'
import { NoticeScope } from './NoticeScope'
import { NotificationsDrawer } from './NotificationsDrawer'
import { PersonDrawer } from './PersonDrawer'
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
  const place = useShellPlace()
  const answered = useShellAccess()
  // The answers are asked again whenever the soldiers in sight change. Until the new ones arrive the last ones stand,
  // so the screen and what is open over it never give way to a loading screen in the middle of work.
  const [settled, setSettled] = useState(answered)
  const moved = answered.board !== settled.board || answered.requestsForSelf !== settled.requestsForSelf || answered.approvals !== settled.approvals
  if (answered.ready && (!settled.ready || moved)) {
    setSettled(answered)
  }
  const access = answered.ready ? answered : settled
  const manages = useManageAccess()
  const boardShown = useBoardShown()
  const noBoard = useNoBoard()
  const sheetIntent = useSheetIntentScope()
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
    <SheetIntentContext value={sheetIntent}>
      <BuilderOpenContext value={builder}>
      <PreferenceFailureContext value={preferenceFailure}>
      <SavedViewNoticeContext value={savedViewNotice}>
      <FocusModeContext value={focusMode}>
      <ShellChromeContext value={chrome}>
      <NoticeScope>
      <div
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
            {tab === 'today' ? <TodayPage name={name} commands={access.board} requests={access.requestsForSelf} approvals={access.approvals} /> : null}
            {tab === 'manage' ? <ManagePage name={name} /> : null}
            {tab === 'me' ? <MePage identity={identity} requests={access.requestsForSelf} /> : null}
            {/* A temporary full screen has no tab bar (the handoff's placement map). */}
            {place.page !== null && FULL_SCREEN_PAGES.includes(place.page) ? null : <div className="pointer-events-none absolute inset-safe">{bar}</div>}
          </>
        )}
        <ModuleDrawer />
        <LeaveDrawer />
        <PersonDrawer />
        <RuleDrawer />
        <JoinDrawer />
        <NotificationsDrawer />
        <DayReportDialog />
        <PreferenceFailureNotice />
        <InstallInvitation />
      </div>
      </NoticeScope>
      </ShellChromeContext>
      </FocusModeContext>
      </SavedViewNoticeContext>
      </PreferenceFailureContext>
      </BuilderOpenContext>
    </SheetIntentContext>
  )
}
