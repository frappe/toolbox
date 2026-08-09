import AxeBuilder from '@axe-core/playwright'

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
  test(`${heading} has no serious automated accessibility violations`, async ({ page }) => {
    if (path.includes('currency-converter')) await mockCurrencyRates(page)
    if (path.includes('hsn-sac-lookup')) await mockHsnAvailable(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()

    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const seriousViolations = scan.violations.filter(({ impact }) =>
      ['serious', 'critical'].includes(impact),
    )

    expect(seriousViolations).toEqual([])
  })
}
