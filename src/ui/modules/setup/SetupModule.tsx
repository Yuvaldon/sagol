import type { SetupStepId } from '@config'
import { t, type I18nKey } from '@i18n'
import { usePanel, useSetupProgress, useTemplateOffer, type SetupStep, type TemplateBase, type TemplateOutcome } from '@logic'
import { Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { TemplateStopped, TemplateWizard } from './TemplateWizard'

// The organization's setup (D-033, D-180): the steps this actor may do, in order, each marked done once what it sets
// up exists. A step opens its own module, so every step uses the forms that module already has. Any step may be
// skipped or done again; nothing about the setup is stored. A fresh unit is first offered a template (D-262), until the
// commander sets it aside; a template that stopped part way says where, above the checklist that finishes it.

const STEP_KEYS: Readonly<Record<SetupStepId, { readonly title: I18nKey; readonly body: I18nKey }>> = {
  unit_levels: { title: 'setup.steps.unit_levels.title', body: 'setup.steps.unit_levels.body' },
  units: { title: 'setup.steps.units.title', body: 'setup.steps.units.body' },
  command_ranks: { title: 'setup.steps.command_ranks.title', body: 'setup.steps.command_ranks.body' },
  rank_bindings: { title: 'setup.steps.rank_bindings.title', body: 'setup.steps.rank_bindings.body' },
  leave_types: { title: 'setup.steps.leave_types.title', body: 'setup.steps.leave_types.body' },
  tags: { title: 'setup.steps.tags.title', body: 'setup.steps.tags.body' },
  soldiers: { title: 'setup.steps.soldiers.title', body: 'setup.steps.soldiers.body' },
  deployments: { title: 'setup.steps.deployments.title', body: 'setup.steps.deployments.body' },
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
  const offer = useTemplateOffer()
  const [left, setLeft] = useState(false)
  const [stopped, setStopped] = useState<Extract<TemplateOutcome, { ok: false }> | null>(null)
  // The run itself makes the unit no longer fresh: the wizard stays until the run answers, so it can close or stop.
  const [running, setRunning] = useState<TemplateBase | null>(null)
  const base = running ?? (offer.status === 'ready' ? offer.value : null)
  if (!left && stopped === null && base !== null) {
    return (
      <TemplateWizard
        base={base}
        onRunning={setRunning}
        onLeave={() => {
          setLeft(true)
        }}
        onStop={setStopped}
      />
    )
  }
  return <SetupChecklist stopped={stopped} />
}

function SetupChecklist({ stopped }: { readonly stopped: Extract<TemplateOutcome, { ok: false }> | null }) {
  const progress = useSetupProgress()
  if (progress.status === 'failed') return <FailureNotice error={progress.error} />
  if (progress.status === 'loading') return <LoadingNotice />
  const steps = progress.value
  const done = steps.filter((step) => step.done).length
  const summary = [String(done), t('setup.progressOf'), String(steps.length), t('setup.progressDone')].join(WORD)
  return (
    <div className="flex flex-col gap-md">
      {stopped === null ? null : <TemplateStopped outcome={stopped} />}
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
