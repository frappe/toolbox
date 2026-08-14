import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'
import { seedToolboxPreferences } from './support/preferences'
import { WORLD_CLOCK_LOCATIONS } from '../src/test/toolCases/time'

// A reference image for every route, in both themes, at two widths. This catches what a measured
// assertion cannot: a control that lost its background, a heading that lost its weight, a panel
// that collapsed. It runs on Chromium alone, because a reference image is a record of this
// renderer and comparing it against another engine's text rasterization reports a difference on
// every run.
//
// The image is the viewport, not the whole page. The tool sits above the fold and the written
// content below it is already covered by the content tests, so a full-page image would add height,
// weight and churn without adding a defect it could find.
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
]

// Anything that reads from the clock. These pages are worth an image for their layout, and their
// contents change every second, so the moving part is covered rather than excluded.
const CLOCK_ROUTES = new Set([
  '/world-clock',
  '/time-zone-converter',
  '/timer',
  '/stopwatch',
  '/countdown-timer',
])

for (const path of ALL_ROUTES) {
  for (const theme of ['light', 'dark']) {
    for (const viewport of VIEWPORTS) {
      test(
        `${headingFor(path)} looks right in ${theme} at ${viewport.name} width`,
        {
          annotation: [
            { type: 'tool', description: path.slice(1) },
            { type: 'check', description: 'visual' },
          ],
        },
        async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          await page.emulateMedia({ colorScheme: theme })
          await prepare(page, path)

          if (CLOCK_ROUTES.has(path)) {
            await page.goto('/')
            await seedToolboxPreferences(page, { savedWorldClockLocations: WORLD_CLOCK_LOCATIONS })
          }

          await page.goto(path)
          await expect(page.getByRole('heading', { name: headingFor(path), level: 1 })).toBeVisible()

          await expect(page).toHaveScreenshot(`${slug(path)}-${theme}-${viewport.name}.png`, {
            animations: 'disabled',
            caret: 'hide',
            mask: masksFor(page, path),
            // Font rasterization moves a handful of pixels between runs on the same machine.
            // This is loose enough to absorb that and tight enough to fail on a lost border.
            maxDiffPixelRatio: 0.01,
          })
        },
      )
    }
  }
}

function masksFor(page, path) {
  if (!CLOCK_ROUTES.has(path)) return []
  // Every running figure on these pages is monospaced, which is the one thing they have in common.
  return [page.locator('#main-content .font-mono')]
}

function slug(path) {
  return path === '/' ? 'all-tools' : path.slice(1)
}
