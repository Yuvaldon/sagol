import { useCurrentOrganization, useDateWindow, useSoldiers } from '@logic'

/**
 * Whether the board shows, and with it the controls that act on it: the dates, the view, the filters (D-173). With no
 * window yet, they do not exist. Routine (no rotation) shows the board too, under its band (D-257, D-222).
 */
export function useBoardShown(): boolean {
  const { window } = useDateWindow()
  return window !== null
}

/**
 * Whether the viewport shows its notice instead of a board: a soldier who may not view the organization and reads no
 * soldier at all (D-151, D-160).
 */
export function useNoBoard(): boolean {
  const organization = useCurrentOrganization()
  const soldiers = useSoldiers()
  return (
    organization.status === 'ready' &&
    organization.value === null &&
    soldiers.status === 'ready' &&
    soldiers.value.length === 0
  )
}
