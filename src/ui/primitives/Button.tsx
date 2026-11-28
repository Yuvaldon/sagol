import { TOOLTIP } from '@config'
import { t, type I18nKey } from '@i18n'
import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Button as AriaButton,
  Tooltip,
  TooltipTrigger,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components'

// The action button of Stone 3: dark glass for the primary action, quiet for everything else.
// At least 44 px tall on mobile (OI-033).

const BASE =
  'inline-flex min-h-touch cursor-pointer items-center justify-center gap-xs rounded-pill px-md text-control font-semibold whitespace-nowrap outline-focus outline-offset-2 md:min-h-control data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'

/** A tile: as tall as a tab, the control radius, the body size. Actions of equal weight stand side by side as tiles (D-454). */
const TILE =
  'inline-flex min-h-tab cursor-pointer items-center justify-center gap-xs rounded-control px-md text-body font-semibold outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'

const VARIANTS = {
  primary: `${BASE} glass-action md:min-h-bar px-lg`,
  quiet: `${BASE} bg-inner text-text data-hovered:bg-line`,
  /** What takes something away, confirmed (D-461): red on its soft fill, never the primary color. */
  danger: `${BASE} bg-status-rejected-bg text-status-rejected-text md:min-h-bar px-lg`,
  tile: `${TILE} border border-line bg-surface text-text data-hovered:bg-inner`,
  tileSolid: `${TILE} bg-action-solid text-on-action`,
} as const

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly variant?: keyof typeof VARIANTS
}

export function Button({ variant = 'quiet', ...props }: ButtonProps) {
  return <AriaButton {...props} className={VARIANTS[variant]} />
}

const ICON_BASE =
  'inline-flex cursor-pointer items-center justify-center outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'

const ICON_VARIANTS = {
  plain: `${ICON_BASE} min-h-touch min-w-touch rounded-pill text-text-muted md:min-h-control md:min-w-control data-hovered:bg-inner`,
  /** The icon on its own white circle, 44 px on every screen: the ✕ of a drawer of the new interface (D-454). */
  circle: `${ICON_BASE} size-touch shrink-0 rounded-full bg-surface text-text data-hovered:bg-inner`,
} as const

export interface IconButtonProps extends Omit<AriaButtonProps, 'className' | 'children' | 'aria-label'> {
  readonly labelKey: I18nKey
  readonly variant?: keyof typeof ICON_VARIANTS
  readonly children: ReactNode
}

/**
 * A button that shows only an icon (D-189, D-215). Its name is read aloud, and shows as a tooltip on hover or keyboard focus,
 * so no control needs a word on screen to be understood.
 */
export function IconButton({ labelKey, variant = 'plain', children, ...props }: IconButtonProps) {
  const label = t(labelKey)
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        {...props}
        aria-label={label}
        className={ICON_VARIANTS[variant]}
      >
        {children}
      </AriaButton>
      <NameTooltip>{label}</NameTooltip>
    </TooltipTrigger>
  )
}

/**
 * The tooltip that shows a control's name, on the menus' glass (D-215). It renders
 * inside the landmark or dialog that holds its trigger, found from a hidden anchor beside it, never loose in the body.
 * There it sits in a host taken out of the flow: react-aria wraps the tooltip in a block of its own, which would
 * otherwise join the landmark's layout and move the controls while the tooltip shows, the trigger among them, so the
 * press that hides it would end beside the control.
 */
export function NameTooltip({ children }: { readonly children: string }) {
  const [container, setContainer] = useState<Element | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const anchor = useCallback((node: HTMLSpanElement | null) => {
    setContainer(node?.closest(TOOLTIP.containerSelector) ?? null)
  }, [])
  return (
    <>
      <span ref={anchor} hidden />
      {container === null ? null : createPortal(<div ref={setHost} className="pointer-events-none absolute inset-none" />, container)}
      <Tooltip
        {...(host === null ? {} : { UNSTABLE_portalContainer: host })}
        offset={TOOLTIP.offsetPx}
        className="glass-menu pointer-events-none rounded-control px-sm py-2xs text-micro font-semibold text-text"
      >
        {children}
      </Tooltip>
    </>
  )
}
