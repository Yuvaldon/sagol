import { useLinkReviewAccess, useUnits } from '@logic'

const NO_UNITS: readonly never[] = []

/** Whether the account requests section is for this actor (D-157). A hint: the list is filtered again. */
export function useAccountRequestsAccess(): boolean {
  const units = useUnits()
  return useLinkReviewAccess(units.status === 'ready' ? units.value : NO_UNITS)
}
