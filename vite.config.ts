import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Auth modes that must never reach a production bundle (D-006). Replaced by the
// AuthMode enum from @contracts once it exists (see docs/sessions/01-tooling.md).
const AUTH_MODE_VARIABLE = 'VITE_AUTH_MODE'
const DEVELOPMENT_ONLY_AUTH_MODES: readonly string[] = ['local']

/** Refuses a production build whose auth mode is a development-only mode. */
function productionEnvGuard(): Plugin {
  return {
    name: 'sagol:production-env-guard',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      const authMode = env[AUTH_MODE_VARIABLE]
      if (authMode !== undefined && DEVELOPMENT_ONLY_AUTH_MODES.includes(authMode)) {
        throw new Error(
          `${AUTH_MODE_VARIABLE}=${authMode} is development-only and is refused in a production build (D-006).`,
        )
      }
    },
  }
}

// Path aliases are read from tsconfig.app.json ("paths") so that the
// layer map is defined in exactly one place.
export default defineConfig({
  plugins: [productionEnvGuard(), react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
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
    ],
  },
})
