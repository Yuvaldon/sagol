/**
 * Architecture guardrails (see docs/ARCHITECTURE.md).
 *
 *   contracts  <-  domain  <-  data | logic  <-  ui  <-  app
 *   config imports contracts only; i18n imports nothing (leaf, used by ui and app).
 *
 * npm packages per layer:
 *   contracts -> zod only (D-020); its *.test.ts may also use vitest and docs/schema.sql (D-039)
 *   domain    -> @internationalized/date only (D-035); its *.test.ts may also use vitest (D-061)
 *   config    -> zod only (env schema); its *.test.ts may also use vitest (D-074)
 *   i18n      -> nothing
 *
 * Inside ui (view engines, ARCHITECTURE "View engines"):
 *   - an engine never imports another engine or a module (only the registry imports engines);
 *   - engine `core` folders never import React (or React-bound packages) nor any other layer;
 *   - only an engine's `adapter` folder knows domain entities (contracts / logic).
 *
 * Every rule is severity "error": `npm run check:layers` fails on any breach.
 */

const LAYER = (names) => `^src/(${names.join('|')})/`
const NPM = '^node_modules/'
const REACT_BOUND =
  '^node_modules/(@types/)?(react|react-dom|react-aria|react-aria-components|react-stately|motion|lucide-react|@tanstack/react-[^/]+|@dnd-kit/[^/]+|@testing-library/[^/]+)/'

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ---------------------------------------------------------------- layers
    {
      name: 'contracts-imports-zod-only',
      comment: 'contracts holds Zod schemas and inferred types; it imports nothing but zod.',
      severity: 'error',
      from: { path: '^src/contracts/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['^src/contracts/', '^node_modules/zod/'] },
    },
    {
      name: 'contracts-tests-read-schema-only',
      comment:
        'contracts tests may also use vitest and read docs/schema.sql (drift test, D-039).',
      severity: 'error',
      from: { path: '^src/contracts/.+\\.test\\.ts$' },
      to: {
        pathNot: ['^src/contracts/', '^node_modules/zod/', '^node_modules/vitest/', '^docs/schema\\.sql$'],
      },
    },
    {
      name: 'domain-imports-contracts-only',
      comment: 'domain is pure: contracts and @internationalized/date only (D-007, D-035).',
      severity: 'error',
      from: { path: '^src/domain/', pathNot: '\\.test\\.ts$' },
      to: {
        pathNot: ['^src/domain/', '^src/contracts/', '^node_modules/@internationalized/date/'],
      },
    },
    {
      name: 'domain-tests-add-vitest-only',
      comment: 'domain tests may also use vitest (D-061).',
      severity: 'error',
      from: { path: '^src/domain/.+\\.test\\.ts$' },
      to: {
        pathNot: [
          '^src/domain/',
          '^src/contracts/',
          '^node_modules/@internationalized/date/',
          '^node_modules/vitest/',
        ],
      },
    },
    {
      name: 'config-imports-contracts-only',
      comment: 'config may depend on contracts and zod (env schema) only.',
      severity: 'error',
      from: { path: '^src/config/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: ['^src/config/', '^src/contracts/', '^node_modules/zod/'] },
    },
    {
      name: 'config-tests-add-vitest-only',
      comment: 'config tests may also use vitest (D-074).',
      severity: 'error',
      from: { path: '^src/config/.+\\.test\\.ts$' },
      to: {
        pathNot: ['^src/config/', '^src/contracts/', '^node_modules/zod/', '^node_modules/vitest/'],
      },
    },
    {
      name: 'i18n-imports-nothing',
      comment: 'i18n is a pure dictionary layer and imports nothing.',
      severity: 'error',
      from: { path: '^src/i18n/' },
      to: { pathNot: '^src/i18n/' },
    },
    {
      name: 'data-allowed-layers',
      comment: 'data may import contracts, domain and config only.',
      severity: 'error',
      from: { path: '^src/data/' },
      to: { path: LAYER(['logic', 'ui', 'i18n', 'app']) },
    },
    {
      name: 'logic-allowed-layers',
      comment: 'logic may import contracts, domain and config only (data is injected by app).',
      severity: 'error',
      from: { path: '^src/logic/' },
      to: { path: LAYER(['data', 'ui', 'i18n', 'app']) },
    },
    {
      name: 'ui-allowed-layers',
      comment: 'ui may import contracts, config, i18n and logic only.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: LAYER(['domain', 'data', 'app']) },
    },
    {
      name: 'public-api-only',
      comment: "Other layers may import a layer only through its index.ts, or its testing/index.ts (D-203).",
      severity: 'error',
      from: { path: '^src/([^/]+)/' },
      to: {
        path: '^src/[^/]+/',
        pathNot: ['^src/$1/', '^src/[^/]+/index\\.ts$', '^src/[^/]+/testing/index\\.ts$'],
      },
    },
    {
      name: 'testing-helpers-for-tests-only',
      comment: "A layer's testing/ folder holds test-only helpers (D-135): only test files and other helpers import it.",
      severity: 'error',
      from: { path: '^src/', pathNot: ['\\.test\\.tsx?$', '\\.dbtest\\.ts$', '^src/[^/]+/testing/'] },
      to: { path: '^src/[^/]+/testing/' },
    },
    {
      name: 'entry-point-uses-app-only',
      comment: 'src/main.tsx is a one-line entry point that talks to app only.',
      severity: 'error',
      from: { path: '^src/[^/]+\\.tsx?$' },
      to: { path: LAYER(['contracts', 'domain', 'config', 'data', 'logic', 'ui', 'i18n']) },
    },

    // ------------------------------------------------------------ ui inside
    {
      name: 'engines-are-independent',
      comment: 'An engine never imports another engine. Only the registry maps view ids to engines.',
      severity: 'error',
      from: { path: '^src/ui/engines/([^/]+)/', pathNot: '^src/ui/engines/registry/' },
      to: { path: '^src/ui/engines/', pathNot: '^src/ui/engines/$1/' },
    },
    {
      name: 'engines-never-import-modules',
      comment: 'Engines are generic renderers; they never import management modules.',
      severity: 'error',
      from: { path: '^src/ui/engines/' },
      to: { path: '^src/ui/modules/' },
    },
    {
      name: 'core-never-imports-react',
      comment: 'Engine core folders are pure logic: no React and no React-bound packages.',
      severity: 'error',
      from: { path: '/core/' },
      to: { path: REACT_BOUND },
    },
    {
      name: 'core-is-self-contained',
      comment: 'Engine core folders know no other layer and no other folder of the engine.',
      severity: 'error',
      from: { path: '^src/ui/engines/([^/]+)/core/' },
      to: { pathNot: ['^src/ui/engines/$1/core/', NPM] },
    },
    {
      name: 'only-adapters-know-the-domain',
      comment: 'Only an engine adapter translates domain entities into the neutral engine model.',
      severity: 'error',
      from: { path: '^src/ui/engines/[^/]+/', pathNot: '^src/ui/engines/[^/]+/adapter/' },
      to: { path: LAYER(['contracts', 'logic']) },
    },

    // --------------------------------------------------------------- general
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      comment: 'Every import must resolve (catches imports of packages that are not installed).',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
}
