import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'

// The policy is served report-only, so it blocks nothing and a visitor sees no difference. That
// makes it invisible in the ordinary way — which is exactly why it needs a test.
//
// The browser reports what it *would* have blocked through `securitypolicyviolation`. This walks
// every route with a listener attached and collects them. A quiet run across all 37 is the
// evidence needed to switch the header to enforcing.

test('@smoke every page is served the policy', async ({ request }) => {
  const response = await request.get('/calculator')
  const policy = response.headers()['content-security-policy-report-only']

  expect(policy, 'no report-only policy was served').toBeTruthy()
  for (const directive of ['default-src', 'object-src', 'frame-ancestors', 'base-uri']) {
    expect(policy, `the policy has no ${directive}`).toContain(directive)
  }
  // Report-only until the sweep below has been quiet. Enforcing early is how a policy one
  // directive too strict reaches real visitors.
  expect(response.headers()['content-security-policy']).toBeUndefined()
})

test('an API response is not given a policy', async ({ request }) => {
  const response = await request.get('/api/method/toolbox.data_sources.get_data_sources')

  expect(response.headers()['content-security-policy-report-only']).toBeUndefined()
})

// Two reports, two causes, both in dependencies rather than in Toolbox's own code. Issue #266
// tracks them.
//
// The eval is a webpack `global.js` polyfill — `Function("return this")() || (0,eval)("this")` —
// inside frappe-ui's `iconString` chunk. It is a pre-bundled artifact, so it runs whether or not
// the icons are used.
//
// The connect-src reports are frappe-ui starting a socket.io client for a realtime feature Toolbox
// does not have.
//
// Both are recorded here rather than allowed in the policy: `unsafe-eval` is most of what a CSP is
// for, and widening the policy to fit a dependency nobody uses would be the wrong way round. Any
// other violation still fails.
const KNOWN_VIOLATIONS = [
  { directive: 'script-src', blocked: 'eval' },
  { directive: 'connect-src', blocked: /\/socket\.io\// },
]

const isKnown = (report) =>
  KNOWN_VIOLATIONS.some(
    ({ directive, blocked }) =>
      report.directive === directive &&
      (blocked instanceof RegExp ? blocked.test(report.blocked) : report.blocked === blocked),
  )

test('nothing the application loads would be blocked by the policy', async ({ page }) => {
  test.setTimeout(180_000)
  const reports = []

  await page.addInitScript(() => {
    globalThis.__cspReports = []
    document.addEventListener('securitypolicyviolation', (event) => {
      globalThis.__cspReports.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        sample: event.sample,
      })
    })
  })

  for (const path of ALL_ROUTES) {
    await prepare(page, path)
    await page.goto(path)
    await expect(page.getByRole('heading', { name: headingFor(path), level: 1 })).toBeVisible()

    const found = await page.evaluate(() => globalThis.__cspReports || [])
    for (const report of found) reports.push({ path, ...report })
  }

  // Each entry is something the policy would break if it were enforcing. Read it before widening
  // the policy: the right fix is usually to stop loading the thing, not to allow it.
  const unexpected = reports.filter((report) => !isKnown(report))
  expect(unexpected, 'the policy would block these').toEqual([])

  // eslint-disable-next-line no-console
  console.log(`csp: ${reports.length - unexpected.length} known socket.io reports, see #266`)
})
