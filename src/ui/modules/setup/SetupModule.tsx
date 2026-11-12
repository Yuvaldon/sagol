import type { SetupStepId } from '@config'
import { t, type I18nKey } from '@i18n'
import { usePanel, useSetupProgress, type SetupStep } from '@logic'
import { Check, ChevronLeft } from 'lucide-react'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'

// The organization's setup (D-033, D-180): the steps this actor may do, in order, each marked done once what it sets
// up exists. A step opens its own module, so every step uses the forms that module already has. Any step may be
// skipped or done again; nothing about the setup is stored.

const STEP_KEYS: Readonly<Record<SetupStepId, { readonly title: I18nKey; readonly body: I18nKey }>> = {
  unit_levels: { title: 'setup.steps.unit_levels.title', body: 'setup.steps.unit_levels.body' },
  units: { title: 'setup.steps.units.title', body: 'setup.steps.units.body' },
  command_ranks: { title: 'setup.steps.command_ranks.title', body: 'setup.steps.command_ranks.body' },
  rank_bindings: { title: 'setup.steps.rank_bindings.title', body: 'setup.steps.rank_bindings.body' },
  leave_types: { title: 'setup.steps.leave_types.title', body: 'setup.steps.leave_types.body' },
  tags: { title: 'setup.steps.tags.title', body: 'setup.steps.tags.body' },
  soldiers: { title: 'setup.steps.soldiers.title', body: 'setup.steps.soldiers.body' },
}

/** Between the words of a line built from several strings. */
const WORD = ' '

function StepRow({ step, position }: { readonly step: SetupStep; readonly position: number }) {
  const panel = usePanel()
  const keys = STEP_KEYS[step.id]
  const title = t(keys.title)
  return (
    <li className="flex items-center gap-sm border-b border-line py-sm">
      <span
        aria-hidden
        className={`flex size-control shrink-0 items-center justify-center rounded-pill text-micro font-semibold tabular-nums ${step.done ? 'bg-action-solid text-on-action' : 'bg-inner text-text-muted'}`}
      >
        {step.done ? <Check size={14} /> : position}
      </span>
      <span className="flex min-w-none flex-1 flex-col gap-2xs">
        <span className="text-name font-semibold">{title}</span>
        <span className="text-micro text-text-muted">{t(keys.body)}</span>
        {/* The state in words too, not only by the mark's color (WCAG 1.4.1). */}
        <span className="text-micro font-semibold">{t(step.done ? 'setup.done' : 'setup.notDone')}</span>
      </span>
      <Button
        aria-label={[t('setup.go'), title].join(WORD)}
        onPress={() => {
          panel.open(step.panel)
        }}
      >
        {t('setup.go')}
        <ChevronLeft aria-hidden size={14} />
      </Button>
    </li>
  )
}

export function SetupModule() {
  const progress = useSetupProgress()
  if (progress.status === 'failed') return <FailureNotice error={progress.error} />
  if (progress.status === 'loading') return <LoadingNotice />
  const steps = progress.value
  const done = steps.filter((step) => step.done).length
  const summary = [String(done), t('setup.progressOf'), String(steps.length), t('setup.progressDone')].join(WORD)
  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('setup.intro')}</p>
      <p role="status" className="text-name font-semibold tabular-nums">
        {summary}
      </p>
      <ol aria-label={t('setup.listLabel')} className="flex flex-col">
        {steps.map((step, index) => (
          <StepRow key={step.id} step={step} position={index + 1} />
        ))}
      </ol>
    </div>
  )
}
