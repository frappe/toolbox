import { expect, test } from './fixtures'
import budgets from '../../qa/fixtures/budgets.json' with { type: 'json' }

// Measured in the page, from the browser's own performance entries, rather than scored by a tool.
// Lighthouse gives the fuller picture and runs in its own layer; this is the part that belongs in
// the matrix, because it is fast enough to run on every route that matters and it fails loudly.
//
// Chromium only: `largest-contentful-paint` and `layout-shift` are Chrome measures, and the other
// engines report nothing at all rather than something different.
const ROUTES = ['/', '/calculator', '/currency-converter', '/emi-calculator', '/dictionary']

for (const path of ROUTES) {
  test(
    `${path} paints and settles within budget`,
    { annotation: [{ type: 'check', description: 'vitals' }] },
    async ({ browserName, page }) => {
      test.skip(browserName !== 'chromium', 'These measures are Chrome-only')

      await page.goto(path, { waitUntil: 'load' })

      const vitals = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const measures = { lcp: 0, cls: 0 }

            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) measures.lcp = entry.startTime
            }).observe({ type: 'largest-contentful-paint', buffered: true })

            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                // A shift the visitor caused by clicking is not a layout shift worth counting.
                if (!entry.hadRecentInput) measures.cls += entry.value
              }
            }).observe({ type: 'layout-shift', buffered: true })

            // Give the observers a frame or two past load to report.
            setTimeout(() => resolve(measures), 1_000)
          }),
      )

      expect(vitals.lcp, `${path} paints its largest element too late`).toBeLessThan(
        budgets.vitals.lcpMs,
      )
      expect(vitals.cls, `${path} moves under the reader`).toBeLessThan(budgets.vitals.cls)
    },
  )
}
