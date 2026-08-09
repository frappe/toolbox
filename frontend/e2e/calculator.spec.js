import { expect, test } from './fixtures'

test('@smoke calculates a typed scientific expression and stores history', async ({ page }) => {
  await page.goto('/calculator')

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
  await page.goto('/calculator')

  const expression = page.getByRole('textbox', { name: 'Expression' })
  await expression.fill('sqrt(-1)')
  await expression.press('Enter')
  await expect(page.getByRole('alert')).toBeVisible()

  await expression.fill('2 + 3')
  await expression.press('Enter')
  await expect(page.getByRole('status', { name: 'Calculation result' })).toHaveText('5')
})

test('supports calculation and keypad use with keyboard navigation only', async ({
  browserName,
  page,
}) => {
  // Tab-order navigation is engine-specific: Safari keeps buttons out of the Tab order unless
  // full keyboard access is on, and Firefox wraps focus differently, so forward-tabbing back to
  // the expression input never lands. Chromium exercises the keyboard path; axe a11y checks run
  // on every engine (accessibility.spec).
  test.skip(browserName !== 'chromium', 'Tab-order navigation differs by engine; covered on Chromium')
  await page.goto('/calculator')

  // The angle strip is a TabButtons radiogroup: Tab reaches the checked option,
  // ArrowRight moves the roving focus, and Space activates.
  const radians = page.getByRole('radio', { name: 'RAD' })
  await tabTo(page, page.getByRole('radio', { name: 'DEG' }))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect(radians).toHaveAttribute('aria-checked', 'true')

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
