import { expect, test } from './fixtures'

test('@smoke calculates a typed scientific expression and stores history', async ({ page }) => {
  await page.goto('/toolbox/calculator')

  const expression = page.getByRole('textbox', { name: 'Expression' })
  await expression.fill('sqrt(81) + sin(30)')
  await expression.press('Enter')

  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('9.5')
  await expect(page.getByRole('list', { name: 'Calculator history entries' })).toContainText(
    'sqrt(81) + sin(30)',
  )

  await page.reload()
  await expect(page.getByRole('list', { name: 'Calculator history entries' })).toContainText('9.5')
})

test('shows a safe domain error without breaking the calculator', async ({ page }) => {
  await page.goto('/toolbox/calculator')

  const expression = page.getByRole('textbox', { name: 'Expression' })
  await expression.fill('sqrt(-1)')
  await expression.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()

  await expression.fill('2 + 3')
  await expression.press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('5')
})

test('supports calculation and keypad use with keyboard navigation only', async ({ page }) => {
  await page.goto('/toolbox/calculator')

  const radians = page.locator('[data-angle-mode="radians"]')
  await tabTo(page, radians)
  await page.keyboard.press('Enter')
  await expect(radians).toHaveAttribute('aria-pressed', 'true')

  const expression = page.getByRole('textbox', { name: 'Expression' })
  await tabTo(page, expression)
  await page.keyboard.type('2 + 3')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('5')

  await page.keyboard.press('Escape')
  await expect(expression).toHaveValue('')

  const squareRoot = page.locator('[data-calculator-key="sqrt"]')
  await tabTo(page, squareRoot)
  await page.keyboard.press('Enter')
  await page.keyboard.type('81)')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('9')
})

async function tabTo(page, target) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }

  throw new Error('Target was not reached with keyboard navigation.')
}
