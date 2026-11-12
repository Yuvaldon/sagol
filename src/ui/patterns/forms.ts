import { IssueCode, type AppError, type Issue } from '@contracts'
import { fieldNameOf, formFieldIssues } from '@logic'
import type { I18nKey } from '@i18n'
import { issueKey } from '../errors/messages'

// Between field issues (D-068) and TanStack Form. The form validates early with the schema, and the
// adapter stays the authority: its answer lands on the fields, or above them if no field fits.

/**
 * The name TanStack Form gives the field at an issue's path: a list's index in brackets, so `['rows', 1, 'reason']`
 * is `rows[1].reason` (D-275). A path without a list reads as its dotted name, such as `organization.name`. Messages
 * and answered issues match by the dotted name (`fieldNameOf`).
 */
function formFieldName(issue: Issue): string {
  return issue.path.map((part, index) => (typeof part === 'number' ? `[${String(part)}]` : index === 0 ? part : `.${part}`)).join('')
}

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

/**
 * A command that writes several rows answers each row's issue at `<list>.<n>.<field>`. The form that made the rows
 * shows it on the field the row came from (OI-114): `renamed` maps a row's field to the form's, e.g. a row's
 * `soldier_id` to the form's `soldier_ids`.
 */
export function rowIssuesOnFields(error: AppError, list: string, renamed: Readonly<Record<string, string>>): AppError {
  if (error.code !== 'validation_failed') return error
  return {
    ...error,
    issues: error.issues.map((issue) => {
      const [head, index, field, ...rest] = issue.path
      if (head !== list || typeof index !== 'number' || typeof field !== 'string') return issue
      return { ...issue, path: [renamed[field] ?? field, ...rest] }
    }),
  }
}

/** The result of a form-level validator: each field gets its issue code. */
export function validatorResult(issues: readonly Issue[]) {
  if (issues.length === 0) return undefined
  return { fields: Object.fromEntries(issues.map((issue) => [formFieldName(issue), issue.code])) }
}

/** The message of a field: its own validation first, then what the adapter answered. */
export function fieldError(errors: readonly unknown[], name: string, answered: readonly Issue[]): I18nKey | null {
  const parsed = IssueCode.safeParse(errors[0])
  if (parsed.success) return issueKey(parsed.data)
  const issue = answered.find((candidate) => fieldNameOf(candidate) === name)
  return issue === undefined ? null : issueKey(issue.code)
}

/**
 * The message of a field in a form kept in local state: its own issues once submitted, then what the adapter
 * answered.
 */
export function issueError(own: readonly Issue[], answered: readonly Issue[], name: string): I18nKey | null {
  const issue = [...own, ...answered].find((candidate) => fieldNameOf(candidate) === name)
  return issue === undefined ? null : issueKey(issue.code)
}
