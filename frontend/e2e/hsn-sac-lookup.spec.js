import { expect, test } from './fixtures'
import {
  blockedHsnDependency,
  hsnCatalog,
  hsnCatalogApiPattern,
  hsnDependencyApiPattern,
  hsnInstallApiPattern,
  mockHsnDependency,
  mockHsnReady,
  readyHsnDependency,
} from './hsn-fixture'

test.use({ allowOfflineNetworkErrors: true })

test('@smoke shows the India Compliance gate before lookup', async ({ page }) => {
  await mockHsnDependency(page)
  await page.goto('/toolbox/hsn-sac-lookup')

  await expect(page.getByRole('heading', { name: 'India Compliance is required' })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.getByText('ERPNext', { exact: true })).toBeVisible()
  await expect(page.getByText('India Compliance', { exact: true })).toBeVisible()
})

test('searches codes, phrases, words, and typos in a stable browser snapshot', async ({ page }) => {
  await mockHsnReady(page)
  await page.goto('/toolbox/hsn-sac-lookup')
  const search = page.getByRole('searchbox', { name: 'Code or description' })

  await search.fill('9983')
  await expect(page.locator('ol li').first()).toContainText('998313')
  await expect(page.locator('ol li').nth(1)).toContainText('998314')

  await search.fill('support technology')
  await expect(page.locator('ol li').first()).toContainText('998313')

  await search.fill('cofee')
  await expect(page.locator('ol li').first()).toContainText('09012120')
  await expect(page.getByText('Statutory GST rate is not available in this source master.')).toBeVisible()
})

test('requires explicit confirmation and activates after a cloud install task', async ({ page }) => {
  const installable = {
    schemaVersion: 1,
    state: 'installable',
    title: 'India Compliance can be installed',
    message: 'A System Manager can request the fixed Marketplace app.',
    canInstall: true,
  }
  await page.route(hsnDependencyApiPattern, (route) => {
    const response = route.request().url().includes('task_id') ? readyHsnDependency : installable
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: response }) })
  })
  await page.route(hsnInstallApiPattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          schemaVersion: 1,
          state: 'installing',
          title: 'Installing India Compliance',
          message: 'Frappe Cloud accepted the request.',
          taskId: 'task-1',
        },
      }),
    }),
  )
  await page.route(hsnCatalogApiPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: hsnCatalog }) }),
  )
  await page.goto('/toolbox/hsn-sac-lookup')

  const install = page.getByRole('button', { name: 'Install India Compliance' })
  await expect(install).toBeDisabled()
  await page.getByRole('checkbox').check()
  await install.click()
  await expect(page.getByRole('heading', { name: 'Installing India Compliance' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Code or description' })).toBeVisible({ timeout: 5_000 })
})

test('shows a safe administrator handoff on unsupported hosts', async ({ page }) => {
  await mockHsnDependency(page, {
    ...blockedHsnDependency,
    state: 'unsupported',
    title: 'Administrator action required',
    message: 'This host cannot install apps from Toolbox.',
    adminHandoff: {
      docsUrl: 'https://docs.indiacompliance.app/docs/getting-started/installation',
    },
  })
  await page.goto('/toolbox/hsn-sac-lookup')

  await expect(page.getByRole('link', { name: 'India Compliance installation guide' })).toHaveAttribute(
    'href',
    'https://docs.indiacompliance.app/docs/getting-started/installation',
  )
  await expect(page.getByText('Toolbox does not run host commands from the browser.')).toBeVisible()
})

test('uses the last complete HSN snapshot offline', async ({ context, page }) => {
  await mockHsnReady(page)
  await page.goto('/toolbox/hsn-sac-lookup')
  await page.getByRole('searchbox', { name: 'Code or description' }).fill('0101')
  await expect(page.locator('ol li').first()).toContainText('Live horses')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await page.unroute(hsnDependencyApiPattern)
  await page.unroute(hsnCatalogApiPattern)
  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText('offline snapshot', { exact: true })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Code or description' }).fill('horses')
    await expect(page.locator('ol li').first()).toContainText('0101')
  } finally {
    await context.setOffline(false)
  }
})
