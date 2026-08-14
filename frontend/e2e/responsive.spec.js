import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'

// The route list is derived from the registry. It was written out by hand until this change, and
// six tools were missing from it.
for (const path of ALL_ROUTES) {
  const heading = headingFor(path)

  test(
    `${heading} fits the mobile viewport`,
    { annotation: [{ type: 'tool', description: path.slice(1) }, { type: 'check', description: 'mobile' }] },
    async ({ page }) => {
      await prepare(page, path)
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
      expect(
        overflow.scrollWidth,
        `${path} is clipped inside the scroll container`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)
    },
  )
}

// A character budget is a proxy: the same count of wide letters takes more room than narrow ones.
// This measures what actually renders, at the narrowest column the grid produces, which is where a
// summary would be cut first.
for (const [width, height, layout] of [
  [1440, 900, 'three columns'],
  [820, 1180, 'two columns'],
  [375, 812, 'one column'],
]) {
  test(`shows every tool summary in full at ${width}px, ${layout}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    // Measure after the list exists. Reading the DOM straight after `goto` raced the mount and
    // found no rows at all, which the count assertion below reported as a layout failure.
    await expect(page.locator('[data-tool-card]').first()).toBeVisible()

    const rows = await page.evaluate(() => {
      const main = document.querySelector('#main-content')
      // Both edges in the same frame. `getBoundingClientRect` is relative to the viewport and
      // `clientWidth` is not, so comparing one against the other reports an overflow whenever the
      // sidebar offsets the container.
      const rightEdge = main.getBoundingClientRect().left + main.clientWidth
      return [...document.querySelectorAll('[data-tool-card]')].map((row) => {
        const summary = row.querySelector('p')
        // `scrollWidth` equals `clientWidth` on a block that fits, so it cannot say how much room
        // is left. Measuring the text itself can.
        const range = document.createRange()
        range.selectNodeContents(summary)
        return {
          text: summary.textContent,
          textWidth: range.getBoundingClientRect().width,
          available: summary.clientWidth,
          pastEdge: row.getBoundingClientRect().right > rightEdge + 1,
        }
      })
    })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.filter((row) => row.pastEdge)).toEqual([])
    const cut = rows.filter((row) => row.textWidth > row.available)
    expect(cut.map((row) => row.text), 'these summaries do not fit their column').toEqual([])
  })
}
