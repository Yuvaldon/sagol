import { PANEL_IDS } from '@config'
import type { LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useMyRotation, usePanel, type MyRotation } from '@logic'
import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { FailureNotice } from '../../patterns/Notices'
import { Meter } from '../../primitives/charts'
import { typeNameOf } from './leaveText'
import {
  approvalText,
  baseSecondary,
  dayText,
  homeSecondary,
  homeUntilText,
  inDaysText,
  joinedText,
  lastDayText,
  numberText,
  startsText,
  untilText,
} from './myRotationText'

// "הסבב שלי" (D-350): the soldier's own figures over their rotation, at the top of "שלי". Two cards per row on a
// phone with the last one full width, one row of five on desktop. Only the requests and next-leave cards are buttons.

const CARD = 'flex min-w-none flex-col gap-2xs rounded-control border border-line bg-surface p-sm text-start'
const PRESSABLE = `${CARD} min-h-touch cursor-pointer outline-focus data-focus-visible:outline-2 data-hovered:bg-inner`
const SPAN = 'col-span-1'
const FULL = 'col-span-2 lg:col-span-1'

function Figures({ titleKey, main, lines }: { readonly titleKey: I18nKey; readonly main: string; readonly lines: ReactNode }) {
  return (
    <>
      <span className="text-label font-semibold text-text-muted">{t(titleKey)}</span>
      <span className="text-title font-bold tabular-nums">{main}</span>
      {lines}
    </>
  )
}

const Line = ({ text }: { readonly text: string }) => <span className="text-micro text-text-muted tabular-nums">{text}</span>

function Card({ span, onPress, children }: { readonly span: string; readonly onPress?: () => void; readonly children: ReactNode }) {
  if (onPress === undefined) return <li className={`${CARD} ${span}`}>{children}</li>
  return (
    <li className={`flex ${span}`}>
      <AriaButton onPress={onPress} className={`${PRESSABLE} w-full`}>
        {children}
      </AriaButton>
    </li>
  )
}

function NextLeaveCard({ next, typeOf }: { readonly next: MyRotation['figures']['next']; readonly typeOf: (id: LeaveType['id']) => LeaveType | null }) {
  const panel = usePanel()
  if (next.kind === 'none') {
    return (
      <Card span={SPAN}>
        <Figures titleKey="myRotation.nextLeave" main={t('myRotation.noNext')} lines={null} />
      </Card>
    )
  }
  if (next.kind === 'home') {
    return (
      <Card span={SPAN}>
        <Figures titleKey="myRotation.nextLeave" main={homeUntilText(next.until)} lines={null} />
      </Card>
    )
  }
  return (
    <Card span={SPAN} onPress={() => panel.open(PANEL_IDS.leaves, { entity: next.leaveId })}>
      <Figures
        titleKey="myRotation.nextLeave"
        main={dayText(next.start)}
        lines={
          <>
            <Line text={inDaysText(next.inDays)} />
            <Line text={joinedText([typeNameOf(typeOf(next.typeId)), untilText(next.end)])} />
          </>
        }
      />
    </Card>
  )
}

export function MyRotationSection({
  typeOf,
  onOpenRequests,
}: {
  readonly typeOf: (id: LeaveType['id']) => LeaveType | null
  readonly onOpenRequests: () => void
}) {
  const mine = useMyRotation()
  if (mine === null || mine.status === 'loading') return null
  if (mine.status === 'failed') return <FailureNotice error={mine.error} />
  const { rotation, figures } = mine.value
  const { base, home, left } = figures
  const baseLine = baseSecondary(figures)
  const homeLine = homeSecondary(figures)
  return (
    <section aria-labelledby="my-rotation-title" className="flex flex-col gap-xs">
      <h3 id="my-rotation-title" className="text-label font-semibold text-text-muted">
        {joinedText([t('myRotation.title'), rotation.name])}
      </h3>
      <ul className="grid grid-cols-2 gap-sm lg:grid-cols-5">
        <Card span={SPAN}>
          <Figures
            titleKey="myRotation.baseDays"
            main={numberText(base.sofar)}
            lines={
              <>
                {baseLine === null ? null : <Line text={baseLine} />}
                {base.planned === null ? null : <Meter value={base.sofar} max={base.planned} />}
              </>
            }
          />
        </Card>
        <Card span={SPAN}>
          <Figures
            titleKey="myRotation.homeDays"
            main={numberText(home.sofar)}
            lines={
              <>
                {homeLine === null ? null : <Line text={homeLine} />}
                {home.planned === null ? null : <Meter value={home.sofar} max={home.planned} />}
              </>
            }
          />
        </Card>
        <Card span={SPAN} {...(figures.openRequests > 0 ? { onPress: onOpenRequests } : {})}>
          <Figures titleKey="myRotation.openRequests" main={numberText(figures.openRequests)} lines={<Line text={approvalText(figures.approvalRate)} />} />
        </Card>
        <NextLeaveCard next={figures.next} typeOf={typeOf} />
        {left === null ? null : left.kind === 'starts' ? (
          <Card span={FULL}>
            <Figures titleKey="myRotation.untilEnd" main={startsText(left.date)} lines={null} />
          </Card>
        ) : (
          <Card span={FULL}>
            <Figures
              titleKey="myRotation.untilEnd"
              main={numberText(left.days)}
              lines={
                <>
                  <Line text={lastDayText(left.lastDay)} />
                  <Meter value={left.elapsed} max={left.total} />
                </>
              }
            />
          </Card>
        )}
      </ul>
    </section>
  )
}
