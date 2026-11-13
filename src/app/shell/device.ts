import { PWA } from '@config'

// What the browser says about where the app runs (D-184): the install offer and the notifications switch both ask.

export function isStandalone(): boolean {
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true
  return iosStandalone || matchMedia(PWA.standaloneMediaQuery).matches
}

/** An iPad reports itself as a Mac with touch since iPadOS 13. */
export function isIos(): boolean {
  return PWA.iosUserAgent.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
