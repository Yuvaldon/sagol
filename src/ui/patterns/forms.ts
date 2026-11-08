import { IssueCode, type AppError, type Issue } from '@contracts'
import { fieldNameOf, formFieldIssues } from '@logic'
import type { I18nKey } from '@i18n'
import { issueKey } from '../errors/messages'

// Between field issues (D-068) and TanStack Form. The form validates early with the schema, and the
// adapter stays the authority: its answer lands on the fields, or above them if no field fits.

/** What the adapter answered to the last submit. */
export interface FormState {
  readonly answered: readonly Issue[]
  readonly failure: AppError | null
}

export const CLEAN_FORM: FormState = { answered: [], failure: null }

/** Issues go to the fields on screen, and everything else goes above the actions. */
export function formStateOf(error: AppError, fields: readonly string[]): FormState {
  if (error.code !== 'validation_failed') return { answered: [], failure: error }
  const issues = formFieldIssues(error.issues)
  const unplaced = issues.filter((issue) => !fields.includes(fieldNameOf(issue)))
  return {
    answered: issues,
    failure: unplaced.length === 0 ? null : { code: 'validation_failed', issues: unplaced },
  }
}

/** The result of a form-level validator: each field gets its issue code. */
export function validatorResult(issues: readonly Issue[]) {
  if (issues.length === 0) return undefined
  return { fields: Object.fromEntries(issues.map((issue) => [fieldNameOf(issue), issue.code])) }
}

/** The message of a field: its own validation first, then what the adapter answered. */
export function fieldError(errors: readonly unknown[], name: string, answered: readonly Issue[]): I18nKey | null {
  const parsed = IssueCode.safeParse(errors[0])
  if (parsed.success) return issueKey(parsed.data)
  const issue = answered.find((candidate) => fieldNameOf(candidate) === name)
  return issue === undefined ? null : issueKey(issue.code)
}
