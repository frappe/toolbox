import { expect, test } from './fixtures'
import { resetToolboxPreferences, seedToolboxPreferences } from './support/preferences'

test.use({ allowOfflineNetworkErrors: true })

// World Clock locations live in this context's own sessionStorage. Seed a fixed set so the
// cards, the converter's zone select, and the copy output are deterministic across runs.
const SEED_LOCATIONS = [
  { id: 'seed-kolkata', zone: 'Asia/Kolkata', label: 'Kolkata', favourite: false },
  { id: 'seed-london', zone: 'Europe/London', label: 'London', favourite: false },
  { id: 'seed-new-york', zone: 'America/New_York', label: 'New York', favourite: false },
]

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetToolboxPreferences(page)
  await seedToolboxPreferences(page, { savedWorldClockLocations: SEED_LOCATIONS })
})

test('@smoke adds, reorders, favourites, and removes a time zone', async ({ page }) => {
  await page.goto('/world-clock')
  await expect(page.getByRole('heading', { name: 'World Clock', level: 1 })).toBeVisible()

  const locations = page.getByRole('region', { name: 'Locations' })
  // The add-a-city field is a real ARIA combobox now (#142): the input is
  // role=combobox and the results are role=option inside a role=listbox.
  await page.getByRole('combobox', { name: 'Add a city or time zone' }).fill('Tokyo')
  await page
    .getByRole('listbox', { name: 'Time zone search results' })
    .getByRole('option', { name: /Tokyo/ })
    .first()
    .click()

  const tokyo = locations.getByRole('listitem').filter({ hasText: 'Asia/Tokyo' })
  await expect(tokyo).toBeVisible()
  const locationCount = await locations.getByRole('listitem').count()

  await tokyo.getByRole('button', { name: 'Favourite Tokyo' }).click()
  await expect(tokyo.getByRole('button', { name: 'Unfavourite Tokyo' })).toBeVisible()

  await tokyo.getByRole('button', { name: 'Move Tokyo up' }).click()
  await expect(locations.getByRole('listitem').nth(locationCount - 2)).toContainText('Asia/Tokyo')

  await tokyo.getByRole('button', { name: 'Remove Tokyo' }).click()
  await expect(tokyo).toHaveCount(0)
})

test('adds a time zone with the keyboard alone', async ({ page }) => {
  await page.goto('/world-clock')

  const search = page.getByRole('combobox', { name: 'Add a city or time zone' })
  await search.fill('Tokyo')
  await expect(page.getByRole('listbox', { name: 'Time zone search results' })).toBeVisible()

  await search.press('ArrowDown')
  await expect(page.getByRole('option', { name: /Tokyo/ }).first()).toHaveAttribute('aria-selected', 'true')

  await search.press('Enter')
  await expect(
    page.getByRole('region', { name: 'Locations' }).getByRole('listitem').filter({ hasText: 'Asia/Tokyo' }),
  ).toBeVisible()
})

test('re-times every location with the converter and copies the meeting times', async ({
  browserName,
  context,
  page,
}) => {
  await page.goto('/world-clock')

  const kolkata = page
    .getByRole('region', { name: 'Locations' })
    .getByRole('listitem')
    .filter({ hasText: 'Asia/Kolkata' })
  await expect(kolkata).toBeVisible()

  // The converter shows one chosen wall-clock moment across every card. Anchoring the input to
  // Kolkata's own zone makes its card read back exactly 09:00, independent of the runner's clock.
  await page.getByRole('radio', { name: 'Time converter' }).click()
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
  await page.goto('/world-clock')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'World Clock', level: 1 })).toBeVisible()
    const kolkata = page
      .getByRole('region', { name: 'Locations' })
      .getByRole('listitem')
      .filter({ hasText: 'Asia/Kolkata' })
    await expect(kolkata).toBeVisible()

    // Time math is pure and client-side, so the converter keeps working with no network.
    await page.getByRole('radio', { name: 'Time converter' }).click()
    await page.getByLabel("In this city's time").click()
    await page.getByRole('option', { name: 'Kolkata' }).click()
    const dateTime = page.getByLabel('Date and time')
    await dateTime.fill('2026-01-01 09:00:00')
    await dateTime.press('Enter')
    await expect(kolkata.locator('p.font-mono')).toContainText('09:00')
  } finally {
    await context.setOffline(false)
  }
})
