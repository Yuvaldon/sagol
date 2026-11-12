import type { SetupStepId } from '@config'
import { t, type I18nKey } from '@i18n'
import type { SetupStep } from '@logic'

// The words of each setup step (D-033), shared by the checklist and the panel's progress callout (D-284).

export const STEP_KEYS: Readonly<Record<SetupStepId, { readonly title: I18nKey; readonly body: I18nKey }>> = {
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
export const WORD = ' '

/** The step's title, for a line that names it elsewhere (the progress callout). */
export function stepTitle(step: SetupStep): string {
  return t(STEP_KEYS[step.id].title)
}

/** "2 מתוך 8 צעדים הושלמו". */
export function progressText(steps: readonly SetupStep[]): string {
  const done = steps.filter((step) => step.done).length
  return [String(done), t('setup.progressOf'), String(steps.length), t('setup.progressDone')].join(WORD)
}
