import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'

for (const [path, heading] of [
  ['/', 'All tools'],
  ['/calculator', 'Calculator'],
  ['/currency-converter', 'Currency Converter'],
  ['/unit-converter', 'Unit Converter'],
  ['/gst-calculator', 'GST Calculator'],
  ['/financial-calculators', 'Financial Calculators'],
  ['/health-calculators', 'Health & Fitness Calculators'],
  ['/timer', 'Timer, Stopwatch & Countdown'],
  ['/hsn-sac-lookup', 'HSN & SAC Lookup'],
  ['/india-business-lookup', 'India Business Lookup'],
  ['/world-clock', 'World Clock'],
]) {
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
