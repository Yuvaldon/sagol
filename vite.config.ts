import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { minimal2023Preset } from '@vite-pwa/assets-generator/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { DEVELOPMENT_ONLY_AUTH_MODES } from './src/contracts/auth/development-modes.ts'
import { ENV_VARIABLES } from './src/config/env/names.ts'
import { PWA } from './src/config/pwa/index.ts'
import { dictionary } from './src/i18n/he/dictionary.ts'

const DEVELOPMENT_ONLY: readonly string[] = DEVELOPMENT_ONLY_AUTH_MODES

/** Refuses a production build whose auth mode is a development-only mode (D-006, OI-002). */
function productionEnvGuard(): Plugin {
  return {
    name: 'sagol:production-env-guard',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const authMode = env[ENV_VARIABLES.authMode]
      if (authMode !== undefined && DEVELOPMENT_ONLY.includes(authMode)) {
        throw new Error(
          `${ENV_VARIABLES.authMode}=${authMode} is development-only and is refused in a production build (D-006).`,
        )
      }
    },
  }
}

/** The light theme's value of a color token: the first definition, in the @theme block (D-182). */
function lightToken(name: string): string {
  const css = readFileSync(resolve(import.meta.dirname, 'src/ui/theme/tailwind.css'), 'utf8')
  const value = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css)?.[1]
  if (value === undefined) throw new Error(`The theme has no --color-${name} value (D-182).`)
  return value
}

const THEME_DIR = resolve(import.meta.dirname, 'src/ui/theme')
const APP_ICON = 'app-icon.svg'
const CANVAS = lightToken('canvas')
const ICON_GROUND = lightToken('surface')
const ICON_COLORS = [ICON_GROUND, lightToken('brand-light'), lightToken('brand'), lightToken('brand-deep')]
const APP_NAME = dictionary.app.name

/**
 * The installed app's head (D-182): its bar color, its name and standalone mode on Apple devices. The icon is the
 * company's bison in the brand gradient on the surface, and the build refuses one that drifted from those tokens.
 */
function installedAppHead(): Plugin {
  return {
    name: 'sagol:installed-app-head',
    buildStart() {
      const icon = readFileSync(resolve(THEME_DIR, APP_ICON), 'utf8').toLowerCase()
      const drawn = new Set(icon.match(/#[0-9a-f]{6}\b/g))
      const expected = new Set(ICON_COLORS.map((color) => color.toLowerCase()))
      if (drawn.size !== expected.size || [...drawn].some((color) => !expected.has(color))) {
        throw new Error(`${APP_ICON} must use exactly the theme's surface and brand colors ${ICON_COLORS.join(', ')} (D-182).`)
      }
    },
    generateBundle() {
      // The page links the source icon as its scalable favicon.
      this.emitFile({ type: 'asset', fileName: APP_ICON, source: readFileSync(resolve(THEME_DIR, APP_ICON)) })
    },
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'theme-color', content: CANVAS }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: APP_NAME }, injectTo: 'head' },
    ],
  }
}

/** Escapes a path for a route pattern of the service worker. */
function pathPattern(path: string): RegExp {
  return new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
}

/**
 * The service worker (D-183): the app shell only, and only in a production build. Navigations fall back to the
 * cached page, except the command gateway and auth, which always go to the network. No data is cached.
 */
const installedApp = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  filename: PWA.serviceWorkerPath.slice(1),
  devOptions: { enabled: false },
  pwaAssets: {
    image: resolve(THEME_DIR, APP_ICON),
    integration: { publicDir: THEME_DIR, baseUrl: '/' },
    htmlPreset: '2023',
    injectThemeColor: false,
    overrideManifestIcons: true,
    config: false,
    preset: {
      ...minimal2023Preset,
      maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: ICON_GROUND } },
      apple: { ...minimal2023Preset.apple, resizeOptions: { background: ICON_GROUND } },
    },
  },
  manifest: {
    name: APP_NAME,
    short_name: APP_NAME,
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    theme_color: CANVAS,
    background_color: CANVAS,
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: PWA.networkOnlyPaths.map(pathPattern),
    cleanupOutdatedCaches: true,
  },
})

/**
 * Libraries in chunks of their own (D-210): they change only on an upgrade, so a deploy of the app's
 * code leaves them cached, and no chunk passes Vite's 500 kB warning.
 */
const VENDOR_CHUNKS: readonly { readonly name: string; readonly packages: readonly string[] }[] = [
  { name: 'react', packages: ['react', 'react-dom', 'scheduler'] },
  { name: 'aria', packages: ['react-aria', 'react-aria-components', 'react-stately', '@react-aria', '@react-stately', '@react-types', '@internationalized'] },
  { name: 'tanstack', packages: ['@tanstack'] },
  { name: 'motion', packages: ['motion', 'motion-dom', 'motion-utils', 'framer-motion'] },
  { name: 'zod', packages: ['zod'] },
  { name: 'workbox', packages: ['workbox-window'] },
]

function vendorTest(packages: readonly string[]): RegExp {
  const names = packages.map((name) => name.replace('/', '[\\/]')).join('|')
  return new RegExp(`[\\/]node_modules[\\/](${names})[\\/]`)
}

// Path aliases are read from tsconfig.app.json ("paths") so that the
// layer map is defined in exactly one place.
export default defineConfig({
  plugins: [productionEnvGuard(), react(), tailwindcss(), installedAppHead(), installedApp],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_CHUNKS.map(({ name, packages }) => ({ name, test: vendorTest(packages) })) },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        // The gateway over a migrated Postgres (D-201): `npm run test:db`, never part of `check`.
        extends: true,
        test: { name: 'db', environment: 'node', include: ['src/**/*.dbtest.ts'], fileParallelism: false },
      },
      {
        // The public Data API in front of that database (D-203): `npm run test:rest`, in CI after `test:db`.
        extends: true,
        test: { name: 'rest', environment: 'node', include: ['src/**/*.resttest.ts'] },
      },
    ],
  },
})
