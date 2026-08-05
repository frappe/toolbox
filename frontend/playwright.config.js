import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.TOOLBOX_E2E_BASE_URL || 'http://toolbox-test.localhost:8100'

// Signed-in session shared by every browser project; produced by the `setup` project.
const storageState = 'e2e/.auth/user.json'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  // Toolbox is single-owner: every browser project signs in as the same Administrator and
  // shares one server-side preference record. Running specs in parallel lets one test's
  // favourite/saved-pair/world-clock writes clobber another's, so the suite runs serially.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'chromium',
      testIgnore: /responsive\.spec\.js|auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chromium',
      testMatch: /responsive\.spec\.js/,
      use: { ...devices['Pixel 7'], storageState },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      testIgnore: /responsive\.spec\.js|auth\.setup\.js/,
      use: { ...devices['Desktop Firefox'], storageState },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      // WebKit headless cannot drive service-worker offline mode (it raises an internal error),
      // so offline behaviour is covered on Chromium and Firefox. Blocking the service worker
      // here also stops WebKit routing app fetches through the SW, which otherwise escapes
      // page.route and defeats the currency-rate mock. WebKit exercises no SW-dependent path.
      testIgnore: /responsive\.spec\.js|offline\.spec\.js|auth\.setup\.js/,
      use: { ...devices['Desktop Safari'], storageState, serviceWorkers: 'block' },
      dependencies: ['setup'],
    },
  ],
})
