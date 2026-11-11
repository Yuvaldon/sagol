import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useCurrentOrganization, useDateWindow } from '@logic'
import { useIsDesktop } from '../patterns/media'
import { ModuleButtons } from './ModuleButtons'
import { ModuleDrawer } from './ModuleDrawer'
import { NewLeaveButton } from './NewLeaveButton'
import { FilterBar } from './FilterBar'
import { FailureScreen, LoadingScreen } from './states'
import { UnitSelector } from './UnitSelector'
import { UserMenu } from './UserMenu'
import { ViewSwitcher } from './ViewSwitcher'
import { Viewport } from './Viewport'
import { WindowNavigator } from './WindowNavigator'

/**
 * The workspace (D-023, D-108): the viewport fills the screen, and glass bars float over it. On desktop two
 * bars sit at the top, as in Stone 3. On mobile the dates and the unit sit at the top and the rest at the
 * bottom. Controls join the bars as their slices build them (D-076).
 */

const BAR = 'glass-bar pointer-events-auto flex min-w-none items-center gap-xs rounded-pill p-xs'

function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="min-w-none truncate px-md text-control font-bold">{name}</h1>
}

/** The filter row under the bars (D-131). It needs a day, as every engine does. */
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
          <OrganizationName name={name} />
          <UnitSelector />
          <ViewSwitcher />
        </nav>
        <nav aria-label={t('workspace.navigation')} className={BAR}>
          <WindowNavigator />
          <ModuleButtons />
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
        <WindowNavigator />
        <div className="flex min-w-none items-center gap-xs">
          <UnitSelector />
          <ViewSwitcher />
        </div>
      </nav>
      <FilterRow />
      <nav aria-label={t('workspace.navigation')} className={`${BAR} bottom-safe absolute inset-x-lg justify-between`}>
        <OrganizationName name={name} />
        <div className="flex min-w-none items-center gap-xs">
          {/* The modules scroll sideways when they outgrow the bar, so the bar never widens the page (D-155). Their room
              around them, the bar's own padding, keeps a focused module's outline whole. */}
          <div className="-m-xs flex min-w-none items-center gap-xs overflow-x-auto p-xs">
            <ModuleButtons />
          </div>
          <UserMenu identity={identity} />
        </div>
      </nav>
    </>
  )
}

export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const isDesktop = useIsDesktop()
  if (organization.status === 'loading') return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />
  const name = organization.value?.name ?? t('app.name')

  return (
    <div className="relative h-dvh bg-canvas p-sm">
      <main className="isolate h-full overflow-hidden rounded-panel border border-line bg-surface">
        <Viewport />
      </main>
      <NewLeaveButton />
      {isDesktop ? <DesktopBars name={name} identity={identity} /> : <MobileBars name={name} identity={identity} />}
      <ModuleDrawer />
    </div>
  )
}
