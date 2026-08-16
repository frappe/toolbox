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

// Contrast is not read from WebKit, and issue #265 is why.
//
// Playwright's Linux WebKit reported the frappe-ui greys below the 4.5:1 threshold — the Settings
// category labels at 3.77:1, a Currency Converter control at 2.56:1. No other engine reported
// either, WebKit on macOS did not either, and Vibhav read the computed colour in real Safari on
// 2026-08-16: it renders correctly. That build resolves the colour tokens differently from every
// browser a visitor will use, so its contrast numbers describe the build rather than the site.
//
// The rule is dropped for that engine alone. Contrast is still checked on every route, in light and
// in dark, on Chromium and Firefox, so nothing is given up: a real contrast fault fails there. Every
// other axe rule still runs on WebKit, which is where its layout and markup differences matter.

// Two things have to be true before axe is worth asking, and neither was.
//
// The heading is in the document almost at once. Anything that waits on a fetch is not, and a
// rule cannot report an element that has not been drawn yet.
//
// The larger one: **axe evaluates colour contrast only inside the viewport.** An element below
// the fold is not reported as a violation, and not even as incomplete. It is skipped in silence.
// On the default 720px viewport that left everything below the first screen of all 37 routes
// unchecked, which is most of every page. Measured on the Currency Converter, whose rate delta
// sits at y=742 and rendered at 1.21:1: zero violations and zero incomplete at 720px tall, one
// violation at 4000px. See #273.
//
// So the viewport grows to the page before the scan. `networkidle` comes first because the height
// is only meaningful once the late content is in, and the measure-then-resize runs twice because
// the resize itself reflows the page and can lengthen it.
//
// The height comes from `#main-content` and not from the document. This shell scrolls that
// element rather than the window, which is what issue #226 was, so `documentElement.scrollHeight`
// is just the viewport height and a sweep that trusts it never resizes at all.
// The tallest route measured 1709px at 1280px wide and 2802px at 375px wide, so this ceiling has
// room to spare. It exists so a runaway page cannot ask for a viewport no browser will give, and
// it says so when it binds: a scan that quietly stopped half way down reads as a clean page.
const MAX_SCAN_HEIGHT = 8000

async function settle(page) {
  await page.waitForLoadState('networkidle')

  const contentHeight = () =>
    page.evaluate(() =>
      Math.max(
        document.documentElement.scrollHeight,
        document.querySelector('#main-content')?.scrollHeight ?? 0,
      ),
    )

  const { width } = page.viewportSize()
  for (let pass = 0; pass < 2; pass += 1) {
    const height = await contentHeight()
    const target = Math.min(height, MAX_SCAN_HEIGHT)
    if (target <= page.viewportSize().height) break
    await page.setViewportSize({ width, height: target })
  }
  await page.waitForLoadState('networkidle')

  const finalHeight = await contentHeight()
  if (finalHeight > MAX_SCAN_HEIGHT) {
    // eslint-disable-next-line no-console
    console.warn(
      `accessibility sweep: ${page.url()} is ${finalHeight}px tall, so everything below ` +
        `${MAX_SCAN_HEIGHT}px went unscanned. Contrast is only reported inside the viewport.`,
    )
  }
}

async function scan(page, browserName) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations
    .filter(({ impact }) => ['serious', 'critical'].includes(impact))
    .filter(({ id }) => !(browserName === 'webkit' && id === 'color-contrast'))
}

for (const path of ALL_ROUTES) {
  const heading = headingFor(path)

  test(
    `${heading} has no serious automated accessibility violations`,
    { annotation: [{ type: 'tool', description: path.slice(1) }, { type: 'check', description: 'accessibility' }] },
    async ({ browserName, page }) => {
      await prepare(page, path)
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await settle(page)

      expect(await scan(page, browserName)).toEqual([])
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
      await settle(page)

      expect(await scan(page, browserName)).toEqual([])
    },
  )
}

// Settings opens as a dialog over All Tools, so it has no heading of its own. It is scanned with
// the dialog open, which is the only state a visitor sees it in.
test('Settings has no serious automated accessibility violations', async ({ browserName, page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('dialog')).toBeVisible()
  await settle(page)

  expect(await scan(page, browserName)).toEqual([])
})
