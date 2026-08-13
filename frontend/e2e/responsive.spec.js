import { expect, test } from './fixtures'
import { mockCurrencyRates } from './currency-fixture'
import { mockHsnAvailable } from './hsn-fixture'
import { headingFor } from './toolPages'

for (const path of [
  '/',
  '/calculator',
  '/currency-converter',
  '/length-converter',
  '/weight-converter',
  '/temperature-converter',
  '/volume-converter',
  '/speed-converter',
  '/area-converter',
  '/time-unit-converter',
  '/data-storage-converter',
  '/fuel-consumption-converter',
  '/gst-calculator',
  '/emi-calculator',
  '/compound-interest-calculator',
  '/sip-calculator',
  '/cagr-calculator',
  '/future-value-calculator',
  '/break-even-calculator',
  '/bmi-calculator',
  '/tdee-calculator',
  '/pace-calculator',
  '/timer',
  '/stopwatch',
  '/countdown-timer',
  '/hsn-sac-lookup',
  '/pin-code-search',
  '/ifsc-code-search',
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

    // The document is not the thing that scrolls. `#main-content` is, and it carries
    // `overflow-x-hidden`, so content wider than the viewport is clipped rather than reachable —
    // the document stays exactly as wide as the window and the check above still passes. That is
    // how the tool rows shipped 440px wide inside a 343px column, cut mid-word. Measure the
    // container that actually holds the page.
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('#main-content')
      return { clientWidth: main.clientWidth, scrollWidth: main.scrollWidth }
    })
    expect(overflow.scrollWidth, `${path} is clipped inside the scroll container`).toBeLessThanOrEqual(
      overflow.clientWidth + 1,
    )
  })
}

test('truncates a tool description rather than letting it run off the screen', async ({ page }) => {
  await page.goto('/')

  const cut = await page.evaluate(() => {
    const limit = document.querySelector('#main-content').clientWidth
    const rows = [...document.querySelectorAll('[data-tool-card]')]
    return {
      rows: rows.length,
      pastEdge: rows.filter((row) => row.getBoundingClientRect().right > limit + 1).length,
      // A truncated description is narrower than its text: that is the ellipsis doing its job.
      truncated: rows.filter((row) => {
        const description = row.querySelector('p')
        return description.scrollWidth > description.clientWidth
      }).length,
    }
  })

  expect(cut.rows).toBeGreaterThan(0)
  expect(cut.pastEdge).toBe(0)
  expect(cut.truncated).toBeGreaterThan(0)
})
