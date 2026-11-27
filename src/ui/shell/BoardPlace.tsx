import { t } from '@i18n'
import { useActiveView, useStartView, useWorkspaceSearch } from '@logic'
import { useEffect, useState, type ReactNode } from 'react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { TOOLTIP } from '@config'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { useViewDevice } from '../patterns/media'
import { NameTooltip } from '../primitives/Button'
import { useBoardShown } from './boardShown'
import type { BuilderTarget } from './builderOpen'
import { FilterBar, FilterButton } from './FilterBar'
import { useFocusMode } from './focusMode'
import { FocusModeRestore } from './FocusModeRestore'
import { RuleBuilder } from './RuleBuilder'
import { SavedViewDroppedNotice } from './SavedViewDroppedNotice'
import { UnitSelector } from './UnitSelector'
import { ViewSheet } from './ViewSheet'
import { Viewport } from './Viewport'
import { WindowNavigator } from './WindowNavigator'

/**
 * "לוח" (D-455, D-456): the board's engines as they are, in the new shell. The board fills the screen under one glass
 * strip of its controls: the unit in scope, the range, the view and "filter and sort". The set conditions show in a row
 * under it. Focus mode leaves one button (D-301). Everything sits inside the safe area (D-191).
 */

const BAR = 'glass-bar pointer-events-auto flex max-w-full min-w-none items-center gap-xs overflow-x-auto rounded-pill p-xs'

/** The page's heading, for readers: the strip shows the unit in scope instead, so two names never compete (D-175). */
function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="sr-only">{name}</h1>
}

/** The view picker (D-311): the icon of the view in sight opens the sheet of views, colors and saved views. */
function ViewButton() {
  const { view } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const [picking, setPicking] = useState(false)
  const focusMode = useFocusMode()
  const { Icon } = engineOf(view)
  const label = t('workspace.view')
  return (
    <>
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        {/* Focus returns here when focus mode ends (D-301): the view sheet it was entered from opens from this button. */}
        <AriaButton
          ref={focusMode.bind('control')}
          aria-label={label}
          onPress={() => {
            setPicking(true)
          }}
          className="inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center rounded-pill text-text-muted outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          <Icon aria-hidden size={18} />
        </AriaButton>
        <NameTooltip>{label}</NameTooltip>
      </TooltipTrigger>
      {picking ? (
        <ViewSheet
          onClose={() => {
            setPicking(false)
          }}
        />
      ) : null}
    </>
  )
}

/** The dates, the view and the filters are controls of the board: they exist only with it (D-218). */
function BoardControls() {
  if (!useBoardShown()) return null
  return (
    <>
      <WindowNavigator />
      <ViewButton />
      <FilterButton />
    </>
  )
}

/** The top strip: context, never a destination (D-252). */
function ContextStrip({ name }: { readonly name: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-lg top-lg flex justify-center">
      <nav aria-label={t('workspace.viewBar')} className={BAR}>
        <OrganizationName name={name} />
        {/* The unit's name gives way first, down to a floor; the rest keeps its size, and the strip scrolls after. */}
        <UnitSelector />
        <div className="flex shrink-0 items-center gap-xs">
          <BoardControls />
        </div>
      </nav>
    </div>
  )
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

/**
 * The first time the board is opened on an address that names nothing of it, it starts on the soldier's start view,
 * once their preferences are read (D-386). `started` is the workspace's, so a return to the board keeps what was left.
 */
function useStartOnce(started: boolean, onStarted: () => void) {
  const search = useWorkspaceSearch()
  const { settled, open } = useStartView()
  const bare = Object.entries(search).every(([key, value]) => key === 'tab' || value === undefined)
  useEffect(() => {
    if (started || !settled) return
    onStarted()
    if (bare) open()
  }, [started, onStarted, settled, bare, open])
}

export interface BoardPlaceProps {
  readonly name: string
  /** Whether the board was already opened since the workspace loaded, and the note that it now is. */
  readonly started: boolean
  readonly onStarted: () => void
  readonly building: BuilderTarget | null
  readonly onBuilt: () => void
  /** The tab bar, absent in focus mode. */
  readonly children: ReactNode
}

export function BoardPlace({ name, started, onStarted, building, onBuilt, children }: BoardPlaceProps) {
  const boardShown = useBoardShown()
  const focusMode = useFocusMode()
  useStartOnce(started, onStarted)
  return (
    <>
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
            <ContextStrip name={name} />
            <FilterRow />
            {children}
          </>
        )}
      </div>
      {boardShown ? <SavedViewDroppedNotice /> : null}
      {boardShown && building !== null ? <RuleBuilder target={building} onClose={onBuilt} /> : null}
    </>
  )
}
