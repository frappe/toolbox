import { expect, test } from './fixtures'

const pinRoute = '/pin-code-search'
const ifscRoute = '/ifsc-code-search'

test.use({ allowOfflineNetworkErrors: true })

const metadata = {
  version: 'test-release',
  sourceUpdatedAt: '2026-08-01T00:00:00Z',
  importedAt: '2026-08-01T01:00:00Z',
  recordCount: 1,
  exclusionCount: 0,
  source: {
    name: 'Test source',
    url: 'https://example.com/data',
    license: 'Open license',
    licenseUrl: 'https://example.com/license',
    attribution: 'Test attribution',
  },
}

async function mockStatus(page) {
  await page.route('**/api/method/toolbox.india_business.get_dataset_status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: { schemaVersion: 1, pin: metadata, ifsc: metadata } }),
    }),
  )
}

test('@smoke gives the PIN and IFSC searches a page each', async ({ page }) => {
  await mockStatus(page)
  await page.goto(pinRoute)

  await expect(page.getByRole('heading', { name: 'PIN Code Search', level: 1 })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'PIN code, office, district, or state' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Toolbox navigation' }).getByRole('link', { name: 'IFSC Code Search' }).click()
  await expect(page).toHaveURL(new RegExp(`${ifscRoute}$`))
  await expect(page.getByRole('heading', { name: 'IFSC Code Search', level: 1 })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'IFSC, bank, branch, city, or state' })).toBeVisible()
})

test('@smoke sends the retired lookup route to the PIN search', async ({ request }) => {
  // The old URL is published, so it keeps working. It redirects straight to its replacement
  // rather than through the path it used to serve, because a chain costs every old link a
  // second round trip and a search engine discounts it.
  for (const source of ['/india-business-lookup', '/toolbox/india-business-lookup']) {
    const response = await request.get(source, { maxRedirects: 0 })

    expect(response.status(), source).toBe(308)
    expect(new URL(response.headers().location, 'http://x').pathname, source).toBe(pinRoute)
  }
})

test('moves between the two searches from the keyboard', async ({ page }) => {
  // These are links in a nav, not a radiogroup, so Enter activates them the way it activates
  // any link, and Tab reaches each one.
  await mockStatus(page)
  await page.goto(pinRoute)
  const ifscTab = page.getByRole('navigation', { name: 'Toolbox navigation' }).getByRole('link', { name: 'IFSC Code Search' })

  await ifscTab.focus()
  await ifscTab.press('Enter')

  await expect(page).toHaveURL(new RegExp(`${ifscRoute}$`))
  await expect(ifscTab).toHaveAttribute('aria-current', 'page')
  await expect(
    page.getByRole('searchbox', { name: 'IFSC, bank, branch, city, or state' }),
  ).toBeVisible()
})

test('plots located PIN results on the offline India map', async ({ page }) => {
  await mockStatus(page)
  await page.route('**/api/method/toolbox.india_business.search_pin**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          schemaVersion: 1,
          state: 'ready',
          results: [{ pin_code: '560001', office_name: 'Bangalore G.P.O.', office_type: 'HO', delivery_status: 'Delivery', district: 'Bengaluru', state: 'Karnataka', latitude: '12.9716', longitude: '77.5946' }],
        },
      }),
    }),
  )
  await page.goto(pinRoute)

  await page.getByRole('searchbox', { name: 'PIN code, office, district, or state' }).fill('560001')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Search results' })).toContainText('Bangalore G.P.O.')
  await expect(page.getByRole('img', { name: /Map of India/ })).toBeVisible()
  await expect(page.getByText('1 office on the map')).toBeVisible()
})

test('searches the IFSC release', async ({ page }) => {
  await mockStatus(page)
  await page.route('**/api/method/toolbox.india_business.search_ifsc**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          schemaVersion: 1,
          state: 'ready',
          results: [{ ifsc_code: 'HDFC0000001', bank_name: 'HDFC Bank', branch: 'Fort', address: 'Fort, Mumbai', city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' }],
        },
      }),
    }),
  )
  await page.goto(pinRoute)

  await page.getByRole('navigation', { name: 'Toolbox navigation' }).getByRole('link', { name: 'IFSC Code Search' }).click()
  await page.getByRole('searchbox', { name: 'IFSC, bank, branch, city, or state' }).fill('HDFC0000001')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Search results' })).toContainText('HDFC Bank — Fort')
  await expect(page.getByText('Fort, Mumbai', { exact: true })).toBeVisible()
})
