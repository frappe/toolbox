import { expect, test } from './fixtures'
import { resetToolboxPreferences } from './support/preferences'

// Start from a clean account so the tool opens un-favourited every run.
test.beforeEach(async ({ page }) => {
  await page.goto('/toolbox/all-tools')
  await resetToolboxPreferences(page)
})

test('persists a favourite through Frappe', async ({ page }) => {
  await page.goto('/toolbox/unit-converter')

  const favourite = page.getByRole('button', { name: 'Favourite', exact: true })
  const favourited = page.getByRole('button', { name: 'Favourited', exact: true })
  await expect(favourite).toBeVisible()

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('.update_preferences') && response.request().method() === 'POST',
  )
  await favourite.click()
  expect((await saved).ok()).toBe(true)
  await expect(favourited).toBeVisible()

  // A reload re-reads preferences from Frappe, so the favourite must come back on its own.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Favourited', exact: true })).toBeVisible()
})
