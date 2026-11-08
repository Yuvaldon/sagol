import { IssueCode, type Issue } from '@contracts'
import { fieldNameOf } from '@logic'
import type { I18nKey } from '@i18n'
import { issueKey } from '../errors/messages'

// Between field issues (D-068) and TanStack Form. V1 settles the form pattern; these are the parts
// the first two forms share.

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
