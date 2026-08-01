import { expect, test } from './fixtures'

test('@smoke converts in both directions and swaps units', async ({ page }) => {
  await page.goto('/toolbox/unit-converter')

  const fromValue = page.getByRole('textbox', { name: 'From value' })
  const toValue = page.getByRole('textbox', { name: 'To value' })
  await fromValue.fill('1500')
  await expect(toValue).toHaveValue('1.5')
  await expect(page.getByTestId('conversion-announcement')).toContainText('kilometer')

  await toValue.fill('2')
  await expect(fromValue).toHaveValue('2000')

  await page.getByRole('button', { name: 'Swap units' }).click()
  await expect(page.getByRole('button', { name: /From unit Kilometer/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /To unit Meter/ })).toBeVisible()
})
