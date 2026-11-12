import { Appearance } from '@contracts'
import { useAppearance } from '@logic'
import { useEffect } from 'react'
import { useDeviceIsDark } from '../patterns/media'

// The soldier's appearance on the root element, where the theme reads it (D-181). Only the workspace knows the soldier,
// so the screens before it stay light; leaving the workspace (sign-out) takes the dark set off again.

const THEME_COLOR_META = 'meta[name="theme-color"]'
const CANVAS_PROPERTY = '--color-canvas'

export function useAppliedAppearance(): void {
  const { appearance } = useAppearance()
  const deviceIsDark = useDeviceIsDark()
  const dark = appearance === Appearance.enum.dark || (appearance === Appearance.enum.system && deviceIsDark)
  useEffect(() => {
    const root = document.documentElement
    if (dark) root.dataset.appearance = Appearance.enum.dark
    else delete root.dataset.appearance
    // The browser's bar and the installed app's status bar follow the canvas (D-182).
    const themeColor = document.querySelector<HTMLMetaElement>(THEME_COLOR_META)
    const built = themeColor?.content
    if (themeColor) themeColor.content = getComputedStyle(root).getPropertyValue(CANVAS_PROPERTY).trim()
    return () => {
      delete root.dataset.appearance
      if (themeColor && built !== undefined) themeColor.content = built
    }
  }, [dark])
}
