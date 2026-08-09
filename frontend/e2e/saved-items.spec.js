import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { resetToolboxPreferences, seedToolboxPreferences } from './support/preferences'

// A saved currency pair persists on the per-user server record. This confirms it survives a
// fresh load and re-opens its conversion, independent of the session that first saved it.
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetToolboxPreferences(page)
  await seedToolboxPreferences(page, {
    savedCurrencyPairs: [{ baseCurrency: 'USD', quoteCurrency: 'INR' }],
  })
})

test('re-opens a saved currency pair from the browser', async ({ page }) => {
  await mockCurrencyRates(page)
  await page.goto('/currency-converter')

  // The seeded pair loads from sessionStorage as a chip and reloads that conversion on click.
  await page.getByRole('button', { name: 'USD → INR' }).click()
  await expect(
    page.getByRole('spinbutton', { name: 'Destination amount', exact: true }),
  ).toHaveValue(/^83333/) // 1000 USD → INR at the mocked rate
})
