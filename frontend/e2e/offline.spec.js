import { expect, test } from './fixtures'
import { currencyApiPattern, mockCurrencyRates } from './currency-fixture'
import { headingFor } from './toolPages'

test.use({ allowOfflineNetworkErrors: true })

for (const path of [
  '/calculator',
  '/length-converter',
  '/gst-calculator',
  '/emi-calculator',
  '/bmi-calculator',
  '/timer',
  // A newly minted route reaches the service worker's claim list through the registry. This is
  // the check that it actually did: the route set is injected at build time, and a route the
  // worker does not claim serves nothing at all on an offline reload.
  '/stopwatch',
]) {
  const heading = headingFor(path)

  test(`launches ${heading} offline after installation`, async ({ context, page }) => {
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
  })
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

test('uses the last Currency reference-rate snapshot offline', async ({ context, page }) => {
  await mockCurrencyRates(page)
  await page.goto('/currency-converter')
  const destination = page.getByRole('spinbutton', { name: 'Destination amount', exact: true })
  await expect(destination).toHaveValue('12') // 1000 INR → USD at the mocked rate
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.unroute(currencyApiPattern)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(destination).toHaveValue('12')
    await expect(page.getByText('offline snapshot', { exact: true })).toBeVisible()
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
