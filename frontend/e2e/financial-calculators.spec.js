import { expect, test } from './fixtures'

test('@smoke calculates an EMI and exposes the full amortization schedule', async ({ page }) => {
  await page.goto('/toolbox/financial-calculators')

  await page.getByRole('spinbutton', { name: 'Principal' }).fill('100000')
  await page.getByRole('spinbutton', { name: 'Annual interest rate' }).fill('12')
  await page.getByRole('spinbutton', { name: 'Loan duration' }).fill('1')

  const results = page.getByRole('region', { name: 'Result' })
  await expect(results.getByRole('status', { name: 'Primary financial result' })).toHaveText(
    '₹8,884.88',
  )
  await expect(results).toContainText('₹6,618.55')
  await results.getByText('View all 12 payments').click()
  await expect(results.locator('tbody tr')).toHaveCount(12)
  await expect(results.locator('tbody tr').last()).toContainText('₹0.00')
})

test('calculates investment growth and rejects an impossible break-even margin', async ({
  page,
}) => {
  await page.goto('/toolbox/financial-calculators')

  await page.getByRole('button', { name: 'CAGR' }).click()
  await page.getByRole('spinbutton', { name: 'Starting value' }).fill('100')
  await page.getByRole('spinbutton', { name: 'Ending value' }).fill('121')
  await page.getByRole('spinbutton', { name: 'Duration' }).fill('2')
  await expect(page.getByRole('status', { name: 'Primary financial result' })).toHaveText('10.00%')

  await page.getByRole('button', { name: 'Break-even' }).click()
  await page.getByRole('spinbutton', { name: 'Fixed cost' }).fill('1001')
  await page.getByRole('spinbutton', { name: 'Selling price per unit' }).fill('50')
  await page.getByRole('spinbutton', { name: 'Variable cost per unit' }).fill('30')
  await expect(page.getByRole('status', { name: 'Primary financial result' })).toHaveText(
    '51 units',
  )

  await page.getByRole('spinbutton', { name: 'Variable cost per unit' }).fill('50')
  await expect(page.getByRole('alert')).toContainText(
    'Selling price must be greater than variable cost per unit.',
  )
})
