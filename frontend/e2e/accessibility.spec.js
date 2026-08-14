import AxeBuilder from '@axe-core/playwright'

import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'

// A whole-page scan, with no exclusions, filtered to serious and critical. That scope is
// deliberate: it is what caught a 2.68:1 contrast failure in the sidebar that no unit test could
// see. Do not narrow it.
//
// The route list comes from the registry now, so every tool is scanned. It was a hand-written list
// of 28 until this change, and six tools had never been scanned at all.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function scan(page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact))
}

for (const path of ALL_ROUTES) {
  const heading = headingFor(path)

  test(
    `${heading} has no serious automated accessibility violations`,
    { annotation: [{ type: 'tool', description: path.slice(1) }, { type: 'check', description: 'accessibility' }] },
    async ({ page }) => {
      await prepare(page, path)
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()

      expect(await scan(page)).toEqual([])
    },
  )

  // Dark mode is a second set of colors over the same markup, so contrast is the failure it
  // finds and contrast is exactly what a light-only sweep cannot see. It runs on one engine
  // because the colors do not vary by engine, and scanning all four would triple the sweep for
  // no new information.
  test(
    `${heading} has no serious accessibility violations in dark mode`,
    { annotation: [{ type: 'tool', description: path.slice(1) }, { type: 'check', description: 'accessibility' }] },
    async ({ browserName, page }) => {
      test.skip(browserName !== 'chromium', 'Colors do not vary by engine; scanned on Chromium')
      await page.emulateMedia({ colorScheme: 'dark' })
      await prepare(page, path)
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()

      expect(await scan(page)).toEqual([])
    },
  )
}

// Settings opens as a dialog over All Tools, so it has no heading of its own. It is scanned with
// the dialog open, which is the only state a visitor sees it in.
test('Settings has no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('dialog')).toBeVisible()

  expect(await scan(page)).toEqual([])
})
