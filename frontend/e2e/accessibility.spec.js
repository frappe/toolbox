import AxeBuilder from '@axe-core/playwright'

import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'

for (const [path, heading] of [
  ['/toolbox/all-tools', 'All tools'],
  ['/toolbox/calculator', 'Calculator'],
  ['/toolbox/currency-converter', 'Currency Converter'],
  ['/toolbox/unit-converter', 'Unit Converter'],
  ['/toolbox/gst-calculator', 'GST Calculator'],
  ['/toolbox/financial-calculators', 'Financial Calculators'],
  ['/toolbox/health-calculators', 'Health & Fitness Calculators'],
  ['/toolbox/timer', 'Timer, Stopwatch & Countdown'],
  ['/toolbox/hsn-sac-lookup', 'HSN & SAC Lookup'],
  ['/toolbox/india-business-lookup', 'India Business Lookup'],
  ['/toolbox/world-clock', 'World Clock'],
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
