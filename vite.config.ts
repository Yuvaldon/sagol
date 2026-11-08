import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { DEVELOPMENT_ONLY_AUTH_MODES } from './src/contracts/index.ts'
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
