import { REMOTE } from '../remote'

// The installable app (D-182 … D-185): where the service worker lives, what it never answers, and how
// often the open app asks for a new version.

export const PWA = {
  /** The worker the build writes at the root, so its scope is the whole app (D-183). */
  serviceWorkerPath: '/sw.js',
  /** Paths the worker never answers from its cache, even as a navigation (D-183). */
  networkOnlyPaths: [REMOTE.commandsPath, REMOTE.authPath],
  /** The open app asks for a new version this often, besides when it opens (D-183). */
  updateCheckMs: 60 * 60 * 1000,
  /** The installed app reports this display mode (D-184). */
  standaloneMediaQuery: '(display-mode: standalone)',
  /** iPhone, iPad and iPod, where installing is "Add to Home Screen" and not a browser prompt (D-184). */
  iosUserAgent: /iPad|iPhone|iPod/,
} as const
