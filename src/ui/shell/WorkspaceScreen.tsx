import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useBoardFilters, useCurrentOrganization, useDateWindow } from '@logic'
import { useIsDesktop, useIsWidePhone } from '../patterns/media'
import { useAppliedAppearance } from './appearance'
import { ModuleButtons } from './ModuleButtons'
import { ModuleDrawer } from './ModuleDrawer'
import { DayReportDialog } from '../modules/presence/DayReportDialog'
import { NewLeaveButton } from './NewLeaveButton'
import { FilterBar, FilterControl } from './FilterBar'
import { SortControl } from './SortControl'
import { NavigationPanel } from './NavigationPanel'
import { FailureScreen, LoadingScreen } from './states'
import { UnitSelector } from './UnitSelector'
import { UserMenu } from './UserMenu'
import { FilterFocusContext, useFilterFocusScope } from './filterFocus'
import { TabBar } from './TabBar'
import { PreferenceFailureContext, usePreferenceFailureScope } from './preferenceFailure'
import { PreferenceFailureNotice } from './PreferenceFailureNotice'
import { ViewSwitcher } from './ViewSwitcher'
import { Viewport } from './Viewport'
import { WindowNavigator } from './WindowNavigator'

/**
 * The workspace (D-023, D-108, D-173, V20): the viewport fills the screen, and glass bars float over it. On desktop two
 * bars sit at the top: the menu, the scope, the view and the filters at the start; the range, the destinations and the
 * account at the end. On a phone the top bar holds only the range and the account, a row under it the scope, the view
 * and the filters, and the bottom bar the destinations, as tabs. A phone on its side keeps the tabs, and its wide top
 * bar takes the row's controls, so the short screen keeps its height for the board (D-190). Everything sits inside the
 * safe area; the canvas paints under the cutout (D-191).
 */

const BAR = 'glass-bar pointer-events-auto flex min-w-none items-center gap-xs rounded-pill p-xs'

/** The page's heading, for readers: the bar shows the unit in scope instead, so two names never compete (D-175). */
function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="sr-only">{name}</h1>
}

/** The board's filter controls (D-173). They need a day, as every engine does. */
function FilterControls() {
  const { window } = useDateWindow()
  if (window === null) return null
  return (
    <>
      <FilterControl />
      <SortControl />
    </>
  )
}

/** The row of set conditions under the desktop bars (D-131, D-173): there only while a condition is set. */
function FilterRow() {
  const { window } = useDateWindow()
  if (window === null) return null
  return (
    <div className="pointer-events-none absolute inset-x-lg top-filter-row flex md:top-filter-row-md">
      <FilterBar />
    </div>
  )
}

function DesktopBars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-lg top-lg flex justify-between gap-sm">
        <nav aria-label={t('workspace.viewBar')} className={BAR}>
          <NavigationPanel />
          <OrganizationName name={name} />
          <UnitSelector />
          <ViewSwitcher />
          <FilterControls />
        </nav>
        <nav aria-label={t('workspace.navigation')} className={`${BAR} min-w-none`}>
          <WindowNavigator />
          {/* Pins may outgrow the bar: they scroll sideways rather than push the account out (OI-110, D-173). */}
          <div className="-m-xs flex min-w-none items-center gap-xs overflow-x-auto p-xs">
            <ModuleButtons />
          </div>
          <UserMenu identity={identity} />
        </nav>
      </div>
      <FilterRow />
    </>
  )
}

/** The phone's row under the top bar (V20): the scope, the view and the filters, then the set conditions. It scrolls
 * sideways as one; its room above and below keeps the shadows whole and lets presses through to the board. */
function ContextRow() {
  const { window } = useDateWindow()
  return (
    <div className="pointer-events-none absolute inset-x-lg top-filter-row -my-xl flex items-center gap-sm overflow-x-auto py-xl">
      <nav aria-label={t('workspace.viewBar')} className={`${BAR} shrink-0`}>
        <UnitSelector />
        <ViewSwitcher />
        <FilterControls />
      </nav>
      {window === null ? null : <FilterBar />}
    </div>
  )
}

function BottomTabs({ name }: { readonly name: string }) {
  return (
    <nav aria-label={t('workspace.navigation')} className={`${BAR} absolute inset-x-lg bottom-lg`}>
      {/* The name is read aloud; the scope label says which unit is shown (D-173, D-175). */}
      <OrganizationName name={name} />
      <TabBar />
    </nav>
  )
}

function MobileBars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
    <>
      <nav aria-label={t('workspace.topBar')} className={`${BAR} absolute inset-x-lg top-lg justify-between`}>
        <WindowNavigator />
        <UserMenu identity={identity} />
      </nav>
      <ContextRow />
      <BottomTabs name={name} />
    </>
  )
}

/** A phone on its side (D-190): the desktop's top row without the menu and the destinations, which stay as tabs. */
function WidePhoneBars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-lg top-lg flex justify-between gap-sm">
        <nav aria-label={t('workspace.viewBar')} className={`${BAR} overflow-x-auto`}>
          <UnitSelector />
          <ViewSwitcher />
          <FilterControls />
        </nav>
        <nav aria-label={t('workspace.topBar')} className={`${BAR} shrink-0`}>
          <WindowNavigator />
          <UserMenu identity={identity} />
        </nav>
      </div>
      <FilterRow />
      <BottomTabs name={name} />
    </>
  )
}

function Bars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  const isDesktop = useIsDesktop()
  const isWidePhone = useIsWidePhone()
  if (isDesktop) return <DesktopBars name={name} identity={identity} />
  if (isWidePhone) return <WidePhoneBars name={name} identity={identity} />
  return <MobileBars name={name} identity={identity} />
}

export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const isDesktop = useIsDesktop()
  const isWidePhone = useIsWidePhone()
  const { active } = useBoardFilters()
  const { window } = useDateWindow()
  const focus = useFilterFocusScope()
  const preferenceFailure = usePreferenceFailureScope()
  useAppliedAppearance()
  if (organization.status === 'loading') return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />
  const name = organization.value?.name ?? t('app.name')

  return (
    // The row under the bars pushes the board's first row down while it shows: on an upright phone always, elsewhere
    // only while a condition is set (D-173, D-190).
    <FilterFocusContext value={focus}>
      <PreferenceFailureContext value={preferenceFailure}>
      <div
        data-filter-row={window !== null && (active || !(isDesktop || isWidePhone)) ? 'shown' : undefined}
        className="relative h-dvh bg-canvas"
      >
        <div className="absolute inset-safe p-sm">
          <main className="isolate h-full overflow-hidden rounded-panel border border-line bg-surface">
            <Viewport />
          </main>
          <NewLeaveButton />
          <Bars name={name} identity={identity} />
        </div>
        <ModuleDrawer />
        <DayReportDialog />
        <PreferenceFailureNotice />
      </div>
      </PreferenceFailureContext>
    </FilterFocusContext>
  )
}
