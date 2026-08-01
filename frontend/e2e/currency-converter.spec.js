import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'

test('@smoke converts locally, swaps, searches, and saves a pair', async ({ page }) => {
  let requests = 0
  await mockCurrencyRates(page)
  page.on('request', (request) => { if (request.url().includes('toolbox.currency.get_reference_rates')) requests += 1 })
  await page.goto('/toolbox/currency-converter')

  const output = page.getByRole('status', { name: 'Converted amount' })
  await expect(output).toHaveText('12.00 USD')
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('2000')
  await expect(output).toHaveText('24.00 USD')
  expect(requests).toBe(1)

  await page.getByRole('button', { name: 'Swap' }).click()
  await expect(output).toHaveText('1,66,666.67 INR')
  await page.getByRole('button', { name: 'Save pair' }).click()
  await expect(page.getByRole('button', { name: 'USD → INR' })).toBeVisible()

  await page.getByTestId('source-currency').click()
  await page.getByRole('searchbox', { name: 'Search source currency' }).fill('pound')
  await page.getByRole('option', { name: 'GBP Pound sterling' }).click()
  await expect(output).toContainText('INR')
})

test('labels stale server cache honestly', async ({ page }) => {
  await mockCurrencyRates(page, { cacheStatus: 'stale' })
  await page.goto('/toolbox/currency-converter')
  await expect(page.getByText('stale server cache')).toBeVisible()
  await expect(page.getByText('Rate date')).toBeVisible()
  await expect(page.getByText('Server checked')).toBeVisible()
  await expect(page.getByText('Offline snapshot saved')).toBeVisible()
})
