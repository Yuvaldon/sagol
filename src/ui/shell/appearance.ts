import { Appearance } from '@contracts'
import { useAppearance } from '@logic'
import { useEffect } from 'react'
import { useDeviceIsDark } from '../patterns/media'

// The soldier's appearance on the root element, where the theme reads it (D-181). Only the workspace knows the soldier,
// so the screens before it stay light; leaving the workspace (sign-out) takes the dark set off again.

const DARK_SET = 'dark'

export function useAppliedAppearance(): void {
  const { appearance } = useAppearance()
  const deviceIsDark = useDeviceIsDark()
  const dark = appearance === Appearance.enum.dark || (appearance === Appearance.enum.system && deviceIsDark)
  useEffect(() => {
    const root = document.documentElement
    if (dark) root.dataset.appearance = DARK_SET
    else delete root.dataset.appearance
    return () => {
      delete root.dataset.appearance
    }
  }, [dark])
}
