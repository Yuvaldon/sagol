import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
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

const VARIANTS = {
  primary: 'glass-action md:min-h-bar px-lg',
  quiet: 'bg-inner text-text data-hovered:bg-line',
} as const

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly variant?: keyof typeof VARIANTS
}

export function Button({ variant = 'quiet', ...props }: ButtonProps) {
  return <AriaButton {...props} className={`${BASE} ${VARIANTS[variant]}`} />
}

export interface IconButtonProps extends Omit<AriaButtonProps, 'className' | 'children' | 'aria-label'> {
  readonly labelKey: I18nKey
  readonly children: ReactNode
}

/** A button that shows only an icon. Its name is read aloud, and shown on hover or keyboard focus (D-215). */
export function IconButton({ labelKey, children, ...props }: IconButtonProps) {
  const label = t(labelKey)
  return (
    <TooltipTrigger>
      <AriaButton
        {...props}
        aria-label={label}
        className="inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-pill text-text-muted outline-focus outline-offset-2 md:min-h-control md:min-w-control data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        {children}
      </AriaButton>
      <Tooltip className="glass-menu rounded-control px-sm py-2xs text-micro font-semibold text-text">{label}</Tooltip>
    </TooltipTrigger>
  )
}
