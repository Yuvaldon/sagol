import { defineConfig, devices } from '@playwright/test'

// The slice demos, in a real browser (D-075): desktop and mobile, RTL, with axe. They run against
// the dev server, because a production build refuses the local identity (D-006).

const BASE_URL = 'http://localhost:5173'
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !onCi,
  },
})
