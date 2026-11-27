import { SHELL } from '@config'
import { t, type I18nKey } from '@i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'

// The toast of the new interface (D-454): what just happened, in one line over the tab bar, for a few seconds. It
// carries an action only where the step can truly be taken back, and the action lives as long as the toast. The
// toast's time stops while the pointer or the keyboard is on it, and while its owner holds it (a question asked from
// its action), and it starts over at every key press, so nobody loses the action while reaching for it.

/**
 * Where toasts show: a live region that is always in the page, inside the safe area and above the tab bar, so a
 * reader hears each toast as it arrives and a phone's home indicator never covers one.
 */
export function ToastRegion({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-safe z-10">
      <div role="status" className="absolute inset-x-lg bottom-above-bottom-bar flex justify-center pb-lg">
        {children}
      </div>
    </div>
  )
}

export interface ToastProps {
  readonly message: string
  readonly actionKey?: I18nKey
  readonly onAction?: () => void
  /** The toast's time is up. */
  readonly onDone: () => void
  /** The toast stays while this holds. */
  readonly held?: boolean
}

export function Toast({ message, actionKey, onAction, onDone, held = false }: ToastProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // Each key pressed anywhere gives the toast its whole time again: someone walking to it with Tab is on their way.
  const [keys, setKeys] = useState(0)
  useEffect(() => {
    const onKey = () => {
      setKeys((count) => count + 1)
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
    }
  }, [])
  const waits = held || hovered || focused
  useEffect(() => {
    if (waits) return undefined
    const timer = setTimeout(onDone, SHELL.toastMs)
    return () => {
      clearTimeout(timer)
    }
  }, [message, onDone, waits, keys])
  return (
    <div
      onPointerEnter={() => {
        setHovered(true)
      }}
      onPointerLeave={() => {
        setHovered(false)
      }}
      onFocus={() => {
        setFocused(true)
      }}
      onBlur={() => {
        setFocused(false)
      }}
      className="glass-action pointer-events-auto flex min-h-touch max-w-full items-center gap-md rounded-full py-xs ps-lg pe-xs"
    >
      <span className="min-w-none truncate text-small font-semibold">{message}</span>
      {actionKey === undefined || onAction === undefined ? (
        <span aria-hidden className="w-sm" />
      ) : (
        <AriaButton
          onPress={onAction}
          className="inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full bg-surface px-md text-small font-bold text-text outline-on-action outline-offset-2 data-focus-visible:outline-2"
        >
          {t(actionKey)}
        </AriaButton>
      )}
    </div>
  )
}
