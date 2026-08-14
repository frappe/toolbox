import { expect, test } from './fixtures'
import { currencyApiPattern, currencyHistoryApiPattern, mockCurrencyRates } from './currency-fixture'
import { headingFor, OFFLINE_ROUTES } from './toolPages'

test.use({ allowOfflineNetworkErrors: true })

// Every tool that declares `offlineCapability: 'full'`, not a hand-picked eight. A newly minted
// route reaches the service worker's claim list through the registry, and this is the check that
// it actually did: the route set is injected at build time, and a route the worker does not claim
// serves nothing at all on an offline reload.
for (const path of OFFLINE_ROUTES) {
  const heading = headingFor(path)

  test(
    `launches ${heading} offline after installation`,
    { annotation: [{ type: 'tool', description: path.slice(1) }, { type: 'check', description: 'offline' }] },
    async ({ context, page }) => {
      await page.goto(path)
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.reload()
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
        .toBe(true)

      await context.setOffline(true)
      try {
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      } finally {
        await context.setOffline(false)
      }
    },
  )
}

test('@smoke keeps Calculator functional while offline', async ({ context, page }) => {
  await page.goto('/calculator')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    const expression = page.getByRole('textbox', { name: 'Expression' })
    await expression.fill('6 * 7')
    await expression.press('Enter')
    await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('42')
  } finally {
    await context.setOffline(false)
  }
})

// This one leaves the page loaded and moves inside the application instead of reloading. The
// snapshot is read when the view mounts, so an in-app navigation away and back exercises it just
// as a reload does, without depending on Firefox being willing to reload: while any page.route
// handler is installed it answers NS_ERROR_OFFLINE and fails the navigation itself, before the
// service worker is asked for the page. See #214 and the README.
test('uses the last Currency reference-rate snapshot offline', async ({ context, page }) => {
  await mockCurrencyRates(page)
  await page.goto('/currency-converter')
  const destination = page.getByRole('spinbutton', { name: 'Destination amount', exact: true })
  await expect(destination).toHaveValue('12') // 1000 INR → USD at the mocked rate
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.unroute(currencyApiPattern)
  await page.unroute(currencyHistoryApiPattern)
  await context.setOffline(true)
  try {
    // The sidebar opens the category of the tool being shown, so the hop stays inside Convert.
    // Both hops load a route chunk the worker has to serve, so this also proves the application
    // still navigates with no network.
    const navigation = page.getByRole('navigation', { name: 'Toolbox navigation' })
    await navigation.getByRole('link', { name: 'Length Converter', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Length Converter', level: 1 })).toBeVisible()
    await navigation.getByRole('link', { name: 'Currency Converter', exact: true }).click()

    await expect(destination).toHaveValue('12')
    // The prose below the tool says these words too, so the lookup is scoped to the state line.
    await expect(page.getByTestId('rate-state')).toContainText('offline snapshot')
  } finally {
    await context.setOffline(false)
  }
})

test('recovers an active Timer while offline', async ({ context, page }) => {
  await page.goto('/timer')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByLabel('Minutes').fill('1')
  await page.getByRole('button', { name: 'Set timer' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await expect(page.getByRole('timer')).not.toHaveText('00:01:00')
  } finally {
    await context.setOffline(false)
  }
})

test('keeps Financial Calculators functional while offline', async ({ context, page }) => {
  await page.goto('/cagr-calculator')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('spinbutton', { name: 'Starting value' }).fill('100')
    await page.getByRole('spinbutton', { name: 'Ending value' }).fill('121')
    await page.getByRole('spinbutton', { name: 'Duration' }).fill('2')
    await expect(page.getByRole('status', { name: 'Primary financial result' })).toHaveText(
      '10.00%',
    )
  } finally {
    await context.setOffline(false)
  }
})

test('keeps Health Calculators functional while offline', async ({ context, page }) => {
  await page.goto('/pace-calculator')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#pace-duration').fill('25:00')
    await expect(page.getByRole('status', { name: 'Primary health result' })).toHaveText('05:00 per km')
  } finally {
    await context.setOffline(false)
  }
})
