import { defineConfig, devices } from '@playwright/test'
import { ENV_VARIABLES } from './src/config/env/names.ts'

// The slice demos, in a real browser (D-075): desktop and mobile, RTL, with axe. They run against
// the dev server, because a production build refuses the local identity (D-006). The installed app (D-182, D-183)
// exists only in a production build, so its spec runs alone against `vite preview` of one.

const BASE_URL = 'http://localhost:5173'
/** A sample P-256 public key, test data: the dev server offers phone notifications with it (D-354). */
const SAMPLE_PUSH_PUBLIC_KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM'
const PREVIEW_URL = 'http://localhost:4173'
const PRODUCTION_ONLY = /pwa\.spec\.ts/
/** A phone on its side gets the layout checks only: the demos already walk the same bars upright (D-190). */
const LAYOUT = /layout\.spec\.ts/
const onCi = process.env.CI !== undefined
// A slice demo walks the whole slice in one test, with axe after each step. The longest (V4's leaves, V5's
// approval) take 22 s with two workers here, each of their 7-8 steps 1.5-5 s, and cross Playwright's default
// 30 s on a slower CI runner. No step waits on a race; the budget is for a demo's length, and still ends a hang.
const DEMO_TIMEOUT_MS = 60_000

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  timeout: DEMO_TIMEOUT_MS,
  // Every worker loads the app from the one dev server, which serves unbundled modules. Past two workers the
  // longest demos slow down more than threefold and cross the timeout, with no race behind it (OI-061). CI
  // runs two as well, so a local run is the run CI makes.
  workers: 2,
  forbidOnly: onCi,
  reporter: onCi ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: PRODUCTION_ONLY },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: PRODUCTION_ONLY },
    { name: 'landscape', use: { ...devices['Pixel 7 landscape'] }, testMatch: LAYOUT },
    { name: 'installable', use: { ...devices['Pixel 7'], baseURL: PREVIEW_URL }, testMatch: PRODUCTION_ONLY },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: BASE_URL,
      // A sample public key, so the profile offers phone notifications where a spec stubs the push manager (D-354).
      // The dev server has no service worker, so every other spec still sees no group.
      env: { [ENV_VARIABLES.pushPublicKey]: SAMPLE_PUSH_PUBLIC_KEY },
      reuseExistingServer: !onCi,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: !onCi,
    },
  ],
})
