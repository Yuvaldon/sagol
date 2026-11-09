import { defineConfig, devices } from '@playwright/test'

// The slice demos, in a real browser (D-075): desktop and mobile, RTL, with axe. They run against
// the dev server, because a production build refuses the local identity (D-006).

const BASE_URL = 'http://localhost:5173'
const onCi = process.env.CI !== undefined

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
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
