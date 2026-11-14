import type { ReactNode } from 'react'

import { t } from '@i18n'

import { percentOf } from './chartMath'

// The dashboard's small charts (D-362): CSS bars on theme tokens, no chart library. Every chart beside them carries a
// visually hidden table of its figures (`SrTable`), so a screen reader reads the numbers, not the shapes.

/** A chart's figures as a table only a screen reader finds. */
export function SrTable({
  caption,
  head,
  rows,
}: {
  readonly caption: string
  readonly head: readonly string[]
  readonly rows: readonly { readonly key: string; readonly cells: readonly string[] }[]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) =>
              index === 0 ? (
                // oxlint-disable-next-line react/no-array-index-key -- a column's place is its identity
                <th key={index} scope="row">
                  {cell}
                </th>
              ) : (
                // oxlint-disable-next-line react/no-array-index-key -- a column's place is its identity
                <td key={index}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A horizontal track from the start edge; its children are absolutely placed segments and ticks. */
export function Track({ children }: { readonly children?: ReactNode }) {
  return (
    <div aria-hidden className="relative h-dot w-full overflow-hidden rounded-bar bg-inner">
      {children}
    </div>
  )
}

/** A filled segment of a track, from `from` to `to` percent, growing from the start edge. */
export function Segment({ from = 0, to, tone }: { readonly from?: number; readonly to: number; readonly tone: string }) {
  return (
    <div
      className={`absolute rounded-bar ${tone}`}
      style={{ insetInlineStart: `${String(from)}%`, inlineSize: `${String(Math.max(0, to - from))}%`, insetBlock: 0 }}
    />
  )
}

/** A thin vertical mark across a track at `at` percent: a median, a minimum. */
export function Tick({ at, tone }: { readonly at: number; readonly tone: string }) {
  return <div className={`absolute w-hairline ${tone}`} style={{ insetInlineStart: `${String(at)}%`, insetBlock: 0 }} />
}

/** A completion bar with its percent beside it; nothing when there is no denominator. */
export function Meter({ value, max }: { readonly value: number; readonly max: number }) {
  if (max <= 0) return null
  const percent = percentOf(value, max)
  const label = `${String(Math.round(percent))}${t('rules.percent')}`
  return (
    <div className="flex items-center gap-xs">
      <Track>
        <Segment to={percent} tone="bg-action-solid" />
      </Track>
      <span className="shrink-0 text-micro text-text-muted tabular-nums">{label}</span>
    </div>
  )
}
