import type { AppError } from '@contracts'
import type { I18nKey } from '@i18n'
import { failureKey } from '../errors/messages'

/** Why a restore was refused, in the words of a restore: what it depends on, or what took its place. */
export function restoreFailureKey(error: AppError): I18nKey {
  const [issue] = error.code === 'validation_failed' ? error.issues : []
  switch (issue?.code) {
    case 'reference_archived':
      return 'archived.blockedArchived'
    case 'reference_not_found':
      return 'archived.blockedMissing'
    case 'already_exists':
      return 'archived.blockedTaken'
    // A unit with no parent while another live root exists (D-251).
    case 'required':
      return issue.path[0] === 'parent_id' ? 'archived.blockedRoot' : failureKey(error)
    default:
      return failureKey(error)
  }
}
