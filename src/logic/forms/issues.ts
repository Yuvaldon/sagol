import type { Issue } from '@contracts'
import { issuesFromSchema } from '@domain'
import type { z } from 'zod'

/**
 * Field issues of a form value, with the same codes the adapter answers (D-068, OI-024). Empty
 * when the value is valid. The adapter stays the authority: a form only reports early.
 */
export function formIssues(schema: z.ZodType, value: unknown): Issue[] {
  const parsed = schema.safeParse(value)
  return parsed.success ? [] : issuesFromSchema(parsed.error.issues, value)
}

/** The name a form gives the field at this path, such as `organization.name`. */
export function fieldNameOf(issue: Issue): string {
  return issue.path.join('.')
}
