import { expect, test } from './fixtures'

const route = '/toolbox/india-business-lookup'
const limitation = 'Format validation does not confirm that the registration is active or belongs to the claimed entity.'

test.use({ allowOfflineNetworkErrors: true })

test('@smoke launches directly and validates GSTINs locally', async ({ page }) => {
  await page.goto(route)

  await expect(page.getByRole('heading', { name: 'India Business Lookup', level: 1 })).toBeVisible()
  await expect(page.getByText(limitation, { exact: true })).toBeVisible()

  const gstin = page.getByRole('textbox', { name: 'GSTIN' })
  await gstin.fill('09AAAUP8175A1ZG')
  await expect(page.getByRole('heading', { name: 'Structurally valid' })).toBeVisible()
  await expect(page.getByText('Uttar Pradesh (09)', { exact: true })).toBeVisible()
  await expect(page.getByText('Valid (G)', { exact: true })).toBeVisible()

  await gstin.fill('09AAAUP8175A1ZF')
  await expect(page.getByRole('heading', { name: 'Invalid GSTIN format' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('checksum')
})

test('shows active PIN and IFSC search panels and supports keyboard tabs', async ({ page }) => {
  await page.goto(route)

  const gstinTab = page.getByRole('tab', { name: 'GSTIN validator' })
  const pinTab = page.getByRole('tab', { name: 'PIN code' })
  const ifscTab = page.getByRole('tab', { name: 'IFSC' })

  await gstinTab.focus()
  await gstinTab.press('ArrowRight')
  await expect(pinTab).toBeFocused()
  await expect(pinTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox', { name: 'PIN code, office, district, or state' })).toBeVisible()

  await pinTab.press('End')
  await expect(ifscTab).toBeFocused()
  await expect(page.getByRole('searchbox', { name: 'IFSC, bank, branch, city, or state' })).toBeVisible()

  await ifscTab.press('Home')
  await expect(gstinTab).toBeFocused()
  await expect(gstinTab).toHaveAttribute('aria-selected', 'true')
})

test('launches directly and validates a GSTIN offline', async ({ context, page }) => {
  await page.goto(route)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'India Business Lookup', level: 1 })).toBeVisible()
    await page.getByRole('textbox', { name: 'GSTIN' }).fill('09AAAUP8175A1ZG')
    await expect(page.getByRole('heading', { name: 'Structurally valid' })).toBeVisible()
    await expect(page.getByText(limitation, { exact: true })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

test('searches active PIN and IFSC releases without downloading the full datasets', async ({ page }) => {
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
  await page.route('**/api/method/toolbox.india_business.get_dataset_status', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ message: { schemaVersion: 1, pin: metadata, ifsc: metadata } }),
  }))
  await page.route('**/api/method/toolbox.india_business.search_pin**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ message: { schemaVersion: 1, state: 'ready', results: [{ pin_code: '560001', office_name: 'Bangalore G.P.O.', office_type: 'HO', delivery_status: 'Delivery', district: 'Bengaluru', state: 'Karnataka' }] } }),
  }))
  await page.route('**/api/method/toolbox.india_business.search_ifsc**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ message: { schemaVersion: 1, state: 'ready', results: [{ ifsc_code: 'HDFC0000001', bank_name: 'HDFC Bank', branch: 'Fort', address: 'Fort, Mumbai', city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' }] } }),
  }))
  await page.goto(route)

  await page.getByRole('tab', { name: 'PIN code' }).click()
  await page.getByRole('searchbox', { name: 'PIN code, office, district, or state' }).fill('560001')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Search results' })).toContainText('Bangalore G.P.O.')

  await page.getByRole('tab', { name: 'IFSC' }).click()
  await page.getByRole('searchbox', { name: 'IFSC, bank, branch, city, or state' }).fill('HDFC0000001')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Search results' })).toContainText('HDFC Bank — Fort')
  await expect(page.getByText('Fort, Mumbai', { exact: true })).toBeVisible()
})
