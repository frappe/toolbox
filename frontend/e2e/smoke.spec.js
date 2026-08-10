import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'
import { headingFor } from './toolPages'

test('@smoke serves All Tools at the site root', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'All tools' })).toBeVisible()
})

test('@smoke permanently redirects the old /toolbox links', async ({ request }) => {
  for (const [source, target] of [
    ['/toolbox', '/'],
    ['/toolbox/all-tools', '/'],
    ['/all-tools', '/'],
    ['/toolbox/calculator', '/calculator'],
  ]) {
    const response = await request.get(source, { maxRedirects: 0 })
    expect(response.status(), source).toBe(308)
    expect(new URL(response.headers().location, 'http://x').pathname, source).toBe(target)
  }
})

test('@smoke leaves Frappe\'s own pages alone', async ({ request }) => {
  // The route rules are an explicit list precisely so these keep working. A catch-all at the
  // root would hand them the Toolbox shell.
  for (const path of ['/login', '/app']) {
    const response = await request.get(path)
    expect(response.status(), path).toBeLessThan(400)
    expect(await response.text(), path).not.toContain('toolbox-sw.js')
  }
})

for (const path of [
  '/calculator',
  '/currency-converter',
  '/unit-converter',
  '/gst-calculator',
  '/emi-calculator',
  '/bmi-calculator',
  '/hsn-sac-lookup',
  '/timer',
]) {
  const heading = headingFor(path)

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
    start_url: '/',
    scope: '/',
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

test('@smoke installs the service worker at the site root', async ({ browserName, page }) => {
  // The WebKit project blocks the service worker (it cannot drive SW/offline headless); service
  // worker installation is covered on Chromium and Firefox.
  test.skip(browserName === 'webkit', 'The WebKit project runs with the service worker blocked')
  await page.goto('/')

  const scope = await page.evaluate(async () => {
    const activeRegistration = await navigator.serviceWorker.ready
    return new URL(activeRegistration.scope).pathname
  })

  expect(scope).toBe('/')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration('/')
        return registration?.active?.state
      }),
    )
    .toBe('activated')
})
