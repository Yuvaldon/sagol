import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useRotationScope, useSavedViews, useToday } from '@logic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { GlassCapsule } from '../kit/Glass'
import { useBoardView } from './views'
import { useShellChrome } from '../shell/chrome'
import { useFocusMode } from '../shell/focusMode'
import { SavedViewsSheet } from '../shell/SavedViewsSheet'
import { RoutineBand } from './RoutineBand'
import { BoardOptions } from './BoardOptions'
import { monthTitle } from './title'
import { ViewFan } from './ViewFan'

// The frame of every view of the board (the handoff's board spec, §2; D-480). The title is always the month, never
// "לוח"; beside it, arrows that step the view, the tap path of a swipe (D-458). On the inline end, a glass capsule with
// the view switcher and the options, and "היום" only once the view has left today. Focus mode leaves a small capsule
// in the middle with the month or the range; a tap on it ends focus. While days are picked, the tray stands in the tab
// bar's place.

const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const ARROW = `inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted data-disabled:cursor-default data-disabled:opacity-60 ${FOCUS}`
const ICON = 18

export interface BoardSteps {
  readonly previousKey: I18nKey
  readonly nextKey: I18nKey
  readonly canStep: (step: -1 | 1) => boolean
  readonly step: (step: -1 | 1) => void
}

export interface BoardHeadProps {
  /** A day of the month the view is on: the title names it. */
  readonly month: CalendarDate | null
  /** What focus mode's capsule says: the month, or the range on the timeline. */
  readonly focusTitle?: string | undefined
  readonly steps: BoardSteps | null
  /** The view has left today: "היום" shows, and brings it back. */
  readonly away: boolean
  readonly onToday: () => void
}

function Head({ month, steps, away, onToday, onSavedViews }: BoardHeadProps & { readonly onSavedViews: (() => void) | null }) {
  const today = useToday()
  const { view, phone } = useBoardView()
  const [fanned, setFanned] = useState(false)
  return (
    <header className="flex min-h-under-bars shrink-0 items-center gap-xs px-lg pt-xs md:min-h-under-bars-md">
      <div className={`flex min-w-none flex-1 items-center gap-2xs transition-opacity duration-ui ease-standard ${fanned ? 'opacity-40' : ''}`}>
        <h2 aria-live="polite" className="min-w-none truncate text-title font-bold tracking-tight">
          {month === null ? null : monthTitle(month, today)}
        </h2>
        {steps === null ? null : (
          <div className="flex shrink-0 items-center">
            <AriaButton
              aria-label={t(steps.previousKey)}
              isDisabled={!steps.canStep(-1)}
              onPress={() => {
                steps.step(-1)
              }}
              className={ARROW}
            >
              <ChevronRight aria-hidden size={ICON} />
            </AriaButton>
            <AriaButton
              aria-label={t(steps.nextKey)}
              isDisabled={!steps.canStep(1)}
              onPress={() => {
                steps.step(1)
              }}
              className={ARROW}
            >
              <ChevronLeft aria-hidden size={ICON} />
            </AriaButton>
          </div>
        )}
      </div>
      {away ? (
        <AriaButton
          onPress={onToday}
          className={`glass-regular inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full px-lg text-body font-bold text-text ${FOCUS}`}
        >
          <span className="sr-only">{t('workspace.today')}</span>
          <span aria-hidden>{t('board.today')}</span>
        </AriaButton>
      ) : null}
      <GlassCapsule>
        <BoardOptions view={view} phone={phone} onSavedViews={onSavedViews} />
        <ViewFan open={fanned} onOpenChange={setFanned} onSavedViews={onSavedViews} />
      </GlassCapsule>
    </header>
  )
}

/** Focus mode's one control (D-301): the month or the range, in the middle; a tap ends focus. */
function FocusCapsule({ title }: { readonly title: string }) {
  const { leave, bind } = useFocusMode()
  return (
    <div className="flex shrink-0 justify-center px-lg pt-xs">
      <AriaButton
        ref={bind('restore')}
        aria-label={[t('workspace.focusExit'), title].join(' · ')}
        onPress={leave}
        className={`glass-regular inline-flex min-h-touch cursor-pointer items-center rounded-full px-lg text-body font-bold text-text ${FOCUS}`}
      >
        {title}
      </AriaButton>
    </div>
  )
}

export interface BoardScreenProps {
  readonly head: BoardHeadProps
  /** What stands in the tab bar's place while days are picked. */
  readonly tray?: ReactNode
  readonly children: ReactNode
}

export function BoardScreen({ head, tray = null, children }: BoardScreenProps) {
  const focusMode = useFocusMode()
  const { view } = useBoardView()
  const saved = useSavedViews(view)
  const scope = useRotationScope()
  const today = useToday()
  const [savedViews, setSavedViews] = useState(false)
  const { cover } = useShellChrome()
  const hasTray = tray !== null
  useEffect(() => {
    cover(hasTray)
    return () => {
      cover(false)
    }
  }, [cover, hasTray])
  const openSaved = saved.available
    ? () => {
        setSavedViews(true)
      }
    : null
  const title = head.focusTitle ?? (head.month === null ? '' : monthTitle(head.month, today))
  return (
    <div className="flex h-full flex-col">
      {focusMode.on ? <FocusCapsule title={title} /> : <Head {...head} onSavedViews={openSaved} />}
      {scope.ready && scope.none ? <RoutineBand /> : null}
      {/* The head is in the flow: what scrolls below it starts at its own top. */}
      <div className="below-bars relative min-h-none flex-1">{children}</div>
      {hasTray ? <div className="pointer-events-none absolute inset-x-lg bottom-lg z-5 flex justify-center">{tray}</div> : null}
      {savedViews ? (
        <SavedViewsSheet
          onClose={() => {
            setSavedViews(false)
          }}
        />
      ) : null}
    </div>
  )
}
