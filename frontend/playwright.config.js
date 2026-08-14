import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.TOOLBOX_E2E_BASE_URL || 'http://toolbox-test.localhost:8100'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  // Toolbox has no accounts, so there is no shared server-side record for specs to race on.
  // Preferences live in each context's own sessionStorage, which is already isolated per test.
  // The suite ran serially only while every spec signed in as the same Administrator.
  fullyParallel: true,
  // The matrix grew from 355 tests to about 880 when the QA suite landed, across five projects
  // rather than four. On an 8 GB machine Playwright's default of one worker per two cores ran four
  // browsers at once beside the bench and exhausted memory: the failures came back as navigation
  // timeouts and a Firefox subprocess that would not launch, which reads exactly like a regression
  // and is not one. Three workers still left WebKit timing out on two or three tests a run, a
  // different two or three each time.
  //
  // Two is the number that holds. It costs about three minutes on a full run, and it buys a suite
  // whose failures mean something. Raise it only on a machine with more memory.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /responsive\.spec\.js|visual\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /responsive\.spec\.js/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      // `navigation` and `storage` sweep all 37 routes in one test each. What they check — the
      // sitemap, the redirects, unique metadata, which storage keys survive — is the same on
      // every engine, so they run on Chromium alone. Repeating a 37-page walk on three engines
      // tripled the peak memory and bought nothing.
      testIgnore: /responsive\.spec\.js|visual\.spec\.js|navigation\.spec\.js|storage\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      // WebKit headless cannot drive service-worker offline mode (it raises an internal error),
      // so offline behaviour is covered on Chromium and Firefox. Blocking the service worker
      // here also stops WebKit routing app fetches through the SW, which otherwise escapes
      // page.route and defeats the currency-rate mock. WebKit exercises no SW-dependent path.
      testIgnore: /responsive\.spec\.js|visual\.spec\.js|offline\.spec\.js|navigation\.spec\.js|storage\.spec\.js/,
      use: {
        ...devices['Desktop Safari'],
        serviceWorkers: 'block',
        // WebKit is the slowest of the three to open a cold page, and on a machine running two
        // other browsers beside the bench it crosses the shared 15s budget on a first load. The
        // extra headroom is WebKit's alone, so a page that is genuinely slow on Chromium or
        // Firefox still fails there.
        navigationTimeout: 30_000,
      },
    },
    {
      // A reference image records one renderer. Comparing it against another engine's text
      // rasterization reports a difference on every run, so the visual sweep is Chromium's alone
      // and sets its own viewport per case.
      name: 'visual',
      testMatch: /visual\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
