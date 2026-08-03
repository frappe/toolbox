import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.TOOLBOX_E2E_BASE_URL || 'http://toolbox-test.localhost:8100'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
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
      testIgnore: /responsive\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /responsive\.spec\.js/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      testIgnore: /responsive\.spec\.js/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      // WebKit headless cannot drive service-worker offline mode (it raises an internal
      // error); offline behaviour is covered on Chromium and Firefox.
      testIgnore: /responsive\.spec\.js|offline\.spec\.js/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
