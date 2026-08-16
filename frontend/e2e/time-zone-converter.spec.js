import { expect, test } from './fixtures'

test.use({ allowOfflineNetworkErrors: true })

// The city list is held for the life of the page and is not stored, so there is nothing to seed
// or reset. Every visit opens on the same set: the browser's own zone, which
// playwright.config.js pins to Asia/Kolkata, plus London and New York.
const locationList = (page) => page.getByRole('region', { name: 'Locations' })

test('@smoke adds, reorders, and removes a time zone', async ({ page }) => {
  await page.goto('/time-zone-converter')
  await expect(page.getByRole('heading', { name: 'Time Zone Converter', level: 1 })).toBeVisible()

  const locations = locationList(page)
  // The add-a-city field is a real ARIA combobox (#142): the input is role=combobox and the
  // results are role=option inside a role=listbox.
  await page.getByRole('combobox', { name: 'Add a city or time zone' }).fill('Tokyo')
  await page
    .getByRole('listbox', { name: 'Time zone search results' })
    .getByRole('option', { name: /Tokyo/ })
    .first()
    .click()

  const tokyo = locations.getByRole('listitem').filter({ hasText: 'Asia/Tokyo' })
  await expect(tokyo).toBeVisible()
  const locationCount = await locations.getByRole('listitem').count()

  await tokyo.getByRole('button', { name: 'Move Tokyo up' }).click()
  await expect(locations.getByRole('listitem').nth(locationCount - 2)).toContainText('Asia/Tokyo')

  await tokyo.getByRole('button', { name: 'Remove Tokyo' }).click()
  await expect(tokyo).toHaveCount(0)
})

test('adds a time zone with the keyboard alone', async ({ page }) => {
  await page.goto('/time-zone-converter')

  const search = page.getByRole('combobox', { name: 'Add a city or time zone' })
  await search.fill('Tokyo')
  await expect(page.getByRole('listbox', { name: 'Time zone search results' })).toBeVisible()

  await search.press('ArrowDown')
  await expect(page.getByRole('option', { name: /Tokyo/ }).first()).toHaveAttribute('aria-selected', 'true')

  await search.press('Enter')
  await expect(
    locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Tokyo' }),
  ).toBeVisible()
})

// The list is not stored, so a reload is a fresh start rather than a restored one. This is the
// behaviour #283 chose deliberately: the places somebody looked at are not written down.
test('forgets an added city on reload', async ({ page }) => {
  await page.goto('/time-zone-converter')
  await page.getByRole('combobox', { name: 'Add a city or time zone' }).fill('Tokyo')
  await page
    .getByRole('listbox', { name: 'Time zone search results' })
    .getByRole('option', { name: /Tokyo/ })
    .first()
    .click()
  await expect(locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Tokyo' })).toBeVisible()

  await page.reload()
  await expect(locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Tokyo' })).toHaveCount(0)
  await expect(locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Kolkata' })).toBeVisible()
})

test('re-times every location and copies the meeting times', async ({
  browserName,
  context,
  page,
}) => {
  await page.goto('/time-zone-converter')

  const kolkata = locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Kolkata' })
  await expect(kolkata).toBeVisible()

  // Anchoring the input to Kolkata's own zone makes its card read back exactly 09:00,
  // independent of the runner's clock.
  await page.getByLabel("In this city's time").click()
  await page.getByRole('option', { name: 'Kolkata' }).click()
  const dateTime = page.getByLabel('Date and time')
  await dateTime.fill('2026-01-01 09:00:00')
  await dateTime.press('Enter')
  await expect(kolkata.locator('p.font-mono')).toContainText('09:00')

  // Clipboard access (grant + readText) is only reliable in headless Chromium.
  test.skip(browserName !== 'chromium', 'Clipboard permissions are unavailable in headless Firefox/WebKit')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy times' }).click()
  await expect(page.getByText('Times copied.')).toBeAttached()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Kolkata:')
})

test('launches directly and remains useful offline', async ({ browserName, context, page }) => {
  test.skip(browserName === 'webkit', 'WebKit headless cannot drive service-worker offline mode')
  await page.goto('/time-zone-converter')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Time Zone Converter', level: 1 })).toBeVisible()
    const kolkata = locationList(page).getByRole('listitem').filter({ hasText: 'Asia/Kolkata' })
    await expect(kolkata).toBeVisible()

    // It converts with no network: the zone rules are already in the browser.
    await expect(kolkata.locator('p.font-mono')).toContainText(/\d{2}:\d{2}/)
  } finally {
    await context.setOffline(false)
  }
})

test('@smoke sends the retired World Clock route to the converter', async ({ request }) => {
  const response = await request.get('/world-clock', { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe('/time-zone-converter')
})
