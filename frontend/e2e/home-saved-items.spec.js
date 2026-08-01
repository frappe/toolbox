import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'

test('opens a saved guest currency pair and shows saved World Clock locations', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('toolbox:preferences:v1', JSON.stringify({
      version: 1,
      favouriteToolIds: [],
      recentToolIds: [],
      savedCurrencyPairs: [{ baseCurrency: 'USD', quoteCurrency: 'INR' }],
      savedWeatherLocations: [],
      savedWorldClockLocations: [{ zone: 'Asia/Tokyo', label: 'Tokyo', favourite: true }],
      settings: {},
    }))
  })
  await mockCurrencyRates(page)
  await page.goto('/toolbox/all-tools')
  await page.getByRole('link', { name: 'Home', exact: true }).click()

  await expect(page.getByRole('complementary', { name: 'Saved items' })).toContainText('Tokyo')
  await page.getByRole('link', { name: 'USD → INR' }).click()

  await expect(page).toHaveURL(/currency-converter\?from=USD&to=INR/)
  await expect(page.getByRole('status', { name: 'Converted amount' })).toHaveText('83,333.33 INR')
})
