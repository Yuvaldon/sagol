import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useBoardFilters, useCurrentOrganization, useDateWindow } from '@logic'
import { useIsDesktop } from '../patterns/media'
import { ModuleButtons } from './ModuleButtons'
import { ModuleDrawer } from './ModuleDrawer'
import { NewLeaveButton } from './NewLeaveButton'
import { FilterBar, FilterControl, OnlyMissingSwitch, PresenceButton } from './FilterBar'
import { NavigationPanel } from './NavigationPanel'
import { FailureScreen, LoadingScreen } from './states'
import { UnitSelector } from './UnitSelector'
import { UserMenu } from './UserMenu'
import { FilterFocusContext, useFilterFocusScope } from './filterFocus'
import { ViewSwitcher } from './ViewSwitcher'
import { Viewport } from './Viewport'
import { WindowNavigator } from './WindowNavigator'

/**
 * The workspace (D-023, D-108, D-173): the viewport fills the screen, and glass bars float over it. The bars hold the
 * daily work; the modules that set the organization up sit in the navigation panel behind the menu button. On desktop
 * two bars sit at the top. On mobile the menu, the dates and the scope sit at the top and the rest at the bottom.
 */

const BAR = 'glass-bar pointer-events-auto flex min-w-none items-center gap-xs rounded-pill p-xs'

/** The page's heading, for readers: the bar shows the unit in scope instead, so two names never compete (D-175). */
function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="sr-only">{name}</h1>
}

/** The board's filter controls in the bar (D-173). They need a day, as every engine does. */
function FilterControls() {
  const { window } = useDateWindow()
  if (window === null) return null
  return (
    <>
      <FilterControl />
      <OnlyMissingSwitch />
      <PresenceButton />
    </>
  )
}

/** The row of set conditions under the bars (D-131, D-173): there only while a condition is set. */
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
          {/* Pins may outgrow the bar: they scroll sideways rather than push the name out (OI-110, D-173). */}
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

function MobileBars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
    <>
      <nav aria-label={t('workspace.viewBar')} className={`${BAR} absolute inset-x-lg top-lg justify-between`}>
        <div className="flex min-w-none items-center gap-xs">
          <NavigationPanel />
          <WindowNavigator />
        </div>
        <div className="flex min-w-none items-center gap-xs">
          <UnitSelector />
          <ViewSwitcher />
        </div>
      </nav>
      <FilterRow />
      <nav aria-label={t('workspace.navigation')} className={`${BAR} bottom-safe absolute inset-x-lg justify-between`}>
        {/* The name is read aloud; the scope label at the top says which unit is shown (D-173, D-175). */}
        <OrganizationName name={name} />
        {/* The controls scroll sideways when they outgrow the bar, so the bar never widens the page (D-155). Their room
            around them, the bar's own padding, keeps a focused control's outline whole. */}
        <div className="-m-xs flex min-w-none items-center gap-xs overflow-x-auto p-xs">
          <FilterControls />
          <ModuleButtons />
        </div>
        <UserMenu identity={identity} />
      </nav>
    </>
  )
}

export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const isDesktop = useIsDesktop()
  const { active } = useBoardFilters()
  const { window } = useDateWindow()
  const focus = useFilterFocusScope()
  if (organization.status === 'loading') return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />
  const name = organization.value?.name ?? t('app.name')

  return (
    // The row of set conditions pushes the board's first row down only while it shows (D-173).
    <FilterFocusContext value={focus}>
      <div data-filter-row={active && window !== null ? 'shown' : undefined} className="relative h-dvh bg-canvas p-sm">
        <main className="isolate h-full overflow-hidden rounded-panel border border-line bg-surface">
          <Viewport />
        </main>
        <NewLeaveButton />
        {isDesktop ? <DesktopBars name={name} identity={identity} /> : <MobileBars name={name} identity={identity} />}
        <ModuleDrawer />
      </div>
    </FilterFocusContext>
  )
}
