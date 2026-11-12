import { t } from '@i18n'
import {
  nextSetupStep,
  usePanel,
  useSetupProgress,
  useTemplateOffer,
  type SetupStep,
  type TemplateBase,
  type TemplateOutcome,
} from '@logic'
import { Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { STEP_KEYS, WORD, progressText } from './steps'
import { TemplateStopped, TemplateWizard } from './TemplateWizard'

// The organization's setup (D-033, D-180): the steps this actor may do, in order, each marked done once what it sets
// up exists. A step opens its own module, so every step uses the forms that module already has. Any step may be
// skipped or done again; nothing about the setup is stored. A fresh unit is first offered a template (D-262), until the
// commander sets it aside; a template that stopped part way says where, above the checklist that finishes it.

function StepRow({
  step,
  position,
  isNext,
  onGo,
}: {
  readonly step: SetupStep
  readonly position: number
  readonly isNext: boolean
  readonly onGo: (step: SetupStep) => void
}) {
  const keys = STEP_KEYS[step.id]
  const title = t(keys.title)
  return (
    <li aria-current={isNext ? 'step' : undefined} className="flex items-center gap-sm border-b border-line py-sm">
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
        <span className="text-micro font-semibold">{t(step.done ? 'setup.done' : isNext ? 'setup.next' : 'setup.notDone')}</span>
      </span>
      <Button
        aria-label={[t('setup.go'), title].join(WORD)}
        variant={isNext ? 'primary' : 'quiet'}
        onPress={() => {
          onGo(step)
        }}
      >
        {t('setup.go')}
        <ChevronLeft aria-hidden size={14} />
      </Button>
    </li>
  )
}

/** The steps in order, the next one marked (D-285); a step opens the module that does it. */
export function SetupChecklist({ steps, onGo }: { readonly steps: readonly SetupStep[]; readonly onGo: (step: SetupStep) => void }) {
  const next = nextSetupStep(steps)
  return (
    <div className="flex flex-col gap-md">
      <p role="status" className="text-name font-semibold tabular-nums">
        {progressText(steps)}
      </p>
      <ol aria-label={t('setup.listLabel')} className="flex flex-col">
        {steps.map((step, index) => (
          <StepRow key={step.id} step={step} position={index + 1} isNext={step.id === next?.id} onGo={onGo} />
        ))}
      </ol>
    </div>
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
  return <SetupSteps stopped={stopped} />
}

function SetupSteps({ stopped }: { readonly stopped: Extract<TemplateOutcome, { ok: false }> | null }) {
  const panel = usePanel()
  const progress = useSetupProgress()
  if (progress.status === 'failed') return <FailureNotice error={progress.error} />
  if (progress.status === 'loading') return <LoadingNotice />
  return (
    <div className="flex flex-col gap-md">
      {stopped === null ? null : <TemplateStopped outcome={stopped} />}
      <SetupChecklist
        steps={progress.value}
        onGo={(step) => {
          panel.open(step.panel)
        }}
      />
    </div>
  )
}
