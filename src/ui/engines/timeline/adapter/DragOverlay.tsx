import { t } from '@i18n'
import { fullName, leaveDayCount, type LeaveDates } from '@logic'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, formatDateRange } from '../../../patterns/dates'
import { FailureNotice } from '../../../patterns/Notices'
import { RuleGateDialog } from '../../../patterns/rules/RuleGate'
import { RuleBrief } from '../../../patterns/rules/RuleViolations'
import { Button } from '../../../primitives/Button'
import type { BoardDrag, DragCardState } from './boardDrag'

// What a drag on the board says (D-143): a card with the new days, what the move costs and the rules it would break,
// read aloud as it changes; the refusal of a drop; and the rule dialog of the command's answer (D-142).

const PART_SEPARATOR = ' · '

function datesText({ start_date, end_date }: LeaveDates): string {
  const days = leaveDayCount({ start_date, end_date })
  const range = start_date === end_date ? formatDate(start_date, 'dayMonth') : formatDateRange(start_date, end_date)
  return [range, days === 1 ? t('leaves.oneDay') : `${String(days)} ${t('leaves.days')}`].join(PART_SEPARATOR)
}

function DragCard({ card }: { readonly card: DragCardState }) {
  const title = [t(card.creating ? 'timeline.dragNew' : 'timeline.dragMove'), ...(card.soldier === null ? [] : [fullName(card.soldier)])]
  return (
    <div className="glass-menu flex flex-col gap-xs rounded-panel p-md">
      <p className="text-name font-semibold">{title.join(PART_SEPARATOR)}</p>
      <p className="text-name tabular-nums">{datesText(card.dates)}</p>
      {card.creating ? <p className="text-micro text-text-muted">{t('timeline.dragNewHint')}</p> : null}
      {card.returnsToPending ? <p className="text-micro text-status-pending-text">{t('leaves.returnsToPending')}</p> : null}
      {card.warnings.status !== 'ready' ? (
        <p className="text-micro text-text-muted">{t(card.warnings.status === 'loading' ? 'rules.checking' : 'rules.checkFailed')}</p>
      ) : card.warnings.value.length === 0 ? null : (
        <RuleBrief violations={card.warnings.value} />
      )}
    </div>
  )
}

/** Floats above the board and the bottom bar, and takes no press but its own buttons. */
function Floating({ children }: { readonly children: ReactNode }) {
  // Glass makes a containing block, so what is fixed renders outside it (Design.md "Glass").
  return createPortal(
    <div className="pointer-events-none fixed inset-x-none bottom-above-bottom-bar z-5 flex justify-center px-lg">
      <div className="flex w-full max-w-sheet flex-col gap-sm">{children}</div>
    </div>,
    document.body,
  )
}

export function DragOverlay({ drag }: { readonly drag: BoardDrag }) {
  return (
    <>
      <Floating>
        {/* The live region stays in the page, so each change of the card is read aloud. */}
        <div role="status">{drag.card === null ? null : <DragCard card={drag.card} />}</div>
        {drag.failure === null ? null : (
          <div className="pointer-events-auto rounded-control bg-surface">
            <FailureNotice error={drag.failure}>
              <Button onPress={drag.clearFailure}>{t('common.close')}</Button>
            </FailureNotice>
          </div>
        )}
      </Floating>
      <RuleGateDialog gate={drag.gate} isPending={drag.isPending} />
    </>
  )
}
