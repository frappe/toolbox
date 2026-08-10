import AxeBuilder from '@axe-core/playwright'

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
  '/pin-code-search',
  '/ifsc-code-search',
  '/world-clock',
]) {
  const heading = headingFor(path)

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
