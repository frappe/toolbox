import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'

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

          await page.goto(path)
          await expect(page.getByRole('heading', { name: headingFor(path), level: 1 })).toBeVisible()
          await settle(page, path)

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

// The `<h1>` is rendered by the server as well as by the application, so waiting for it does not
// prove the application is up. `#main-content` belongs to `AppShell` and appears in no
// server-rendered block, so this waits for the real thing.
//
// It is a guard rather than a fix for anything measured: probing a throttled browser shows the
// shell already mounted by the time the heading is visible. The `/data-sources` wait below is the
// one that fixed a real failure — its release ledger arrives after the heading, so one run caught
// "Reading the release ledger…" and the next caught the list.
async function settle(page, path) {
  await expect(page.locator('#main-content')).toBeVisible()
  if (path === '/data-sources') await expect(page.getByText('Reading the release ledger…')).toHaveCount(0)
}

function masksFor(page, path) {
  // The figures on the dataset page are read from the database, and the Imported date moves
  // whenever a release is imported again. That is a second reason this page can differ between
  // runs, and unlike the load race it cannot be waited out.
  if (path === '/data-sources') return [page.locator('#main-content dd.tabular-nums')]

  if (!CLOCK_ROUTES.has(path)) return []
  // Every running figure on these pages is monospaced, which is the one thing they have in common.
  return [page.locator('#main-content .font-mono')]
}

function slug(path) {
  return path === '/' ? 'all-tools' : path.slice(1)
}
