import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'
import { headingFor } from './toolPages'

for (const path of [
  '/',
  '/calculator',
  '/currency-converter',
  '/unit-converter',
  '/gst-calculator',
  '/financial-calculators',
  '/health-calculators',
  '/timer',
  '/stopwatch',
  '/countdown-timer',
  '/hsn-sac-lookup',
  '/india-business-lookup',
  '/world-clock',
]) {
  const heading = headingFor(path)

  test(`${heading} fits the mobile viewport`, async ({ page }) => {
    if (path.includes('currency-converter')) await mockCurrencyRates(page)
    if (path.includes('hsn-sac-lookup')) await mockHsnAvailable(page)
    await page.goto(path)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary mobile navigation' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
  })
}
