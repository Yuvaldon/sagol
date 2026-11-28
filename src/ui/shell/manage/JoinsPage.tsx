import { PANEL_IDS } from '@config'
import type { AccountLinkRequest, UnitId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  fullName,
  joinGroups,
  useJoinApproval,
  useLinkAssessments,
  useLinkPlacements,
  usePanel,
  usePendingLinkRequests,
  useToday,
  useUnits,
  type JoinEntry,
} from '@logic'
import { Check, ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton, Menu, MenuItem, MenuTrigger } from 'react-aria-components'
import { Badge } from '../../kit/Badge'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Popover } from '../../primitives/overlays'
import { useNotices } from '../notices'
import { PageFrame } from '../PageFrame'
import { joinOutcome } from './joinOutcome'
import { REASON_CHIPS } from './joinWords'
import { PageTop } from './PageTop'

// "הצטרפות" (the handoff's Manage → Join requests, D-482, OI-382): a queue of what waits, by readiness (D-447). Ready
// requests have one candidate and no conflict; a request to review says why on an amber chip; a request with no
// candidate becomes a new soldier once a unit is chosen on its "מחלקה" chip. "אישור N" in the capsule approves every
// ready one and creates every placed one. A row opens "זה הוא?", where each request is answered on its own.

const SEPARATOR = ' · '
const WORD = ' '

function RequestRow({ request, trailing }: { readonly request: AccountLinkRequest; readonly trailing?: ReactNode }) {
  const panel = usePanel()
  return (
    <li className="flex min-h-touch items-center gap-sm border-b border-divider-strong pe-lg last:border-b-0">
      <AriaButton
        onPress={() => {
          panel.open(PANEL_IDS.accountLinks, { entity: request.id })
        }}
        className="flex min-h-touch min-w-none flex-1 cursor-pointer items-baseline gap-sm py-xs ps-lg text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        <span className="shrink-0 truncate text-body font-semibold">{fullName(request)}</span>
        {request.claimed_personal_id === null ? null : (
          <span dir="ltr" className="min-w-none truncate text-small text-text-muted tabular-nums">
            {request.claimed_personal_id}
          </span>
        )}
      </AriaButton>
      {trailing}
    </li>
  )
}

function Group({ titleKey, entries, children }: { readonly titleKey: I18nKey; readonly entries: readonly JoinEntry[]; readonly children: ReactNode }) {
  if (entries.length === 0) return null
  return (
    <section className="flex flex-col gap-xs">
      <h2 className="flex items-center justify-between gap-sm px-xs text-body font-bold">
        {t(titleKey)}
        <span className="text-small font-normal text-text-muted tabular-nums">{entries.length}</span>
      </h2>
      <ul className="flex flex-col overflow-hidden rounded-card bg-surface">{children}</ul>
    </section>
  )
}

/** A choice of the "מחלקה" chip: a unit, or no unit (NULL) for who may create a soldier with none. */
interface UnitChoice {
  readonly key: string
  readonly unitId: UnitId | null
  readonly name: string
}

/**
 * The "מחלקה" chip of a request with no candidate: a short menu of where its new soldier may go. The chip is drawn small,
 * as the handoff draws it, inside a 44 px target.
 */
function UnitChip({
  options,
  chosen,
  onChoose,
}: {
  readonly options: readonly UnitChoice[]
  /** Undefined until a choice is made. */
  readonly chosen: UnitId | null | undefined
  readonly onChoose: (unitId: UnitId | null) => void
}) {
  const name = chosen === undefined ? null : (options.find((option) => option.unitId === chosen)?.name ?? null)
  return (
    <MenuTrigger>
      <AriaButton
        aria-label={name === null ? t('manage.joins.unitChip') : [t('manage.joins.unitChip'), name].join(SEPARATOR)}
        className="group inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center outline-none"
      >
        <span
          className={`inline-flex min-h-badge items-center gap-2xs rounded-full px-md text-small font-semibold outline-focus outline-offset-2 group-data-focus-visible:outline-2 ${
            name === null ? 'border border-dashed border-line-dashed text-text-muted' : 'bg-action-soft text-on-action-soft'
          }`}
        >
          {name ?? t('manage.joins.unitChip')}
          <ChevronDown aria-hidden size={14} />
        </span>
      </AriaButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu
          onAction={(key) => {
            const option = options.find((candidate) => candidate.key === key)
            if (option !== undefined) onChoose(option.unitId)
          }}
          className="flex max-h-sheet-height max-w-menu flex-col gap-2xs overflow-y-auto outline-none"
        >
          {options.map((option) => (
            <MenuItem
              key={option.key}
              id={option.key}
              textValue={option.name}
              className="flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-body outline-none data-focused:bg-inner"
            >
              {option.name}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

const NO_UNIT = 'none'

const NO_REQUESTS: readonly AccountLinkRequest[] = []

export function JoinsPage({ name }: { readonly name: string }) {
  const notices = useNotices()
  const today = useToday()
  const requests = usePendingLinkRequests()
  const pending = requests.status === 'ready' ? requests.value : NO_REQUESTS
  const assessments = useLinkAssessments(pending)
  const units = useUnits()
  const placements = useLinkPlacements(units.status === 'ready' ? units.value : [])
  const approval = useJoinApproval()
  const [placed, setPlaced] = useState<ReadonlyMap<string, UnitId | null>>(new Map())
  const groups = useMemo(() => (assessments.status === 'ready' ? joinGroups(pending, assessments.value) : null), [assessments, pending])
  const unitChoices = useMemo(
    (): UnitChoice[] => [
      ...(units.status === 'ready' ? units.value.filter((unit) => placements.placeIn(unit.id)).map((unit) => ({ key: unit.id, unitId: unit.id, name: unit.name })) : []),
      ...(placements.withoutUnit ? [{ key: NO_UNIT, unitId: null, name: t('soldiers.noUnit') }] : []),
    ],
    [units, placements],
  )
  const ready = groups?.ready ?? []
  const placedNow = (groups?.newSoldiers ?? []).flatMap((entry) => {
    if (!placed.has(entry.request.id)) return []
    return [{ request: entry.request, unitId: placed.get(entry.request.id) ?? null }]
  })
  const count = ready.length + placedNow.length
  const approveAll = () => {
    if (today === null || approval.isPending) return
    void approval.run({ ready: ready.map((entry) => entry.request), placed: placedNow, today }).then((result) => {
      if (!result.ok) {
        notices.fail(result.error)
        return
      }
      const { done, refusal } = joinOutcome(result.value)
      notices.report(done, refusal)
    })
  }

  return (
    <PageFrame>
      <PageTop
        titleKey="manage.pages.joins"
        detail={[name, [String(pending.length), t('manage.joins.waiting')].join(WORD)].join(SEPARATOR)}
        tools={
          count === 0 ? null : (
            <AriaButton
              isDisabled={approval.isPending}
              onPress={approveAll}
              className="inline-flex min-h-touch cursor-pointer items-center gap-xs rounded-full px-md text-body font-bold outline-focus outline-offset-2 data-focus-visible:outline-2"
            >
              <Check aria-hidden size={18} />
              {[t('manage.joins.approve'), String(count)].join(WORD)}
            </AriaButton>
          )
        }
      />
      {requests.status === 'failed' ? (
        <FailureNotice error={requests.error} />
      ) : assessments.status === 'failed' ? (
        <FailureNotice error={assessments.error} />
      ) : groups === null || requests.status === 'loading' ? (
        <LoadingNotice />
      ) : pending.length === 0 ? (
        <EmptyNotice titleKey="accountLinks.emptyTitle" bodyKey="accountLinks.emptyBody" headingLevel={2} />
      ) : (
        <>
          <Group titleKey="manage.joins.ready" entries={groups.ready}>
            {groups.ready.map((entry) => (
              <RequestRow key={entry.request.id} request={entry.request} />
            ))}
          </Group>
          <Group titleKey="manage.joins.review" entries={groups.review}>
            {groups.review.map((entry) => (
              <RequestRow
                key={entry.request.id}
                request={entry.request}
                trailing={entry.assessment.readiness === 'needs_review' ? <Badge tone="pending">{t(REASON_CHIPS[entry.assessment.reason])}</Badge> : null}
              />
            ))}
          </Group>
          <Group titleKey="manage.joins.newSoldiers" entries={groups.newSoldiers}>
            {groups.newSoldiers.map((entry) => (
              <RequestRow
                key={entry.request.id}
                request={entry.request}
                trailing={
                  unitChoices.length === 0 ? null : (
                    <UnitChip
                      options={unitChoices}
                      chosen={placed.has(entry.request.id) ? (placed.get(entry.request.id) ?? null) : undefined}
                      onChoose={(unitId) => {
                        setPlaced((current) => new Map(current).set(entry.request.id, unitId))
                      }}
                    />
                  )
                }
              />
            ))}
          </Group>
        </>
      )}
    </PageFrame>
  )
}
