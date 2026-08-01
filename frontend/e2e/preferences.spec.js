import { expect, test } from './fixtures'
import { loginAsAdministrator, setCalculatorFavourite } from './support/auth'

test.describe.configure({ mode: 'serial' })
test.use({ allowFrappeLoginRedirectAbort: true })

test('persists an authenticated favourite through Frappe', async ({ page }) => {
  await loginAsAdministrator(page)

  await setCalculatorFavourite(page, false)
  await setCalculatorFavourite(page, true)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Remove Calculator from favourites' }),
  ).toBeVisible()

  await setCalculatorFavourite(page, false)
})
