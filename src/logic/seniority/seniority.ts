import {
  CreateSeniorityOverrideInput,
  SeniorityOverrideId,
  type CalendarDate,
  type Issue,
  type SeniorityOverride,
  type SoldierId,
} from '@contracts'
import { activeOverrideOn, optionalText } from '@domain'
import { formIssues } from '../forms/issues'

// Personal seniority (D-029, D-179) on the soldier's page: created and revoked, never edited. Pure.

export interface SeniorityOverrideFormValues {
  /** Text while typed; the schema answers. */
  readonly seniority: string
  readonly valid_from: CalendarDate | ''
  /** '' = permanent. */
  readonly valid_to: CalendarDate | ''
  readonly reason: string
}

export function newSeniorityOverrideValues(today: CalendarDate): SeniorityOverrideFormValues {
  return { seniority: '', valid_from: today, valid_to: '', reason: '' }
}

/** '' is no value; anything else is a number, and what is not one stays for the schema to refuse. */
function numberOf(text: string): number | string | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : trimmed
}

function createInput(soldierId: SoldierId, values: SeniorityOverrideFormValues) {
  return {
    id: SeniorityOverrideId.parse(crypto.randomUUID()),
    soldier_id: soldierId,
    seniority: numberOf(values.seniority),
    valid_from: values.valid_from === '' ? undefined : values.valid_from,
    valid_to: values.valid_to === '' ? null : values.valid_to,
    reason: optionalText(values.reason),
  }
}

/** The schema's codes (D-068). An overlap is the command's to answer: it counts overrides the actor may not see. */
export function seniorityOverrideIssues(soldierId: SoldierId, values: SeniorityOverrideFormValues): Issue[] {
  return formIssues(CreateSeniorityOverrideInput, createInput(soldierId, values))
}

export function toCreateSeniorityOverrideInput(soldierId: SoldierId, values: SeniorityOverrideFormValues): CreateSeniorityOverrideInput {
  return CreateSeniorityOverrideInput.parse(createInput(soldierId, values))
}

/** A soldier's overrides, in the repository's order, revoked ones too: they stay as history (D-179). */
export function overridesOf(overrides: readonly SeniorityOverride[], soldierId: SoldierId): SeniorityOverride[] {
  return overrides.filter((override) => override.soldier_id === soldierId)
}

/** The override that sets the soldier's seniority today, or NULL. */
export function currentOverride(overrides: readonly SeniorityOverride[], soldierId: SoldierId, today: CalendarDate): SeniorityOverride | null {
  const active = activeOverrideOn(overrides, soldierId, today)
  return active === null ? null : (overrides.find((override) => override.id === active.id) ?? null)
}
