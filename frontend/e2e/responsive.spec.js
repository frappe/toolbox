import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnDependency } from './hsn-fixture'

for (const [path, heading] of [
  ['/toolbox/all-tools', 'All tools'],
  ['/toolbox/calculator', 'Calculator'],
  ['/toolbox/currency-converter', 'Currency Converter'],
  ['/toolbox/unit-converter', 'Unit Converter'],
  ['/toolbox/gst-calculator', 'GST Calculator'],
  ['/toolbox/financial-calculators', 'Financial Calculators'],
  ['/toolbox/health-calculators', 'Health & Fitness Calculators'],
  ['/toolbox/timer', 'Timer, Stopwatch & Countdown'],
  ['/toolbox/hsn-sac-lookup', 'HSN, SAC & GST Lookup'],
  ['/toolbox/india-business-lookup', 'India Business Lookup'],
  ['/toolbox/world-clock', 'World Clock'],
]) {
  test(`${heading} fits the mobile viewport`, async ({ page }) => {
    if (path.includes('currency-converter')) await mockCurrencyRates(page)
    if (path.includes('hsn-sac-lookup')) await mockHsnDependency(page)
    await page.goto(path)

    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary mobile navigation' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
  })
}
