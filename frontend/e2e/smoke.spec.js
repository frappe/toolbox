import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'

test('@smoke redirects the app root to the canonical All Tools route', async ({ page }) => {
  await page.goto('/toolbox/')

  await expect(page).toHaveURL(/\/toolbox\/all-tools$/)
  await expect(page.getByRole('heading', { name: 'All tools' })).toBeVisible()
})

for (const [path, heading] of [
  ['/toolbox/calculator', 'Calculator'],
  ['/toolbox/currency-converter', 'Currency Converter'],
  ['/toolbox/unit-converter', 'Unit Converter'],
  ['/toolbox/gst-calculator', 'GST Calculator'],
  ['/toolbox/financial-calculators', 'Financial Calculators'],
  ['/toolbox/health-calculators', 'Health & Fitness Calculators'],
  ['/toolbox/hsn-sac-lookup', 'HSN & SAC Lookup'],
  ['/toolbox/timer', 'Timer, Stopwatch & Countdown'],
]) {
  test(`@smoke opens ${heading} directly`, async ({ page }) => {
    if (path.includes('currency-converter')) await mockCurrencyRates(page)
    if (path.includes('hsn-sac-lookup')) await mockHsnAvailable(page)
    await page.goto(path)

    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  })
}

test('@smoke serves a valid manifest, release, and service worker', async ({ request }) => {
  const manifestResponse = await request.get('/assets/toolbox/pwa/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json')
  expect(await manifestResponse.json()).toMatchObject({
    start_url: '/toolbox/all-tools',
    scope: '/toolbox/',
  })

  const releaseResponse = await request.get('/assets/toolbox/frontend/release.json')
  expect(releaseResponse.ok()).toBe(true)
  expect(await releaseResponse.json()).toMatchObject({
    releaseId: expect.stringMatching(/^[a-z0-9-]+$/),
    createdAt: expect.any(Number),
  })

  const workerResponse = await request.get('/toolbox-sw.js')
  expect(workerResponse.ok()).toBe(true)
  expect(workerResponse.headers()['content-type']).toContain('text/javascript')
  expect(await workerResponse.text()).toContain("const SHELL_CACHE_PREFIX = 'toolbox-shell-'")
})

test('@smoke installs the service worker at the Toolbox scope', async ({ page }) => {
  await page.goto('/toolbox/all-tools')

  const scope = await page.evaluate(async () => {
    const activeRegistration = await navigator.serviceWorker.ready
    return new URL(activeRegistration.scope).pathname
  })

  expect(scope).toBe('/toolbox/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration('/toolbox/')
        return registration?.active?.state
      }),
    )
    .toBe('activated')
})
