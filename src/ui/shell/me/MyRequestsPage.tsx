import { PANEL_IDS } from '@config'
import type { Leave } from '@contracts'
import { t } from '@i18n'
import { useLeaveTypes, useMyLeaves, usePanel } from '@logic'
import { useState } from 'react'
import { PersonRow } from '../../kit/PersonRow'
import { LeaveBadge } from '../../modules/leaves/LeaveMarks'
import { leaveDatesText, leaveDaysText, typeNameOf } from '../../modules/leaves/leaveText'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Segmented } from '../../primitives/Segmented'
import { PageFrame } from '../PageFrame'
import { PageTop } from '../manage/PageTop'

// "כל הבקשות" (the handoff's All requests, D-488): the soldier's own leaves in two parts, "פתוחות" (waiting, and approved
// ones not yet over, the earliest first) and "היסטוריה" (the rest, the last changed first, D-167). A row is the type, the
// days and how many, and the badge; it opens the leave's card. The part shown is the page's own state: it always opens on
// "פתוחות", where what may still change is.

const SEPARATOR = ' · '
const NO_TYPES: readonly never[] = []

type Part = 'open' | 'history'

const PARTS = [
  { id: 'open', labelKey: 'me.openTab', icon: null },
  { id: 'history', labelKey: 'me.historyTab', icon: null },
] as const

function Rows({ leaves, emptyKey }: { readonly leaves: readonly Leave[]; readonly emptyKey: 'me.noOpenRequests' | 'me.emptyHistory' }) {
  const panel = usePanel()
  const types = useLeaveTypes()
  const typeList = types.status === 'ready' ? types.value : NO_TYPES
  if (leaves.length === 0) return <p className="py-sm text-body text-text-muted">{t(emptyKey)}</p>
  return (
    <ul className="flex flex-col">
      {leaves.map((leave) => (
        <li key={leave.id}>
          <PersonRow
            name={typeNameOf(typeList.find((type) => type.id === leave.leave_type_id) ?? null)}
            detail={[leaveDatesText(leave), leaveDaysText(leave)].join(SEPARATOR)}
            trailing={<LeaveBadge status={leave.status} />}
            onPress={() => {
              panel.open(PANEL_IDS.leaves, { entity: leave.id })
            }}
          />
        </li>
      ))}
    </ul>
  )
}

export function MyRequestsPage() {
  const mine = useMyLeaves()
  const [part, setPart] = useState<Part>('open')
  return (
    <PageFrame>
      <PageTop titleKey="me.myRequests" />
      <Segmented labelKey="me.requestsTabs" options={PARTS} value={part} onChange={setPart} />
      <section aria-label={t(part === 'open' ? 'me.openTab' : 'me.historyTab')} className="flex flex-col rounded-card bg-surface px-lg py-xs">
        {mine.status === 'failed' ? (
          <FailureNotice error={mine.error} />
        ) : mine.status === 'loading' ? (
          <LoadingNotice />
        ) : part === 'open' ? (
          <Rows leaves={mine.value.open} emptyKey="me.noOpenRequests" />
        ) : (
          <Rows leaves={mine.value.history} emptyKey="me.emptyHistory" />
        )}
      </section>
    </PageFrame>
  )
}
