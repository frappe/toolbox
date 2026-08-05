import { expect } from '@playwright/test'

export async function loginAsAdministrator(page) {
  const username = process.env.TOOLBOX_E2E_USERNAME || 'Administrator'
  const password = process.env.TOOLBOX_E2E_PASSWORD || 'admin'

  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(username)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)

  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/method/login') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Continue' }).click()
  expect((await loginResponse).ok()).toBe(true)

  // The Frappe login page performs its own post-login redirect (to the desk); navigating to
  // Toolbox at the same moment can abort our navigation (net::ERR_ABORTED). Retry the visit
  // until the app shell renders so the shared auth setup is not flaky.
  await expect(async () => {
    await page.goto('/toolbox/all-tools')
    await expect(page.getByRole('heading', { name: 'All tools' })).toBeVisible()
  }).toPass({ timeout: 20_000 })
}
