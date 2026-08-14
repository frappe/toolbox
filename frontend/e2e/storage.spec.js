import { expect, test } from './fixtures'
import { ALL_ROUTES, headingFor, prepare } from './toolPages'

// This spec walks every route in turn, and leaving a page cancels what it had in flight.
test.use({ allowNavigationAbortErrors: true })

// "Nothing a visitor does is sent to the server, and nothing outlives the browser session" is a
// promise the About page makes in words. This is the check that the code keeps it.
//
// Three keys are allowed to survive the session, and only three. Each was argued for on its own:
// the theme, so a returning dark-mode visitor is not flashed a white page; the currency rate
// snapshot, which is public data that names nobody and is the only thing that lets that tool
// convert on the first offline visit; and the sidebar shape. A fourth would be a record of the
// visitor, which is the thing the site says it does not keep.
const ALLOWED_PERSISTENT_KEYS = [
  'toolbox:theme:v1',
  'toolbox:currency-reference-rates:v1',
  'toolbox:sidebar-collapsed:v1',
]

test('@smoke visiting every tool writes no persistent key beyond the three agreed', async ({
  page,
}) => {
  for (const path of ALL_ROUTES) {
    await prepare(page, path)
    await page.goto(path)
    // Let the page finish arriving before leaving it, so a tool that writes on mount has written.
    await expect(page.getByRole('heading', { name: headingFor(path), level: 1 })).toBeVisible()
  }

  const stored = await page.evaluate(() => Object.keys(globalThis.localStorage))
  const unexpected = stored.filter((key) => !ALLOWED_PERSISTENT_KEYS.includes(key))

  expect(unexpected, 'these keys outlive the browser session and were not agreed').toEqual([])
})

test('preferences and history are held for the session only', async ({ page }) => {
  await page.goto('/calculator')
  await page.getByRole('textbox', { name: 'Expression' }).fill('2 + 2')
  await page.getByRole('textbox', { name: 'Expression' }).press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('4')

  const storage = await page.evaluate(() => ({
    session: Object.keys(globalThis.sessionStorage),
    local: Object.keys(globalThis.localStorage),
  }))

  expect(storage.session).toContain('toolbox:calculator-history:v1')
  expect(storage.local).not.toContain('toolbox:calculator-history:v1')
})

test('the page tells the server nothing about the visitor', async ({ page }) => {
  const posted = []
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      posted.push(`${request.method()} ${request.url()}`)
    }
  })

  await page.goto('/calculator')
  await page.getByRole('textbox', { name: 'Expression' }).fill('7 * 6')
  await page.getByRole('textbox', { name: 'Expression' }).press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('42')

  expect(posted, 'a tool used offline-capable arithmetic and still wrote to the server').toEqual([])
})

test('the page never names its visitor', async ({ page }) => {
  await page.goto('/')

  // Toolbox ships no boot payload at all: it is a standalone application and does not load the
  // desk bundle. So an assertion about the keys of `frappe.boot` would pass over a page that has
  // no `frappe` on it, and prove nothing. This checks the page instead of the object.
  const identity = await page.evaluate(() => {
    const boot = globalThis.frappe?.boot
    const identifying = ['user', 'user_info', 'full_name', 'is_logged_in', 'session', 'sid']
    return {
      inBoot: boot ? Object.keys(boot).filter((key) => identifying.includes(key)) : [],
      // Frappe sets `user_id` and `full_name` cookies for everyone, and for a visitor both read
      // "Guest". Any other value would mean a session was established.
      named: document.cookie
        .split('; ')
        .filter((entry) => /^(user_id|full_name)=/.test(entry))
        .filter((entry) => !entry.endsWith('=Guest')),
    }
  })

  expect(identity.inBoot, 'the boot payload names its visitor').toEqual([])
  expect(identity.named, 'a cookie names somebody other than Guest').toEqual([])
})
