import { PANEL_IDS } from '@config'
import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useCurrentOrganization, useModuleAccess, usePanel } from '@logic'
import { Network, Users } from 'lucide-react'
import { useIsDesktop } from '../patterns/media'
import { Button } from '../primitives/Button'
import { ModuleDrawer } from './ModuleDrawer'
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

function ModuleButtons() {
  const access = useModuleAccess()
  const panel = usePanel()
  return (
    <>
      {access.units ? (
        <Button
          onPress={() => {
            panel.open(PANEL_IDS.units)
          }}
        >
          <Network aria-hidden size={14} />
          {t('units.open')}
        </Button>
      ) : null}
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
    </>
  )
}

function DesktopBars({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
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
      <nav aria-label={t('workspace.navigation')} className={`${BAR} bottom-safe absolute inset-x-lg justify-between`}>
        <OrganizationName name={name} />
        <div className="flex shrink-0 items-center gap-xs">
          <ModuleButtons />
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
      {isDesktop ? <DesktopBars name={name} identity={identity} /> : <MobileBars name={name} identity={identity} />}
      <ModuleDrawer />
    </div>
  )
}
