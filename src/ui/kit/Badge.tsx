import type { ReactNode } from 'react'

// The badge of the new interface (D-454): 26 px high, fully round, a word on a tinted ground. The word carries the
// meaning; the color only repeats it.

const TONES = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  ok: 'bg-status-ok-bg text-status-ok-text',
  rejected: 'bg-status-rejected-bg text-status-rejected-text',
  neutral: 'bg-inner text-text-muted',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({ tone, children }: { readonly tone: BadgeTone; readonly children: ReactNode }) {
  return (
    <span className={`inline-flex h-badge shrink-0 items-center rounded-full px-cozy text-caption font-semibold whitespace-nowrap tabular-nums ${TONES[tone]}`}>
      {children}
    </span>
  )
}
