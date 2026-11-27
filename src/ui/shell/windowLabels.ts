import type { I18nKey } from '@i18n'
import type { WindowKind } from '@logic'

// The names of a window's arrows, by its kind (D-211): what a step back or forward reaches.

export const PREVIOUS_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.previousWindow.day',
  week: 'workspace.previousWindow.week',
  two_weeks: 'workspace.previousWindow.two_weeks',
  four_weeks: 'workspace.previousWindow.four_weeks',
  month: 'workspace.previousWindow.month',
  rotation: 'workspace.previousWindow.rotation',
  custom: 'workspace.previousWindow.custom',
}
export const NEXT_LABELS: Record<WindowKind, I18nKey> = {
  day: 'workspace.nextWindow.day',
  week: 'workspace.nextWindow.week',
  two_weeks: 'workspace.nextWindow.two_weeks',
  four_weeks: 'workspace.nextWindow.four_weeks',
  month: 'workspace.nextWindow.month',
  rotation: 'workspace.nextWindow.rotation',
  custom: 'workspace.nextWindow.custom',
}
