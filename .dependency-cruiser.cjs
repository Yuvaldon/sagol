/**
 * Architecture guardrails (see docs/ARCHITECTURE.md).
 *
 * Layers:   contracts  <-  config  <-  data | logic  <-  ui  <-  app
 * i18n is a leaf layer used by ui and app.
 *
 * Every rule is severity "error": `npm run check:layers` fails on any breach.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'contracts-are-isolated',
      comment: 'contracts holds types/interfaces only and imports nothing from other layers.',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { path: '^src/', pathNot: '^src/contracts/' },
    },
    {
      name: 'i18n-is-isolated',
      comment: 'i18n is a pure dictionary layer and imports nothing from other layers.',
      severity: 'error',
      from: { path: '^src/i18n/' },
      to: { path: '^src/', pathNot: '^src/i18n/' },
    },
    {
      name: 'config-only-contracts',
      comment: 'config may depend on contracts (types) only.',
      severity: 'error',
      from: { path: '^src/config/' },
      to: { path: '^src/(data|logic|ui|i18n|app)/' },
    },
    {
      name: 'data-no-upper-layers',
      comment: 'data must not know about logic, ui, i18n or app.',
      severity: 'error',
      from: { path: '^src/data/' },
      to: { path: '^src/(logic|ui|i18n|app)/' },
    },
    {
      name: 'logic-no-data-or-ui',
      comment: 'logic never imports data directly (it receives it by injection) and never imports ui.',
      severity: 'error',
      from: { path: '^src/logic/' },
      to: { path: '^src/(data|ui|i18n|app)/' },
    },
    {
      name: 'ui-no-data-or-app',
      comment: 'ui talks to logic only (through its public API). Never to data, never to app.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(data|app)/' },
    },
    {
      name: 'public-api-only',
      comment: 'Other layers may import a layer only through its index.ts.',
      severity: 'error',
      from: { path: '^src/([^/]+)/' },
      to: {
        path: '^src/[^/]+/',
        pathNot: ['^src/$1/', '^src/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'entry-point-uses-app-only',
      comment: 'src/main.tsx is a one-line entry point that talks to app only.',
      severity: 'error',
      from: { path: '^src/[^/]+\\.tsx?$' },
      to: { path: '^src/(contracts|config|data|logic|ui|i18n)/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src/',
  },
}
