import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { resetToolboxPreferences } from './support/preferences'

// Saving a pair writes to this context's own sessionStorage; start each test from a clean
// slate so the saved-pair assertions do not depend on a prior run's state.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetToolboxPreferences(page)
})

test('@smoke converts locally, swaps, and searches for a currency', async ({ page }) => {
  let requests = 0
  await mockCurrencyRates(page)
  page.on('request', (request) => { if (request.url().includes('toolbox.currency.get_reference_rates')) requests += 1 })
  await page.goto('/currency-converter')

  // Two-way input model: editing one box derives the other from the dated reference rate.
  const source = page.getByRole('spinbutton', { name: 'Source amount', exact: true })
  const destination = page.getByRole('spinbutton', { name: 'Destination amount', exact: true })
  await expect(destination).toHaveValue('12') // 1000 INR → USD at the mocked rate
  await source.fill('2000')
  await expect(destination).toHaveValue('24')
  expect(requests).toBe(1) // conversion is local; rates are fetched once

  await page.getByRole('button', { name: 'Swap' }).click()
  await expect(destination).toHaveValue(/^166666/) // 2000 USD → INR

  // The picker is a frappe-ui Combobox: its search field is a `role=combobox`.
  await page.getByTestId('source-currency').click()
  await page.getByRole('combobox', { name: 'Search source currency' }).fill('pound')
  await page.getByRole('option', { name: 'GBP Pound sterling' }).click()
  await expect(page.getByTestId('source-currency')).toContainText('GBP')
  await expect(destination).toHaveValue(/^235294/) // 2000 GBP → INR, still converting locally
})

test('labels stale server cache honestly', async ({ page }) => {
  await mockCurrencyRates(page, { cacheStatus: 'stale' })
  await page.goto('/currency-converter')

  // Scoped to the line that carries the rate state. The content below the tool explains what each
  // status means, so it holds the same words, and a page-wide lookup matches both.
  const rateState = page.getByTestId('rate-state')
  await expect(rateState).toContainText('stale server cache')
  await expect(rateState).toContainText('Server checked')
  await expect(rateState).toContainText('Offline snapshot')
})

test('never describes reference rates as live', async ({ page }) => {
  await mockCurrencyRates(page, { cacheStatus: 'live' })
  await page.goto('/currency-converter')
  await expect(page.getByText('updated', { exact: true })).toBeVisible()
  await expect(page.getByText('Live', { exact: true })).toHaveCount(0)
})

// The rate chart reads the pointer against its own bounding box to pick the nearest point. That
// used a template ref until #280 moved the SVG into `ToolChart`, which left the ref pointing at
// nothing and the tooltip dead — with every test still green, because none of them hovered it.
test('the rate chart answers a hover with the value under the pointer', async ({ page }) => {
  await mockCurrencyRates(page)
  await page.goto('/currency-converter')

  const chart = page.getByRole('img', { name: /exchange rate over/ })
  await expect(chart).toBeVisible()

  const box = await chart.boundingBox()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2)

  // The tooltip is drawn inside the SVG, so it is text rather than a title attribute.
  await expect(chart.locator('text').filter({ hasText: /\d/ }).first()).toBeVisible()
  await expect(chart.locator('circle')).toBeVisible()
})
