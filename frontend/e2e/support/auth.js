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

  await page.goto('/toolbox/all-tools')
  await expect(page.getByRole('heading', { name: 'All tools' })).toBeVisible()
}

export async function setCalculatorFavourite(page, shouldBeFavourite) {
  const addButton = page.getByRole('button', { name: 'Add Calculator to favourites' })
  const removeButton = page.getByRole('button', { name: 'Remove Calculator from favourites' })
  const currentState = await removeButton.isVisible()
  if (currentState === shouldBeFavourite) return

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes('.update_preferences') && response.request().method() === 'POST',
  )
  await (shouldBeFavourite ? addButton : removeButton).click()
  expect((await saveResponse).ok()).toBe(true)
}
