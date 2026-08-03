import { expect, test } from './fixtures'
import { mockHsnAvailable, mockHsnUnavailable } from './hsn-fixture'

test.use({ allowOfflineNetworkErrors: true })

test('@smoke shows the queued state when no release is active', async ({ page }) => {
  await mockHsnUnavailable(page)
  await page.goto('/toolbox/hsn-sac-lookup')

  await expect(page.getByRole('heading', { name: 'HSN and SAC dataset is not available yet' })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
})

test('searches codes and descriptions from the bundled dataset', async ({ page }) => {
  await mockHsnAvailable(page)
  await page.goto('/toolbox/hsn-sac-lookup')
  const search = page.getByRole('searchbox')

  await search.fill('9983')
  await search.press('Enter')
  await expect(page.locator('ol li').first()).toContainText('9983')
  await expect(page.locator('ol li').first()).toContainText('SAC')

  await search.fill('horses')
  await search.press('Enter')
  await expect(page.locator('ol li').first()).toContainText('0101')

  // Honest source line, no dependency gate.
  await expect(page.getByText('Source updated', { exact: false })).toBeVisible()
  await expect(page.getByText('India Compliance is required')).toHaveCount(0)
})
