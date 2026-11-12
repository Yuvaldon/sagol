import { PANEL_IDS } from '@config'
import type { AccountLinkRequest } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { fullName, useBulkLinkApproval, usePanel, type BulkLinkAnswer, type BulkLinkAnswers } from '@logic'
import { useState } from 'react'
import { failureKey } from '../../errors/messages'
import { CheckList, type Choice } from '../../primitives/ChoiceList'
import { Button } from '../../primitives/Button'

// Approving several join requests at once (D-283). Only a request with one candidate matched by its personal number is
// linked; every other chosen request is named as needing its own review, and a refusal names its reason.

/** Between the words of a line built from several strings. */
const WORD = ' '

const ANSWER_KEYS: Readonly<Record<BulkLinkAnswer['kind'], I18nKey>> = {
  linked: 'accountLinks.bulk.linked',
  refused: 'accountLinks.bulk.refused',
  needs_review: 'accountLinks.bulk.needsReview',
}

function choiceOf(request: AccountLinkRequest): Choice {
  const personalId = request.claimed_personal_id ?? ''
  return { key: request.id, label: { text: personalId === '' ? fullName(request) : [fullName(request), personalId].join(WORD) } }
}

/** What the run answered, by request, kept by name: a linked request has left the pending list. */
interface Outcome {
  readonly request: AccountLinkRequest
  readonly answer: BulkLinkAnswer
}

function OutcomeItem({ outcome, pending }: { readonly outcome: Outcome; readonly pending: boolean }) {
  const panel = usePanel()
  const { request, answer } = outcome
  return (
    <li className="flex items-center gap-sm border-b border-line py-xs">
      <span className="flex min-w-none flex-1 flex-col">
        <span className="truncate text-name font-semibold">{fullName(request)}</span>
        <span className={answer.kind === 'refused' ? 'text-micro text-status-rejected' : 'text-micro text-text-muted'}>
          {answer.kind === 'refused' ? [t(ANSWER_KEYS.refused), t(failureKey(answer.error))].join(WORD) : t(ANSWER_KEYS[answer.kind])}
        </span>
      </span>
      {answer.kind !== 'linked' && pending ? (
        <Button
          onPress={() => {
            panel.open(PANEL_IDS.accountLinks, { entity: request.id })
          }}
        >
          {t('accountLinks.bulk.review')}
        </Button>
      ) : null}
    </li>
  )
}

export function BulkApproval({ requests, onDone }: { readonly requests: readonly AccountLinkRequest[]; readonly onDone: () => void }) {
  const approve = useBulkLinkApproval()
  const [selected, setSelected] = useState<readonly string[]>([])
  const [outcomes, setOutcomes] = useState<readonly Outcome[]>([])
  // A request that left the list since it was chosen is no longer offered.
  const chosen = requests.filter((request) => selected.includes(request.id))

  const run = async () => {
    const result = await approve.run(chosen)
    if (!result.ok) return
    const answers: BulkLinkAnswers = result.value
    setOutcomes(chosen.flatMap((request) => {
      const answer = answers.get(request.id)
      return answer === undefined ? [] : [{ request, answer }]
    }))
    setSelected([])
  }

  return (
    <section aria-label={t('accountLinks.bulk.title')} className="flex flex-col gap-md">
      <p className="text-micro text-text-muted">{t('accountLinks.bulk.hint')}</p>
      {requests.length === 0 ? null : (
        <CheckList
          label={{ key: 'accountLinks.bulk.choose' }}
          choices={requests.map(choiceOf)}
          selected={selected}
          onChange={setSelected}
        />
      )}
      {approve.isPending ? (
        <p role="status" className="text-micro text-text-muted">
          {t('accountLinks.bulk.running')}
        </p>
      ) : null}
      {outcomes.length === 0 ? null : (
        <ul aria-label={t('accountLinks.bulk.outcomes')} className="flex flex-col">
          {outcomes.map((outcome) => (
            <OutcomeItem
              key={outcome.request.id}
              outcome={outcome}
              pending={requests.some((request) => request.id === outcome.request.id)}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          isDisabled={chosen.length === 0 || approve.isPending}
          onPress={() => {
            void run()
          }}
        >
          {[t('accountLinks.bulk.approve'), String(chosen.length)].join(WORD)}
        </Button>
        <Button isDisabled={approve.isPending} onPress={onDone}>
          {t('common.backToList')}
        </Button>
      </div>
    </section>
  )
}
