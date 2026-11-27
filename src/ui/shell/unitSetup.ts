import { useShellPlace } from '@logic'
import { useCallback } from 'react'

/** Opens "הגדרות", the page of "ניהול" where the setup's checklist is (D-297, D-456). */
export function useOpenUnitSetup(): () => void {
  const { openPage } = useShellPlace()
  return useCallback(() => {
    openPage('settings')
  }, [openPage])
}
