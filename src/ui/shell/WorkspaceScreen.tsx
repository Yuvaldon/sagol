import { useMemo, useState, type ReactNode } from 'react'
import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useBoardFilters, useCurrentOrganization } from '@logic'
import { useBoardShown, useNoBoard } from './boardShown'
import { useAppliedAppearance } from './appearance'
import { ModuleDrawer } from './ModuleDrawer'
import { DayReportDialog } from '../modules/presence/DayReportDialog'
import { QuickActionButton } from './QuickActionButton'
import { FilterBar, FilterButton } from './FilterBar'
import { BuilderOpenContext, type BuilderOpen, type BuilderTarget } from './builderOpen'
import { RuleBuilder } from './RuleBuilder'
import { FailureScreen, LoadingScreen } from './states'
import { UnitSelector } from './UnitSelector'
import { UserMenu } from './UserMenu'
import { FilterFocusContext, useFilterFocusScope } from './filterFocus'
import { TabBar } from './TabBar'
import { HomeLanding } from './HomeLanding'
import { PreferenceFailureContext, usePreferenceFailureScope } from './preferenceFailure'
import { NavigationPanelContext, useNavigationPanelScope } from './navigationPanelState'
import { InstallInvitation } from './InstallInvitation'
import { PreferenceFailureNotice } from './PreferenceFailureNotice'
import { Viewport } from './Viewport'
import { WindowNavigator } from './WindowNavigator'
import { FocusModeContext, useFocusModeScope } from './focusMode'
import { FocusModeRestore } from './FocusModeRestore'

/**
 * The workspace (D-023, D-108, D-252): the viewport fills the screen, and two glass pills float over it, the same on
 * every screen size and orientation. The top strip is context: the unit in scope, the range, "filter and sort", and
 * the account at its inline end; the view is picked from the board's tab (D-311). The bottom strip holds the destinations and the role's quick action. Each hugs its content and
 * centers on its edge, and scrolls sideways inside itself only when its content cannot fit. Everything sits inside the
 * safe area; the canvas paints under the cutout (D-191).
 */

const BAR = 'glass-bar pointer-events-auto flex max-w-full min-w-none items-center gap-xs overflow-x-auto rounded-pill p-xs'

/** The page's heading, for readers: the strip shows the unit in scope instead, so two names never compete (D-175). */
function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="sr-only">{name}</h1>
}

/** "Filter and sort" (D-312), a control of the board: it exists only with it (D-218). */
function FilterControls() {
  if (!useBoardShown()) return null
  return <FilterButton />
}

/** The dates: a control of the board, so it exists only with it (D-218). */
function BoardControl({ children }: { readonly children: ReactNode }) {
  return useBoardShown() ? children : null
}

/** The row of set conditions under the top strip (D-131, D-213): there only while a condition is set. */
function FilterRow() {
  if (!useBoardShown()) return null
  return (
    <div className="pointer-events-none absolute inset-x-lg top-filter-row flex justify-center md:top-filter-row-md">
      <FilterBar />
    </div>
  )
}

/** The top strip: context, never a destination (D-252). */
function ContextStrip({ name, identity }: { readonly name: string; readonly identity: AuthIdentity }) {
  return (
    <div className="pointer-events-none absolute inset-x-lg top-lg flex justify-center">
      <nav aria-label={t('workspace.viewBar')} className={BAR}>
        <OrganizationName name={name} />
        {/* The unit's name gives way first, down to a floor; the rest keeps its size, and the strip scrolls after. */}
        <UnitSelector />
        <div className="flex shrink-0 items-center gap-xs">
          <BoardControl>
            <WindowNavigator />
          </BoardControl>
          <FilterControls />
          <UserMenu identity={identity} />
        </div>
      </nav>
    </div>
  )
}

/** The bottom strip: the daily destinations, then "ניהול", then the role's quick action (D-252, D-254, D-266). */
function DestinationStrip() {
  return (
    <div className="pointer-events-none absolute inset-x-lg bottom-lg flex justify-center">
      <nav aria-label={t('workspace.navigation')} className={BAR}>
        <TabBar />
        <QuickActionButton />
      </nav>
    </div>
  )
}

export function WorkspaceScreen({ identity }: { readonly identity: AuthIdentity }) {
  const organization = useCurrentOrganization()
  const { active } = useBoardFilters()
  const boardShown = useBoardShown()
  const focus = useFilterFocusScope()
  const preferenceFailure = usePreferenceFailureScope()
  const noBoard = useNoBoard()
  const focusMode = useFocusModeScope(boardShown && !noBoard)
  // What of "filter and sort" is open (D-312); the builder exists only with the board.
  const [building, setBuilding] = useState<BuilderTarget | null>(null)
  const builder = useMemo<BuilderOpen>(() => ({ open: setBuilding }), [])
  const navigation = useNavigationPanelScope()
  useAppliedAppearance()
  if (organization.status === 'loading') return <LoadingScreen />
  if (organization.status === 'failed') return <FailureScreen error={organization.error} />
  const name = organization.value?.name ?? t('app.name')

  return (
    // The row under the top strip pushes the board's first row down while a condition is set (D-173, D-252).
    <FilterFocusContext value={focus}>
      <BuilderOpenContext value={builder}>
      <PreferenceFailureContext value={preferenceFailure}>
      <NavigationPanelContext value={navigation}>
      <FocusModeContext value={focusMode}>
      <div
        data-filter-row={boardShown && active && !focusMode.on ? 'shown' : undefined}
        data-focus-mode={focusMode.on ? 'on' : undefined}
        className="relative h-dvh bg-canvas"
      >
        <div className="absolute inset-safe p-sm">
          <main className="isolate h-full overflow-hidden rounded-panel border border-line bg-surface">
            <Viewport />
          </main>
          {focusMode.on ? (
            // Focus mode leaves one button; the page's heading stays for readers, in its landmark (D-301).
            <FocusModeRestore>
              <OrganizationName name={name} />
            </FocusModeRestore>
          ) : (
            <>
              <ContextStrip name={name} identity={identity} />
              <FilterRow />
              <DestinationStrip />
            </>
          )}
        </div>
        <HomeLanding />
        <ModuleDrawer />
        <DayReportDialog />
        <PreferenceFailureNotice />
        <InstallInvitation />
        {boardShown && building !== null ? (
          <RuleBuilder
            target={building}
            onClose={() => {
              setBuilding(null)
            }}
          />
        ) : null}
      </div>
      </FocusModeContext>
      </NavigationPanelContext>
      </PreferenceFailureContext>
      </BuilderOpenContext>
    </FilterFocusContext>
  )
}
