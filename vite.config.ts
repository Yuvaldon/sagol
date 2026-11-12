import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { DEVELOPMENT_ONLY_AUTH_MODES } from './src/contracts/auth/development-modes.ts'
import { ENV_VARIABLES } from './src/config/env/names.ts'

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
]

function vendorTest(packages: readonly string[]): RegExp {
  const names = packages.map((name) => name.replace('/', '[\\/]')).join('|')
  return new RegExp(`[\\/]node_modules[\\/](${names})[\\/]`)
}

// Path aliases are read from tsconfig.app.json ("paths") so that the
// layer map is defined in exactly one place.
export default defineConfig({
  plugins: [productionEnvGuard(), react(), tailwindcss()],
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
